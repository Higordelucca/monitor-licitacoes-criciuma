"""Testes das traduções, sobre JSON real do PNCP guardado em fixtures/.
Nenhum toca rede: o PNCP cai com frequência e um teste que depende dele
não serve para dizer se o nosso código está certo."""

import json
import pathlib
import sys
from datetime import datetime, timezone
from decimal import Decimal

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import mapeamento as m

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


def carregar(nome):
    return json.loads((FIXTURES / nome).read_text())


@pytest.fixture
def busca():
    return carregar("busca_encerradas.json")["items"]


# --- datas ---------------------------------------------------------------


def test_data_sem_fuso_assume_brasilia():
    # O PNCP manda '2022-06-15T21:47:19' sem fuso. Lido como UTC, viraria
    # 18:47 em Brasília — três horas de erro na hora de abertura.
    d = m.data("2022-06-15T21:47:19")
    assert d.utcoffset().total_seconds() == -3 * 3600
    assert d.hour == 21


def test_data_com_fuso_e_respeitada():
    d = m.data("2026-09-22T10:17:14.749627-03:00")
    assert d.utcoffset().total_seconds() == -3 * 3600


@pytest.mark.parametrize("entrada", [None, "", "nao e data"])
def test_data_invalida_vira_none(entrada):
    assert m.data(entrada) is None


# --- status --------------------------------------------------------------


def test_revogada_e_anulada_viram_encerrada():
    assert m.status_licitacao("Revogada", None, False) == "encerrada"
    assert m.status_licitacao("Anulada", None, False) == "encerrada"


def test_suspensa():
    assert m.status_licitacao("Suspensa", None, False) == "suspensa"


def test_situacao_terminal_ignora_prazo_em_aberto():
    # Revogada com prazo ainda correndo continua encerrada.
    futuro = "2099-01-01T00:00:00"
    assert m.status_licitacao("Revogada", futuro, False) == "encerrada"


def test_prazo_no_futuro_e_aberta():
    futuro = "2099-01-01T00:00:00"
    assert m.status_licitacao("Divulgada no PNCP", futuro, False) == "aberta"


def test_prazo_vencido_sem_resultado_e_em_analise():
    assert m.status_licitacao("Divulgada no PNCP", "2020-01-01T00:00:00", False) == "em_analise"


def test_prazo_vencido_com_resultado_e_homologada():
    assert m.status_licitacao("Divulgada no PNCP", "2020-01-01T00:00:00", True) == "homologada"


def test_status_usa_o_agora_que_recebe():
    agora = datetime(2026, 6, 1, tzinfo=timezone.utc)
    assert m.status_licitacao("Divulgada no PNCP", "2026-07-01T00:00:00", False, agora) == "aberta"
    assert m.status_licitacao("Divulgada no PNCP", "2026-05-01T00:00:00", False, agora) == "em_analise"


# --- licitação -----------------------------------------------------------


def test_licitacao_preenche_os_campos_do_esquema(busca):
    linha = m.licitacao(busca[0])
    assert linha["id_pncp"] == busca[0]["numero_controle_pncp"]
    assert linha["objeto"]
    assert linha["url_pncp"].startswith("https://pncp.gov.br/")
    assert linha["status"] in {"aberta", "em_analise", "homologada", "suspensa", "encerrada"}


def test_url_pncp_aponta_para_a_pagina_do_edital_no_portal(busca):
    # O item_url da busca (/compras/{cnpj}/{ano}/{seq}) dá 404 no portal. A rota
    # da página foi conferida no código do próprio portal em 2026-09-23:
    # /app/editais/:cnpj/:ano/:sequencial.
    assert busca[0]["item_url"] == "/compras/82916818000113/2022/1"
    assert m.licitacao(busca[0])["url_pncp"] == "https://pncp.gov.br/app/editais/82916818000113/2022/1"


def test_url_pncp_sem_dados_de_identificacao_fica_nula():
    assert m.licitacao({"numero_controle_pncp": "x", "description": "y"})["url_pncp"] is None


def test_toda_licitacao_da_fixture_gera_status_valido(busca):
    validos = {"aberta", "em_analise", "homologada", "suspensa", "encerrada"}
    for item in busca:
        assert m.licitacao(item)["status"] in validos


def test_ano_vira_inteiro(busca):
    assert isinstance(m.licitacao(busca[0])["ano"], int)


# --- valores -------------------------------------------------------------


def test_valor_estimado_soma_os_itens_reais():
    itens = carregar("itens_com_resultado.json")
    esperado = sum(Decimal(str(i["valorTotal"])) for i in itens if not i.get("orcamentoSigiloso"))
    assert m.valor_estimado(itens) == esperado
    assert m.valor_estimado(itens) > 0


def test_valor_usa_decimal_e_nao_float():
    # 0.1 + 0.2 em float daria 0.30000000000000004, e isso vira centavo errado
    # ao somar centenas de itens.
    itens = [{"valorTotal": 0.1}, {"valorTotal": 0.2}]
    assert m.valor_estimado(itens) == Decimal("0.3")
    assert isinstance(m.valor_estimado(itens), Decimal)


def test_item_com_orcamento_sigiloso_e_pulado():
    itens = [{"valorTotal": 100}, {"valorTotal": 0, "orcamentoSigiloso": True}]
    assert m.valor_estimado(itens) == Decimal(100)


def test_sem_nada_somavel_devolve_none():
    # None é diferente de zero: 'não sabemos' não é 'custa nada'.
    assert m.valor_estimado([]) is None
    assert m.valor_estimado([{"valorTotal": None}]) is None
    assert m.valor_estimado([{"valorTotal": 0, "orcamentoSigiloso": True}]) is None


def test_valor_homologado_soma_os_resultados_reais():
    resultados = carregar("resultados.json")
    assert m.valor_homologado(resultados) == Decimal("748.4")


def test_licitacao_carrega_os_valores_recebidos(busca):
    linha = m.licitacao(busca[0], estimado=Decimal("10.5"), homologado=Decimal("9"))
    assert linha["valor_estimado"] == Decimal("10.5")
    assert linha["valor_homologado"] == Decimal("9")


def test_licitacao_sem_valores_fica_nula(busca):
    linha = m.licitacao(busca[0])
    assert linha["valor_estimado"] is None
    assert linha["valor_homologado"] is None


# --- documentos e eventos ------------------------------------------------


def test_documento_tem_url_e_titulo():
    for arquivo in carregar("arquivos.json"):
        linha = m.documento(arquivo, 1)
        assert linha["url"]
        assert linha["titulo"]
        assert linha["licitacao_id"] == 1


def test_evento_tem_data_e_tipo():
    for log in carregar("historico.json"):
        linha = m.evento(log, 7)
        assert linha["data"] is not None
        assert linha["tipo"]
        assert linha["fonte"] == "PNCP"


# --- participantes -------------------------------------------------------


def test_participante_extrai_empresa_e_vinculo():
    resultado = carregar("resultados.json")[0]
    empresa, vinculo = m.participante(resultado, 42)
    assert empresa["cnpj"] == "22627453000185"
    assert len(empresa["cnpj"]) == 14
    assert empresa["razao_social"]
    assert vinculo["licitacao_id"] == 42
    assert vinculo["situacao"] == "vencedora"


def test_pessoa_fisica_e_descartada():
    # CPF tem 11 dígitos e não cabe em empresas.cnpj, que é char(14).
    pf = {"tipoPessoa": "PF", "niFornecedor": "12345678901",
          "nomeRazaoSocialFornecedor": "Fulano"}
    assert m.participante(pf, 1) == (None, None)


def test_cnpj_com_mascara_e_normalizado():
    pj = {"tipoPessoa": "PJ", "niFornecedor": "22.627.453/0001-85",
          "nomeRazaoSocialFornecedor": "X", "ordemClassificacaoSrp": 2}
    empresa, vinculo = m.participante(pj, 1)
    assert empresa["cnpj"] == "22627453000185"
    assert vinculo["situacao"] == "habilitada"
