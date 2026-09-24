"""Coleta do PNCP.

    python collector/coleta.py                  rápida: o que ainda anda (de hora em hora)
    python collector/coleta.py --modo completa  confere todas pelo histórico (semanal)
    python collector/coleta.py --modo tudo      refaz tudo, sem atalho
    python collector/coleta.py --orgao 85877    só um órgão
    python collector/coleta.py --limite 5       só as N primeiras de cada órgão
    python collector/coleta.py --seco           não grava nada, só relata

Fluxo: percorre a busca de cada órgão. Compra nova entra completa (arquivos,
itens, resultados, histórico). Das que já estão no banco, incremental.plano
decide se basta gravar os dados da busca ou se vale conferir o /historico — e
só com registro novo lá o resto é buscado. Cada órgão vira uma linha em
sync_log; a falha de um não impede os seguintes.
"""

import argparse
import logging
import sys
from datetime import datetime, timezone

import psycopg

import db
import incremental as inc
import mapeamento as m
from config import ORGAOS
from pncp import Pncp

log = logging.getLogger("coleta")


def coletar_compra(api, cur, item, seco, historico=None):
    """Processa uma compra por inteiro. Devolve quantas linhas novas gerou.

    `historico` evita buscar de novo o /historico que a conferência
    incremental já trouxe.
    """
    cnpj = item["orgao_cnpj"]
    ano, seq = item["ano"], item["numero_sequencial"]

    itens = api.itens(cnpj, ano, seq)
    com_resultado = [i for i in itens if i.get("temResultado")]

    # data_homologacao não existe no PNCP: a melhor aproximação é a data do
    # resultado mais recente entre os itens homologados.
    resultados = []
    for it in com_resultado:
        resultados.extend(api.resultados(cnpj, ano, seq, it["numeroItem"]))
    datas = [m.data(r.get("dataResultado")) for r in resultados]
    homologacao = max([d for d in datas if d], default=None)

    linha = m.licitacao(
        item,
        tem_resultado=bool(com_resultado),
        data_homologacao=homologacao,
        estimado=m.valor_estimado(itens),
        homologado=m.valor_homologado(resultados),
    )
    if seco:
        log.info("  [seco] %s · %s · %s", linha["id_pncp"], linha["status"], linha["objeto"][:60])
        return 0

    licitacao_id, mudou = db.upsert_licitacao(cur, linha)

    novos = 1 if mudou else 0
    novos += db.inserir_documentos(
        cur, [m.documento(a, licitacao_id) for a in api.arquivos(cnpj, ano, seq)]
    )
    if historico is None:
        historico = api.historico(cnpj, ano, seq)
    novos += db.inserir_eventos(cur, [m.evento(h, licitacao_id) for h in historico])

    for resultado in resultados:
        empresa, vinculo = m.participante(resultado, licitacao_id)
        if empresa:
            db.upsert_empresa(cur, empresa)
            db.upsert_participante(cur, vinculo)

    return novos


def atualizar_leve(cur, item, estado, seco):
    """Caminho leve: só os dados da busca, com o status recalculado pelo prazo.
    Se a licitação já estava homologada, é porque tem resultado."""
    linha = m.licitacao(item, tem_resultado=estado["status"] == "homologada")
    if seco or not inc.busca_mudou(linha, estado):
        return 0
    return 1 if db.atualizar_da_busca(cur, linha) else 0


def processar(api, cur, item, estado, modo, seco, agora):
    """Devolve (linhas novas, "completa" | "leve")."""
    acao = inc.plano(modo, estado, agora)
    historico = None
    if acao == "historico":
        historico = api.historico(item["orgao_cnpj"], item["ano"], item["numero_sequencial"])
        acao = "completa" if inc.houve_novidade(historico, estado["ultimo_evento"]) else "leve"
    if acao == "completa":
        return coletar_compra(api, cur, item, seco, historico), "completa"
    return atualizar_leve(cur, item, estado, seco), "leve"


def registrar_falha(conexao, sync_id, novos, erro):
    """Desfaz a compra em curso e marca o órgão como erro no sync_log.

    Devolve a conexão a usar dali em diante: se a antiga caiu, abre outra. Em
    2026-09-23 o ROLLBACK falhou depois de ~8 min sem consulta, esperando o
    PNCP, e a exceção derrubou a coleta inteira em vez de seguir para o
    próximo órgão.
    """
    try:
        conexao.rollback()
    except psycopg.Error:
        conexao.close()
        conexao = db.conectar()
    with conexao.cursor() as cur:
        db.fechar_sync(cur, sync_id, "erro", novos, str(erro)[:500])
    conexao.commit()
    return conexao


def main():
    p = argparse.ArgumentParser(description="Coleta licitações do PNCP.")
    p.add_argument("--orgao", type=int, help="coleta só este orgao_id")
    p.add_argument("--limite", type=int, help="máximo de compras por órgão")
    p.add_argument("--seco", action="store_true", help="não grava, só relata")
    p.add_argument(
        "--modo",
        choices=["rapida", "completa", "tudo"],
        default="rapida",
        help="rapida: confere só o que ainda anda; completa: confere tudo; tudo: refaz tudo",
    )
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    # Uma linha por requisição HTTP afoga o relatório: uma compra sozinha faz
    # dezenas de chamadas.
    logging.getLogger("httpx").setLevel(logging.WARNING)

    alvos = {args.orgao: ORGAOS[args.orgao]} if args.orgao else ORGAOS
    if args.orgao and args.orgao not in ORGAOS:
        p.error(f"orgao_id {args.orgao} não está em config.ORGAOS")

    conexao = None if args.seco else db.conectar()
    total_novos = 0
    falhas = []

    try:
        with Pncp() as api:
            for orgao_id, (cnpj, nome) in alvos.items():
                cur = conexao.cursor() if conexao else None
                sync_id = None
                if cur:
                    sync_id = db.abrir_sync(cur, f"PNCP · {nome}")
                    conexao.commit()
                novos = n = 0
                contagem = {"completa": 0, "leve": 0}
                try:
                    # Sem banco (--seco), tudo parece novo e entra completo.
                    estados = db.estado_compras(cur, cnpj) if cur else {}
                    agora = datetime.now(timezone.utc)
                    for n, item in enumerate(api.buscar_compras(orgao_id), 1):
                        if args.limite and n > args.limite:
                            n -= 1
                            break
                        estado = estados.get(item["numero_controle_pncp"])
                        linhas, acao = processar(api, cur, item, estado, args.modo, args.seco, agora)
                        novos += linhas
                        contagem[acao] += 1
                        # Uma transação por compra. Assim uma falha na
                        # milésima requisição não desfaz as 999 anteriores, e
                        # o reinício aproveita o que já entrou — os upserts
                        # são idempotentes. Compra que não gravou nada não
                        # abriu transação, e aí o commit não vai ao banco.
                        if conexao:
                            conexao.commit()
                        if n % 25 == 0:
                            log.info("  %s: %d compras, %d linhas novas", nome, n, novos)
                    if cur:
                        db.fechar_sync(cur, sync_id, "ok", novos)
                        conexao.commit()
                    log.info(
                        "%s: %d compras (%d completas, %d leves), %d linhas novas",
                        nome, n, contagem["completa"], contagem["leve"], novos,
                    )
                    total_novos += novos
                except Exception as erro:
                    if conexao:
                        conexao = registrar_falha(conexao, sync_id, novos, erro)
                    # Segue para o próximo órgão: no cron ninguém está olhando,
                    # e uma queda do PNCP num órgão não deve deixar os outros
                    # desatualizados. A falha fica no sync_log e no código de saída.
                    log.error("%s: FALHOU na compra %d — %s", nome, n, erro)
                    falhas.append(nome)
    finally:
        if conexao:
            conexao.close()

    log.info("total: %d linhas novas", total_novos)
    if falhas:
        log.error("órgãos com falha: %s", ", ".join(falhas))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
