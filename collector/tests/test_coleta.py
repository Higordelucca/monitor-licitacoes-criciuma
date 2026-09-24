"""Orquestração da coleta incremental com uma API falsa que conta chamadas.
Roda em modo seco: não toca banco nem rede."""

import contextlib
import pathlib
import sys
from datetime import datetime, timezone

import psycopg
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import coleta

ITEM = {
    "numero_controle_pncp": "82916818000113-1-000001/2026",
    "orgao_cnpj": "82916818000113",
    "ano": "2026",
    "numero_sequencial": "1",
    "description": "Objeto de teste",
    "situacao_nome": "Divulgada no PNCP",
}
ULTIMO = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)


def estado(status):
    return {"status": status, "ultimo_evento": ULTIMO, "movimento": ULTIMO}


class ApiFalsa:
    def __init__(self, historico):
        self._historico = historico
        self.chamadas = []

    def historico(self, *_):
        self.chamadas.append("historico")
        return self._historico

    def itens(self, *_):
        self.chamadas.append("itens")
        return []

    def arquivos(self, *_):
        self.chamadas.append("arquivos")
        return []

    def resultados(self, *_):
        self.chamadas.append("resultados")
        return []


def test_homologada_na_rapida_nao_faz_nenhuma_requisicao():
    api = ApiFalsa([])
    _, acao = coleta.processar(api, None, ITEM, estado("homologada"), "rapida", True, ULTIMO)
    assert acao == "leve"
    assert api.chamadas == []


def test_em_analise_sem_novidade_so_confere_o_historico():
    api = ApiFalsa([{"logManutencaoDataInclusao": "2026-09-01T10:00:00"}])
    _, acao = coleta.processar(api, None, ITEM, estado("em_analise"), "rapida", True, ULTIMO)
    assert acao == "leve"
    assert api.chamadas == ["historico"]


def test_com_novidade_busca_o_resto_sem_repetir_o_historico():
    api = ApiFalsa([{"logManutencaoDataInclusao": "2026-09-23T15:00:00"}])
    _, acao = coleta.processar(api, None, ITEM, estado("em_analise"), "rapida", True, ULTIMO)
    assert acao == "completa"
    assert api.chamadas.count("historico") == 1
    assert "itens" in api.chamadas


class Gravacoes:
    def __init__(self, monkeypatch):
        self.linhas = []
        monkeypatch.setattr(coleta.db, "atualizar_da_busca", self._gravar)

    def _gravar(self, cur, linha):
        self.linhas.append(linha)
        return True


def test_leve_sem_mudanca_nao_vai_ao_banco(monkeypatch):
    # Cada ida ao Neon custava ~0,5 s a partir do runner do GitHub, e a rodada
    # rápida passava ~9 min só atualizando linhas que não tinham mudado.
    gravacoes = Gravacoes(monkeypatch)
    gravado = coleta.m.licitacao(ITEM, tem_resultado=True)
    assert coleta.atualizar_leve(None, ITEM, dict(gravado, status="homologada"), False) == 0
    assert gravacoes.linhas == []


def test_leve_com_mudanca_grava(monkeypatch):
    gravacoes = Gravacoes(monkeypatch)
    gravado = dict(coleta.m.licitacao(ITEM, tem_resultado=True), objeto="Objeto antigo")
    assert coleta.atualizar_leve(None, ITEM, gravado, False) == 1
    assert [l["objeto"] for l in gravacoes.linhas] == ["Objeto de teste"]


def test_compra_nova_entra_completa():
    api = ApiFalsa([])
    _, acao = coleta.processar(api, None, ITEM, None, "rapida", True, ULTIMO)
    assert acao == "completa"
    assert "itens" in api.chamadas


# --- falha num órgão -------------------------------------------------------


class ConexaoFalsa:
    def __init__(self, rollback_quebra=False):
        self.rollback_quebra = rollback_quebra
        self.fechada = False
        self.commits = 0

    def rollback(self):
        if self.rollback_quebra:
            raise psycopg.InternalError("received 2 results from command 'ROLLBACK'")

    def cursor(self):
        return contextlib.nullcontext(self)

    def commit(self):
        self.commits += 1

    def close(self):
        self.fechada = True


@pytest.fixture
def sync_fechado(monkeypatch):
    registros = []
    monkeypatch.setattr(coleta.db, "fechar_sync", lambda cur, *args: registros.append((cur, args)))
    return registros


def test_falha_fica_no_sync_log(sync_fechado):
    conexao = ConexaoFalsa()
    assert coleta.registrar_falha(conexao, 7, 3, RuntimeError("PNCP fora")) is conexao
    assert sync_fechado == [(conexao, (7, "erro", 3, "PNCP fora"))]
    assert conexao.commits == 1


def test_conexao_perdida_e_refeita_para_registrar_a_falha(monkeypatch, sync_fechado):
    # Em 2026-09-23 o ROLLBACK falhou depois de ~8 min sem consulta, esperando
    # o PNCP, e derrubou a coleta inteira em vez de seguir para o próximo órgão.
    velha, nova = ConexaoFalsa(rollback_quebra=True), ConexaoFalsa()
    monkeypatch.setattr(coleta.db, "conectar", lambda: nova)
    assert coleta.registrar_falha(velha, 7, 0, RuntimeError("timed out")) is nova
    assert velha.fechada
    assert sync_fechado == [(nova, (7, "erro", 0, "timed out"))]
