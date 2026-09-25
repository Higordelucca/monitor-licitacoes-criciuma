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
sync_log; a falha de um não impede os seguintes, a não ser o PNCP fora do ar.
"""

import argparse
import logging
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import db
import mapeamento as m
from coleta import registrar_falha
from config import ORGAOS
from pncp import Pncp, PncpFora

log = logging.getLogger("contratos")


def precisa_detalhe(modo, id_pncp, conhecidos, hoje):
    """Contrato novo sempre; na completa, também o conhecido ainda vigente."""
    if id_pncp not in conhecidos:
        return True
    fim = conhecidos[id_pncp]
    return modo == "completa" and (fim is None or fim >= hoje)


def coletar_orgao(api, banco, orgao_id, cnpj, modo, seco, hoje):
    """Devolve quantos contratos novos entraram."""
    conhecidos = db.contratos_conhecidos(banco.cursor(), cnpj) if banco else {}
    novos = 0
    for item in api.buscar_contratos(orgao_id):
        id_pncp = item["numero_controle_pncp"]
        if not precisa_detalhe(modo, id_pncp, conhecidos, hoje):
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


def main():
    p = argparse.ArgumentParser(description="Coleta contratos do PNCP.")
    p.add_argument("--orgao", type=int, help="só este orgao_id")
    p.add_argument("--seco", action="store_true", help="não grava, só relata")
    p.add_argument("--modo", choices=["rapida", "completa"], default="rapida")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.orgao and args.orgao not in ORGAOS:
        p.error(f"orgao_id {args.orgao} não está em config.ORGAOS")
    alvos = {args.orgao: ORGAOS[args.orgao]} if args.orgao else ORGAOS
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()

    banco = None if args.seco else db.Banco()
    falhas = []
    try:
        with Pncp() as api:
            for orgao_id, (cnpj, nome) in alvos.items():
                sync_id = None
                if banco:
                    sync_id = db.abrir_sync(banco.cursor(), f"PNCP · Contratos · {nome}")
                    banco.commit()
                try:
                    novos = coletar_orgao(api, banco, orgao_id, cnpj, args.modo, args.seco, hoje)
                    if banco:
                        db.fechar_sync(banco.cursor(), sync_id, "ok", novos)
                        banco.commit()
                    log.info("%s: %d contratos novos", nome, novos)
                except Exception as erro:  # noqa: BLE001 — um órgão não derruba os outros
                    if banco:
                        registrar_falha(banco, sync_id, 0, erro)
                    log.error("%s: FALHOU — %s", nome, erro)
                    falhas.append(nome)
                    if isinstance(erro, PncpFora):
                        log.error("PNCP fora do ar: rodada interrompida")
                        break
    finally:
        if banco:
            banco.close()

    if falhas:
        log.error("órgãos com falha: %s", ", ".join(falhas))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
