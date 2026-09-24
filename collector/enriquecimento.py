"""Enriquecimento das empresas (fase 3): cadastro pela BrasilAPI e sanções
pelos arquivos diários do Portal da Transparência.

    python collector/enriquecimento.py                 sanções e empresas
    python collector/enriquecimento.py --so sancoes    só as três listas
    python collector/enriquecimento.py --so empresas   só o cadastro
    python collector/enriquecimento.py --limite 5      no máximo 5 empresas

Roda uma vez por dia, depois da coleta completa. Empresa entra quando é nova
(`atualizado_em` nulo) ou quando o cadastro tem mais de 30 dias. Sanções são
refeitas inteiras a cada dia, lista por lista. Cada lista e o cadastro viram
uma linha em sync_log; a falha de um não impede os outros, e o processo sai com
código 1 no fim para o Actions marcar a rodada como falha.
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import db
import mapeamento as m
from brasilapi import BrasilApi, BrasilApiFora
from coleta import registrar_falha
from transparencia import Portal, SemArquivo

log = logging.getLogger("enriquecimento")

LISTAS = ("CEIS", "CNEP", "CEPIM")

# Segundos entre uma empresa e outra. A BrasilAPI não documenta o limite; a
# primeira carga são ~700 empresas, ~12 min neste ritmo.
PAUSA = 1


def sancoes(portal, banco, hoje):
    """Sincroniza as três listas. Devolve as fontes que falharam."""
    conhecidos = db.cnpjs_conhecidos(banco.cursor())
    banco.commit()
    falhas = []
    for cadastro in LISTAS:
        fonte = f"Transparência · {cadastro}"
        sync_id = db.abrir_sync(banco.cursor(), fonte)
        banco.commit()
        try:
            dia, linhas = portal.lista(cadastro, hoje)
            achadas = [
                s for s in (m.sancao(cadastro, l) for l in linhas)
                if s and s["cnpj"] in conhecidos
            ]
            novas, saidas = db.sincronizar_sancoes(banco.cursor(), cadastro, achadas)
            db.fechar_sync(banco.cursor(), sync_id, "ok", novas)
            banco.commit()
            log.info(
                "%s: arquivo de %s, %d sanções de empresas nossas (%d novas, %d saíram)",
                cadastro, dia, len(achadas), novas, saidas,
            )
        except Exception as erro:  # noqa: BLE001 — uma lista não derruba as outras
            registrar_falha(banco, sync_id, 0, erro)
            log.error("%s: FALHOU — %s", cadastro, erro)
            falhas.append(fonte)
    return falhas


def empresas(api, banco, limite):
    """Busca o cadastro das empresas pendentes. Devolve as fontes que falharam."""
    fonte = "CNPJ · BrasilAPI"
    pendentes = db.empresas_para_enriquecer(banco.cursor(), limite)
    sync_id = db.abrir_sync(banco.cursor(), fonte)
    banco.commit()
    feitas = 0
    try:
        for i, cnpj in enumerate(pendentes):
            if i:
                time.sleep(PAUSA)
            dados = api.cnpj(cnpj)
            if dados is None:
                log.warning("%s: a Receita não conhece este CNPJ", cnpj)
                continue
            db.gravar_empresa(banco.cursor(), m.empresa_brasilapi(dados), m.socios_brasilapi(dados))
            banco.commit()
            feitas += 1
        db.fechar_sync(banco.cursor(), sync_id, "ok", feitas)
        banco.commit()
        log.info("empresas: %d de %d pendentes atualizadas", feitas, len(pendentes))
        return []
    except Exception as erro:  # noqa: BLE001 — as pendentes entram na próxima
        registrar_falha(banco, sync_id, feitas, erro)
        log.error("empresas: FALHOU depois de %d — %s", feitas, erro)
        return [fonte]


def main():
    p = argparse.ArgumentParser(description="Cadastro e sanções das empresas.")
    p.add_argument("--so", choices=["sancoes", "empresas"], help="roda só uma parte")
    p.add_argument("--limite", type=int, help="máximo de empresas nesta rodada")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    # Uma linha por requisição afoga o relato; falha e retry continuam aparecendo.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    banco = db.Banco()
    falhas = []
    try:
        if args.so != "empresas":
            with Portal() as portal:
                falhas += sancoes(portal, banco, hoje)
        if args.so != "sancoes":
            with BrasilApi() as api:
                falhas += empresas(api, banco, args.limite)
    finally:
        banco.close()
    if falhas:
        log.error("com falha: %s", ", ".join(falhas))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
