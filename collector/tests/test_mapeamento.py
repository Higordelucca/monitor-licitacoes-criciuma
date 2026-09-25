"""Testes das traduções, sobre JSON real do PNCP guardado em fixtures/.
Nenhum toca rede: o PNCP cai com frequência e um teste que depende dele
não serve para dizer se o nosso código está certo."""

import csv
import io
import json
import pathlib
import sys
from datetime import date, datetime, timezone
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


# --- itens e resultados por item -------------------------------------------


def test_item_traz_os_campos_do_esquema():
    item = carregar("itens_com_resultado.json")[0]
    linha = m.item(item, 42)
    assert linha["licitacao_id"] == 42
    assert linha["numero"] == 1
    assert linha["descricao"].startswith("Microtubo")
    assert linha["tipo"] == "M"
    assert linha["quantidade"] == Decimal("10.0")
    assert linha["unidade"] == "PACOTE"
    assert linha["valor_unitario_estimado"] == Decimal("80.64")
    assert linha["valor_total_estimado"] == Decimal("806.4")
    assert linha["sigiloso"] is False
    assert linha["situacao"] == "Homologado"
    assert linha["criterio_julgamento"] == "Menor preço"


def test_item_sigiloso_fica_sem_valor_estimado():
    # O PNCP manda zero no lugar do orçamento sigiloso; zero diria "custa nada".
    item = {"numeroItem": 3, "orcamentoSigiloso": True,
            "valorUnitarioEstimado": 0, "valorTotal": 0}
    linha = m.item(item, 1)
    assert linha["sigiloso"] is True
    assert linha["valor_unitario_estimado"] is None
    assert linha["valor_total_estimado"] is None


def test_resultado_de_empresa_traz_empresa_e_linha():
    resultado = carregar("resultados.json")[0]
    empresa, linha = m.resultado_item(resultado)
    assert empresa["cnpj"] == "22627453000185"
    assert linha["numero_item"] == 1
    assert linha["cnpj"] == "22627453000185"
    assert linha["tipo_pessoa"] == "PJ"
    assert linha["ordem"] == 1
    assert linha["quantidade_homologada"] == Decimal("10.0")
    assert linha["valor_unitario_homologado"] == Decimal("74.84")
    assert linha["valor_total_homologado"] == Decimal("748.4")
    assert linha["data_resultado"] == date(2022, 6, 15)
    assert linha["situacao"] == "Informado"


def test_resultado_de_pessoa_fisica_fica_sem_cnpj_e_sem_empresa():
    # O item teve vencedor; só não guardamos o CPF nem o nome da pessoa.
    pf = {"numeroItem": 2, "tipoPessoa": "PF", "niFornecedor": "12345678901",
          "nomeRazaoSocialFornecedor": "Fulano", "valorTotalHomologado": 10}
    empresa, linha = m.resultado_item(pf)
    assert empresa is None
    assert linha["cnpj"] is None
    assert linha["tipo_pessoa"] == "PF"
    assert "Fulano" not in str(linha)


def test_criterio_unico_quando_todos_os_itens_concordam():
    itens = carregar("itens_com_resultado.json")
    assert m.criterio_unico(itens) == "Menor preço"


def test_criterio_misto_ou_ausente_fica_nulo():
    misto = [{"criterioJulgamentoNome": "Menor preço"},
             {"criterioJulgamentoNome": "Maior desconto"}]
    assert m.criterio_unico(misto) is None
    assert m.criterio_unico([]) is None
    assert m.criterio_unico([{"criterioJulgamentoNome": None}]) is None


# --- enriquecimento: BrasilAPI --------------------------------------------
# Resposta real de 2026-09-24; nome, telefone e endereço do sócio trocados por
# marcador, porque o repositório é público.


@pytest.fixture
def cnpj_api():
    return carregar("brasilapi_cnpj.json")


def test_empresa_da_brasilapi(cnpj_api):
    e = m.empresa_brasilapi(cnpj_api)
    assert e["cnpj"] == "27830943000106"
    assert e["razao_social"] == "LAURETH IMPORTACAO E SERVICOS LTDA"
    assert e["porte"] == "MICRO EMPRESA"
    assert e["situacao_cadastral"] == "ATIVA"
    assert e["data_abertura"] == date(2017, 5, 26)
    assert e["municipio"] == "CRICIUMA"
    assert e["uf"] == "SC"
    assert e["capital_social"] == Decimal("100000")


def test_cnae_leva_codigo_e_descricao(cnpj_api):
    # Só o código (4751201) não diz nada a quem lê a Ficha.
    assert m.empresa_brasilapi(cnpj_api)["cnae_principal"] == (
        "4751201 · Comércio varejista especializado de equipamentos e "
        "suprimentos de informática"
    )


def test_nome_fantasia_vazio_vira_nulo(cnpj_api):
    # A Receita manda "" quando não há nome fantasia; "" na tela é um buraco.
    assert m.empresa_brasilapi(cnpj_api)["nome_fantasia"] is None


def test_socios_da_brasilapi(cnpj_api):
    assert m.socios_brasilapi(cnpj_api) == [
        {
            "cnpj": "27830943000106",
            "nome": "FULANO DE TAL",
            "qualificacao": "Sócio-Administrador",
            "data_entrada": date(2021, 9, 1),
        }
    ]


def test_socio_nao_guarda_cpf(cnpj_api):
    # O CPF vem mascarado e é dado pessoal que a tela não usa.
    assert all("cpf" not in chave for s in m.socios_brasilapi(cnpj_api) for chave in s)


def test_empresa_sem_qsa_nao_tem_socios(cnpj_api):
    cnpj_api["qsa"] = None
    assert m.socios_brasilapi(cnpj_api) == []


# --- enriquecimento: sanções do Portal da Transparência --------------------
# Linhas reais dos arquivos de 2026-09-23 (CSV em latin-1, separado por ;).


def lista(nome):
    return list(csv.DictReader(
        io.StringIO((FIXTURES / nome).read_text(encoding="latin1")), delimiter=";"
    ))


def test_sancao_do_ceis():
    s = m.sancao("CEIS", lista("ceis.csv")[0])
    assert s["cnpj"] == "04394957000110"
    assert s["cadastro"] == "CEIS"
    assert s["chave"] == "388108"
    assert s["data_fim"] == date(2027, 5, 15)
    assert s["categoria"]
    assert s["orgao_sancionador"]


def test_sancao_sem_data_final_fica_sem_fim():
    s = m.sancao("CEIS", lista("ceis.csv")[1])
    assert s["data_fim"] is None


def test_abrangencia_sem_informacao_vira_nula():
    # Um terço do CEIS vem "Sem Informação". Nulo deixa a tela dizer "não
    # informada" em vez de repetir o jargão do arquivo.
    linha = dict(lista("ceis.csv")[0], **{"ABRAGÊNCIA DA SANÇÃO": "Sem Informação"})
    assert m.sancao("CEIS", linha)["abrangencia"] is None


def test_sancao_de_pessoa_fisica_e_descartada():
    # Mesmo motivo do participante PF: CPF não cabe em empresas.cnpj.
    linha = dict(lista("ceis.csv")[0], **{
        "TIPO DE PESSOA": "F", "CPF OU CNPJ DO SANCIONADO": "48342491749",
    })
    assert m.sancao("CEIS", linha) is None


def test_sancao_do_cnep():
    s = m.sancao("CNEP", lista("cnep.csv")[0])
    assert (s["cnpj"], s["cadastro"], s["chave"]) == ("06217047000198", "CNEP", "277922")


def test_cepim_usa_cnpj_e_convenio_como_chave():
    # O CEPIM não tem código de sanção nem datas; o impedimento é por convênio.
    s = m.sancao("CEPIM", lista("cepim.csv")[0])
    assert s["cnpj"] == "04764289000176"
    assert s["chave"] == "04764289000176-576259"
    assert s["descricao"] == "NAO APRESENTACAO DE DOCUMENTACAO COMPLEMENTAR"
    assert s["orgao_sancionador"].startswith("Ministério da Cultura")
    assert s["data_inicio"] is None and s["data_fim"] is None
