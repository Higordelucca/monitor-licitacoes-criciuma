"""Orquestração do enriquecimento com portal, API e banco falsos: não toca
rede nem banco."""

import csv
import io
import pathlib
import sys
from datetime import date

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import enriquecimento as en

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
HOJE = date(2026, 9, 24)


def linhas(nome):
    return list(csv.DictReader(
        io.StringIO((FIXTURES / nome).read_text(encoding="latin1")), delimiter=";"
    ))


class BancoFalso:
    """Banco que só anota o que o enriquecimento pediu para gravar."""

    def __init__(self, monkeypatch, conhecidos=(), pendentes=()):
        self.sancoes = {}
        self.empresas = []
        self.syncs = []
        self.passos = []
        monkeypatch.setattr(en.db, "cnpjs_conhecidos", lambda cur: set(conhecidos))
        monkeypatch.setattr(en.db, "empresas_para_enriquecer", lambda cur, limite: list(pendentes))
        monkeypatch.setattr(en.db, "sincronizar_sancoes", self._sincronizar)
        monkeypatch.setattr(en.db, "gravar_empresa", self._gravar)
        monkeypatch.setattr(en.db, "abrir_sync", self._abrir)
        monkeypatch.setattr(en.db, "fechar_sync", self._fechar)

    def cursor(self):
        return self

    def commit(self):
        self.passos.append("commit")

    def rollback(self):
        self.passos.append("rollback")

    def _sincronizar(self, cur, cadastro, achadas):
        self.sancoes[cadastro] = achadas
        return len(achadas), 0

    def _gravar(self, cur, empresa, socios):
        self.empresas.append(empresa["cnpj"])

    def _abrir(self, cur, fonte):
        self.syncs.append([fonte, "rodando", None])
        return len(self.syncs) - 1

    def _fechar(self, cur, sync_id, status, registros_novos=0, erro=None):
        self.syncs[sync_id][1:] = [status, erro]


class PortalFalso:
    def __init__(self, fora=()):
        self.fora = fora
        self.pedidos = []

    def lista(self, cadastro, hoje):
        self.pedidos.append(cadastro)
        if cadastro in self.fora:
            raise en.SemArquivo(f"{cadastro}: nada")
        return hoje, linhas(f"{cadastro.lower()}.csv")


@pytest.fixture(autouse=True)
def sem_pausa(monkeypatch):
    pausas = []
    monkeypatch.setattr(en.time, "sleep", pausas.append)
    return pausas


# --- sanções --------------------------------------------------------------


def test_so_guarda_sancao_de_empresa_nossa(monkeypatch):
    # O CEIS tem 23 mil linhas; só interessam as das empresas que já
    # aparecem em licitação de Criciúma (e a FK exige que a empresa exista).
    banco = BancoFalso(monkeypatch, conhecidos={"04394957000110"})
    assert en.sancoes(PortalFalso(), banco, HOJE) == []
    assert [s["chave"] for s in banco.sancoes["CEIS"]] == ["388108"]
    assert banco.sancoes["CNEP"] == [] and banco.sancoes["CEPIM"] == []


def test_lista_vazia_tambem_sincroniza(monkeypatch):
    # Sem nenhuma das nossas na lista, as sanções antigas daquele cadastro têm
    # de sair do banco: por isso sincronizar é chamado mesmo com lista vazia.
    banco = BancoFalso(monkeypatch)
    en.sancoes(PortalFalso(), banco, HOJE)
    assert set(banco.sancoes) == {"CEIS", "CNEP", "CEPIM"}


def test_cada_lista_tem_seu_sync_log(monkeypatch):
    banco = BancoFalso(monkeypatch)
    en.sancoes(PortalFalso(), banco, HOJE)
    assert [s[:2] for s in banco.syncs] == [
        ["Transparência · CEIS", "ok"],
        ["Transparência · CNEP", "ok"],
        ["Transparência · CEPIM", "ok"],
    ]


def test_falha_numa_lista_nao_derruba_as_outras(monkeypatch):
    banco = BancoFalso(monkeypatch)
    portal = PortalFalso(fora={"CNEP"})
    assert en.sancoes(portal, banco, HOJE) == ["Transparência · CNEP"]
    assert portal.pedidos == ["CEIS", "CNEP", "CEPIM"]
    assert banco.syncs[1][1:] == ["erro", "CNEP: nada"]
    assert "CNEP" not in banco.sancoes


# --- empresas -------------------------------------------------------------


class ApiFalsa:
    def __init__(self, respostas):
        self.respostas = respostas
        self.pedidos = []

    def cnpj(self, cnpj):
        self.pedidos.append(cnpj)
        resposta = self.respostas[cnpj]
        if isinstance(resposta, Exception):
            raise resposta
        return resposta


def cadastro(cnpj):
    return {"cnpj": cnpj, "razao_social": f"EMPRESA {cnpj}", "qsa": []}


def test_grava_as_pendentes_com_pausa_entre_elas(monkeypatch, sem_pausa):
    banco = BancoFalso(monkeypatch, pendentes=["11111111000111", "22222222000122"])
    api = ApiFalsa({c: cadastro(c) for c in ("11111111000111", "22222222000122")})
    assert en.empresas(api, banco, limite=None) == []
    assert banco.empresas == ["11111111000111", "22222222000122"]
    assert sem_pausa == [en.PAUSA]
    assert banco.syncs == [["CNPJ · BrasilAPI", "ok", None]]


def test_cnpj_que_a_receita_nao_conhece_e_pulado(monkeypatch):
    banco = BancoFalso(monkeypatch, pendentes=["11111111000111", "22222222000122"])
    api = ApiFalsa({"11111111000111": None, "22222222000122": cadastro("22222222000122")})
    assert en.empresas(api, banco, limite=None) == []
    assert banco.empresas == ["22222222000122"]


def test_brasilapi_fora_interrompe_as_empresas(monkeypatch):
    # As que ficaram sem cadastro continuam pendentes e entram na próxima.
    banco = BancoFalso(monkeypatch, pendentes=["11111111000111", "22222222000122"])
    api = ApiFalsa({"11111111000111": en.BrasilApiFora("503"), "22222222000122": cadastro("x")})
    assert en.empresas(api, banco, limite=None) == ["CNPJ · BrasilAPI"]
    assert api.pedidos == ["11111111000111"]
    assert banco.syncs[0][1:] == ["erro", "503"]
