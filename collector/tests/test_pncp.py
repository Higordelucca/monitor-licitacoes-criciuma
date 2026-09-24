"""Retry do cliente HTTP, com transporte falso: não toca rede."""

import pathlib
import sys

import httpx
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import pncp


def cliente_que_falha(vezes):
    """Pncp cujas primeiras `vezes` requisições caem com connection reset."""
    chamadas = []

    def responder(request):
        chamadas.append(request.url)
        if len(chamadas) <= vezes:
            raise httpx.ReadError("Connection reset by peer", request=request)
        return httpx.Response(200, json={"items": [{"n": 1}], "total": 1})

    api = pncp.Pncp()
    api._c = httpx.Client(transport=httpx.MockTransport(responder))
    return api, chamadas


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    esperas = []
    monkeypatch.setattr(pncp.time, "sleep", esperas.append)
    return esperas


def test_busca_insiste_mais_que_os_detalhes(sem_espera):
    # Em 2026-09-23 a busca derrubava ~metade das conexões, alternando erro e
    # sucesso: seis tentativas seguidas falharam numa rodada do Actions.
    api, chamadas = cliente_que_falha(8)
    assert list(api.buscar_compras(85877)) == [{"n": 1}]
    assert len(chamadas) == 9


def test_espera_da_busca_cresce_mas_tem_teto(sem_espera):
    api, _ = cliente_que_falha(8)
    list(api.buscar_compras(85877))
    assert sem_espera == [1, 2, 4, 8, 16, 16, 16, 16]


def test_detalhe_desiste_depois_das_tentativas_normais():
    api, chamadas = cliente_que_falha(99)
    with pytest.raises(httpx.ReadError):
        api.historico("82916818000113", 2026, 194)
    assert len(chamadas) == pncp.TENTATIVAS
