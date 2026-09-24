"""Clientes da BrasilAPI e dos arquivos do Portal da Transparência, com
transporte falso: não toca rede."""

import io
import pathlib
import sys
import zipfile
from datetime import date

import httpx
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import brasilapi
import transparencia

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    esperas = []
    monkeypatch.setattr(brasilapi.time, "sleep", esperas.append)
    monkeypatch.setattr(transparencia.time, "sleep", esperas.append)
    return esperas


def com_transporte(cliente, responder):
    cliente._c = httpx.Client(transport=httpx.MockTransport(responder), follow_redirects=True)
    return cliente


# --- BrasilAPI --------------------------------------------------------------


def test_cnpj_devolve_o_json():
    api = com_transporte(brasilapi.BrasilApi(), lambda r: httpx.Response(200, json={"cnpj": "1"}))
    assert api.cnpj("27830943000106") == {"cnpj": "1"}


def test_cnpj_inexistente_devolve_none():
    # 404 é resposta, não falha: a Receita não conhece o CNPJ.
    api = com_transporte(brasilapi.BrasilApi(), lambda r: httpx.Response(404, json={}))
    assert api.cnpj("00000000000000") is None


def test_limite_de_requisicoes_espera_e_tenta_de_novo(sem_espera):
    respostas = iter([httpx.Response(429), httpx.Response(200, json={"ok": 1})])
    api = com_transporte(brasilapi.BrasilApi(), lambda r: next(respostas))
    assert api.cnpj("27830943000106") == {"ok": 1}
    assert len(sem_espera) == 1


def test_brasilapi_fora_depois_das_tentativas():
    chamadas = []

    def responder(request):
        chamadas.append(1)
        return httpx.Response(503)

    api = com_transporte(brasilapi.BrasilApi(), responder)
    with pytest.raises(brasilapi.BrasilApiFora):
        api.cnpj("27830943000106")
    assert len(chamadas) == brasilapi.TENTATIVAS


# --- Portal da Transparência -------------------------------------------------


def zip_de(nome_csv):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        z.writestr("20260923_CEIS.csv", (FIXTURES / nome_csv).read_bytes())
    return buffer.getvalue()


def test_arquivo_do_dia_anterior_quando_o_de_hoje_nao_saiu():
    # Em 2026-09-24 o arquivo do dia dava 403; só o de ontem existia.
    pedidos = []

    def responder(request):
        pedidos.append(request.url.path)
        if request.url.path.endswith("/20260923"):
            return httpx.Response(200, content=zip_de("ceis.csv"))
        return httpx.Response(403)

    portal = com_transporte(transparencia.Portal(), responder)
    dia, linhas = portal.lista("CEIS", hoje=date(2026, 9, 24))
    assert dia == date(2026, 9, 23)
    assert pedidos == ["/download-de-dados/ceis/20260924", "/download-de-dados/ceis/20260923"]
    assert [l["CÓDIGO DA SANÇÃO"] for l in linhas] == ["388108", "79145", "141028"]


def test_sem_arquivo_nos_ultimos_dias_e_erro():
    portal = com_transporte(transparencia.Portal(), lambda r: httpx.Response(403))
    with pytest.raises(transparencia.SemArquivo):
        portal.lista("CEIS", hoje=date(2026, 9, 24))


def test_queda_de_conexao_tenta_de_novo_o_mesmo_dia(sem_espera):
    tentativas = []

    def responder(request):
        tentativas.append(1)
        if len(tentativas) == 1:
            raise httpx.ReadError("Connection reset by peer", request=request)
        return httpx.Response(200, content=zip_de("ceis.csv"))

    portal = com_transporte(transparencia.Portal(), responder)
    dia, _ = portal.lista("CEIS", hoje=date(2026, 9, 24))
    assert dia == date(2026, 9, 24)
    assert len(sem_espera) == 1
