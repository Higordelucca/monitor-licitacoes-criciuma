"""Orquestração da coleta de contratos com API falsa, em modo seco: não toca
banco nem rede."""

import json
import pathlib
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import contratos

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
HOJE = date(2026, 9, 25)
ID = "82916818000113-2-000001/2023"


def test_contrato_novo_busca_detalhe():
    assert contratos.precisa_detalhe("rapida", ID, {}, HOJE)


def test_contrato_conhecido_na_rapida_nao_busca_nada():
    assert not contratos.precisa_detalhe("rapida", ID, {ID: date(2029, 2, 18)}, HOJE)


def test_completa_confere_de_novo_so_os_vigentes():
    # Contrato em vigor pode ganhar aditivo e mudar de valor; o encerrado não muda.
    assert contratos.precisa_detalhe("completa", ID, {ID: date(2029, 2, 18)}, HOJE)
    assert contratos.precisa_detalhe("completa", ID, {ID: None}, HOJE)
    assert not contratos.precisa_detalhe("completa", ID, {ID: date(2025, 1, 1)}, HOJE)


class ApiFalsa:
    def __init__(self):
        self.chamadas = []

    def buscar_contratos(self, orgao_id):
        return json.loads((FIXTURES / "busca_contratos.json").read_text())["items"][:2]

    def contrato(self, cnpj, ano, seq):
        self.chamadas.append(("contrato", cnpj, str(ano), str(seq)))
        return json.loads((FIXTURES / "contrato.json").read_text())

    def arquivos_contrato(self, cnpj, ano, seq):
        self.chamadas.append(("arquivos", cnpj, str(ano), str(seq)))
        return []


def test_coleta_do_orgao_busca_o_detalhe_pelo_numero_da_busca():
    api = ApiFalsa()
    novos = contratos.coletar_orgao(api, None, 85877, "82916818000113", "rapida", True, HOJE)
    assert novos == 0  # seco não grava
    assert ("contrato", "82916818000113", "2023", "1") in api.chamadas
    assert ("arquivos", "82916818000113", "2023", "1") in api.chamadas
