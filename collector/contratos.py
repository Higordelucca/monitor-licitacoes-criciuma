"""Contratos do PNCP (ver CLAUDE.md, "Itens e contratos").

    python collector/contratos.py                   rápida: só contrato novo
    python collector/contratos.py --modo completa   também refaz os vigentes
    python collector/contratos.py --orgao 85877     só um órgão
    python collector/contratos.py --seco            não grava, só relata

Roda no mesmo job da coleta das compras, depois dela: o contrato procura a
licitação pelo id_pncp da compra, e compra que acabou de entrar já está lá.

A busca lista os contratos do órgão mas não diz o fornecedor nem a compra de
origem; isso sai do detalhe, uma chamada por contrato. Por isso a rápida só
busca detalhe de contrato novo. A completa refaz também os vigentes, que podem
ter mudado de valor. Cada órgão vira uma linha `PNCP · Contratos · <órgão>` em
sync_log; a falha de um não impede os seguintes, nem a do PNCP fora do ar: a
busca dele cai em rajadas, e em 2026-09-30 parar no primeiro órgão que falhava
deixava os do fim da fila sem conferir contrato. O que limita a rodada é o
prazo (--prazo), passado o qual nenhum órgão novo começa.
"""

import argparse
import logging
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import db
import mapeamento as m
from coleta import registrar_falha
from config import ORGAOS
from pncp import Pncp

log = logging.getLogger("contratos")


# Na rápida, contrato fora do banco só é buscado se foi publicado há menos que
# isto. Os mais velhos são os de pessoa física, que o mapeamento descarta e
# por isso nunca entram (7 em 2026-10-01, rebuscados a cada rodada), ou os que
# uma rodada perdeu por falha — a completa diária pega estes.
NOVO = timedelta(days=30)


def precisa_detalhe(modo, id_pncp, conhecidos, hoje, publicado=None):
    """Contrato novo; na completa, também o conhecido ainda vigente.

    `publicado` é o dia da publicação no PNCP, da busca. Sem ele, o contrato
    fora do banco conta como novo.
    """
    if id_pncp not in conhecidos:
        return modo == "completa" or publicado is None or hoje - publicado <= NOVO
    fim = conhecidos[id_pncp]
    return modo == "completa" and (fim is None or fim >= hoje)


def coletar_orgao(api, banco, orgao_id, cnpj, modo, seco, hoje):
    """Devolve quantos contratos novos entraram."""
    conhecidos = db.contratos_conhecidos(banco.cursor(), cnpj) if banco else {}
    # Fecha a transação da leitura antes de esperar o PNCP: o Neon derruba
    # conexão com transação parada há 5 min.
    if banco:
        banco.commit()
    novos = 0
    for item in api.buscar_contratos(orgao_id):
        id_pncp = item["numero_controle_pncp"]
        publicado = m.data(item.get("data_publicacao_pncp"))
        publicado = publicado.date() if publicado else None
        if not precisa_detalhe(modo, id_pncp, conhecidos, hoje, publicado):
            continue
        ano, seq = item["ano"], item["numero_sequencial"]
        detalhe = api.contrato(cnpj, ano, seq)
        arquivos = api.arquivos_contrato(cnpj, ano, seq)
        empresa, linha = m.contrato(detalhe, arquivos) if detalhe else (None, None)
        if linha is None:
            log.info("  %s: sem detalhe ou fornecedor pessoa física, pulado", id_pncp)
            continue
        if seco:
            log.info("  [seco] %s · %s · %s", id_pncp, linha["numero"], empresa["razao_social"])
            continue
        # Um commit por contrato, como na coleta das compras.
        cur = banco.cursor()
        db.upsert_empresa(cur, empresa)
        novos += db.upsert_contrato(cur, linha)
        banco.commit()
    return novos


def coletar_orgaos(api, banco, alvos, modo, seco, hoje, prazo=None, relogio=time.monotonic):
    """Coleta os contratos de cada órgão. Devolve os nomes dos que falharam.

    `prazo` em segundos, contado daqui: depois dele nenhum órgão novo começa
    (o que já começou termina). Os que ficaram de fora mantêm a última linha
    em sync_log e entram na próxima rodada.
    """
    inicio = relogio()
    falhas = []
    for orgao_id, (cnpj, nome) in alvos.items():
        if prazo is not None and relogio() - inicio > prazo:
            log.warning("prazo esgotado: contratos de %s ficam para a próxima rodada", nome)
            break
        sync_id = None
        if banco:
            sync_id = db.abrir_sync(banco.cursor(), f"PNCP · Contratos · {nome}")
            banco.commit()
        try:
            novos = coletar_orgao(api, banco, orgao_id, cnpj, modo, seco, hoje)
            if banco:
                db.fechar_sync(banco.cursor(), sync_id, "ok", novos)
                banco.commit()
            log.info("%s: %d contratos novos", nome, novos)
        except Exception as erro:  # noqa: BLE001 — um órgão não derruba os outros
            if banco:
                registrar_falha(banco, sync_id, 0, erro)
            log.error("%s: FALHOU — %s", nome, erro)
            falhas.append(nome)
    return falhas


def main():
    p = argparse.ArgumentParser(description="Coleta contratos do PNCP.")
    p.add_argument("--orgao", type=int, help="só este orgao_id")
    p.add_argument("--seco", action="store_true", help="não grava, só relata")
    p.add_argument("--modo", choices=["rapida", "completa"], default="rapida")
    p.add_argument("--prazo", type=float, help="minutos; depois disso nenhum órgão novo começa")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.orgao and args.orgao not in ORGAOS:
        p.error(f"orgao_id {args.orgao} não está em config.ORGAOS")
    alvos = {args.orgao: ORGAOS[args.orgao]} if args.orgao else ORGAOS
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()

    banco = None if args.seco else db.Banco()
    prazo = args.prazo * 60 if args.prazo else None
    falhas = []
    db.interromper_no_sigterm()
    try:
        with Pncp() as api:
            falhas = coletar_orgaos(api, banco, alvos, args.modo, args.seco, hoje, prazo)
    except KeyboardInterrupt:
        if banco:
            db.interromper(banco)
        log.error("rodada interrompida")
        return 130
    finally:
        if banco:
            banco.close()

    if falhas:
        log.error("órgãos com falha: %s", ", ".join(falhas))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
