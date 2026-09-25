"""Decisões da coleta incremental: o que refazer inteiro, o que conferir pelo
histórico e o que só atualizar com os dados da busca."""

import pathlib
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import incremental as inc

T0 = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)


# --- plano ---------------------------------------------------------------


def est(status, movimento=T0):
    return {"status": status, "ultimo_evento": movimento, "movimento": movimento}


def test_compra_que_nao_esta_no_banco_entra_completa():
    assert inc.plano("rapida", None, T0) == "completa"
    assert inc.plano("completa", None, T0) == "completa"


def test_modo_itens_refaz_so_quem_ainda_nao_tem_itens():
    # Carga dos itens que retoma de onde parou: `tudo` recomeçaria do zero.
    assert inc.plano("itens", dict(est("homologada"), tem_itens=False), T0) == "completa"
    assert inc.plano("itens", dict(est("aberta"), tem_itens=True), T0) == "leve"
    assert inc.plano("itens", None, T0) == "completa"


def test_na_rapida_so_confere_historico_de_quem_ainda_anda():
    for status in ("aberta", "em_analise", "suspensa"):
        assert inc.plano("rapida", est(status), T0) == "historico"
    for status in ("homologada", "encerrada"):
        assert inc.plano("rapida", est(status), T0) == "leve"


def test_na_rapida_em_analise_parada_ha_mais_de_180_dias_fica_para_a_completa():
    parada = T0 - timedelta(days=181)
    recente = T0 - timedelta(days=179)
    for status in ("em_analise", "suspensa"):
        assert inc.plano("rapida", est(status, parada), T0) == "leve"
        assert inc.plano("rapida", est(status, recente), T0) == "historico"
        assert inc.plano("rapida", est(status, None), T0) == "leve"


def test_aberta_e_conferida_mesmo_parada():
    # Prazo de proposta correndo: é o que mais importa não perder.
    assert inc.plano("rapida", est("aberta", T0 - timedelta(days=400)), T0) == "historico"
    assert inc.plano("rapida", est("aberta", None), T0) == "historico"


def test_na_completa_confere_historico_de_todas():
    for status in ("aberta", "em_analise", "homologada", "encerrada"):
        assert inc.plano("completa", est(status, T0 - timedelta(days=900)), T0) == "historico"


def test_modo_tudo_refaz_tudo_como_antes():
    assert inc.plano("tudo", est("homologada"), T0) == "completa"


# --- houve_novidade --------------------------------------------------------


def log(iso):
    return {"logManutencaoDataInclusao": iso}


def test_registro_mais_novo_que_o_ultimo_evento_e_novidade():
    # O PNCP manda horário de Brasília sem fuso: 09:30 em Brasília = 12:30 UTC.
    assert inc.houve_novidade([log("2026-09-23T09:30:00")], T0)


def test_registro_igual_ou_mais_antigo_nao_e_novidade():
    # 09:00 em Brasília = 12:00 UTC = T0.
    assert not inc.houve_novidade([log("2026-09-23T09:00:00"), log("2026-01-01T10:00:00")], T0)


def test_sem_evento_no_banco_qualquer_registro_e_novidade():
    assert inc.houve_novidade([log("2020-01-01T00:00:00")], None)


def test_historico_vazio_nunca_e_novidade():
    assert not inc.houve_novidade([], None)
    assert not inc.houve_novidade([], T0)


def test_registro_sem_data_e_ignorado():
    assert not inc.houve_novidade([{"logManutencaoDataInclusao": None}], T0)


# --- busca_mudou ------------------------------------------------------------


GRAVADO = {
    "status": "homologada",
    "modalidade": "Pregão - Eletrônico",
    "objeto": "Aquisição de papel",
    "secretaria": "PREFEITURA MUNICIPAL DE CRICIÚMA - SC",
    # O banco devolve em UTC; o mapeamento, em horário de Brasília.
    "data_publicacao": datetime(2026, 3, 2, 13, 0, tzinfo=timezone.utc),
    "data_abertura": None,
    "url_pncp": "https://pncp.gov.br/app/editais/82916818000113/2026/1",
}


def test_mesmos_dados_da_busca_nao_e_mudanca_mesmo_em_outro_fuso():
    linha = dict(GRAVADO, data_publicacao=datetime(2026, 3, 2, 10, 0, tzinfo=timezone(timedelta(hours=-3))))
    assert not inc.busca_mudou(linha, GRAVADO)


def test_qualquer_campo_da_busca_diferente_e_mudanca():
    for campo, valor in [("status", "encerrada"), ("objeto", "Outro"), ("data_abertura", T0)]:
        assert inc.busca_mudou(dict(GRAVADO, **{campo: valor}), GRAVADO), campo


def test_campo_fora_da_busca_nao_conta():
    # Valores e homologação vêm dos detalhes; o caminho leve não os grava.
    assert not inc.busca_mudou(dict(GRAVADO, valor_estimado=10), GRAVADO)
