"""Orquestração da coleta incremental com uma API falsa que conta chamadas.
Roda em modo seco: não toca banco nem rede."""

import pathlib
import sys
from datetime import datetime, timezone

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
    assert coleta.atualizar_leve(BancoFalso(), ITEM, dict(gravado, status="homologada"), False) == 0
    assert gravacoes.linhas == []


def test_leve_com_mudanca_grava(monkeypatch):
    gravacoes = Gravacoes(monkeypatch)
    gravado = dict(coleta.m.licitacao(ITEM, tem_resultado=True), objeto="Objeto antigo")
    assert coleta.atualizar_leve(BancoFalso(), ITEM, gravado, False) == 1
    assert [l["objeto"] for l in gravacoes.linhas] == ["Objeto de teste"]


def test_compra_nova_entra_completa():
    api = ApiFalsa([])
    _, acao = coleta.processar(api, None, ITEM, None, "rapida", True, ULTIMO)
    assert acao == "completa"
    assert "itens" in api.chamadas


def test_compra_completa_grava_os_itens_e_os_resultados(monkeypatch):
    itens = [{"numeroItem": 1, "temResultado": True}, {"numeroItem": 2, "temResultado": False}]
    resultado = {"numeroItem": 1, "valorTotalHomologado": 5}

    class Api(ApiFalsa):
        def itens(self, *_):
            return itens

        def resultados(self, *_):
            return [resultado]

    gravados = []
    monkeypatch.setattr(coleta.db, "upsert_licitacao", lambda cur, linha: (7, True))
    for nome in ("inserir_documentos", "inserir_eventos"):
        monkeypatch.setattr(coleta.db, nome, lambda cur, linhas: 0)
    monkeypatch.setattr(coleta.db, "upsert_empresa", lambda *a: None)
    monkeypatch.setattr(coleta.db, "upsert_participante", lambda *a: None)
    monkeypatch.setattr(coleta.db, "gravar_itens", lambda cur, lid, i, r: gravados.append((lid, i, r)))

    coleta.coletar_compra(Api([]), BancoFalso(), ITEM, False)
    assert gravados == [(7, itens, [resultado])]


# --- falha num órgão -------------------------------------------------------


class BancoFalso:
    def __init__(self):
        self.passos = []

    def cursor(self):
        return self

    def commit(self):
        self.passos.append("commit")

    def rollback(self):
        self.passos.append("rollback")


def test_falha_desfaz_a_compra_e_fica_no_sync_log(monkeypatch):
    banco = BancoFalso()
    monkeypatch.setattr(
        coleta.db, "fechar_sync", lambda cur, *args: banco.passos.append(("fechar_sync", args))
    )
    coleta.registrar_falha(banco, 7, 3, RuntimeError("PNCP fora"))
    assert banco.passos == ["rollback", ("fechar_sync", (7, "erro", 3, "PNCP fora")), "commit"]


class PncpForaDoAr:
    def __init__(self):
        self.orgaos = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def buscar_compras(self, orgao_id):
        self.orgaos.append(orgao_id)
        raise coleta.PncpFora("502 Bad Gateway")


def test_pncp_fora_do_ar_interrompe_a_rodada(monkeypatch):
    # Em 2026-09-24 o PNCP passou a madrugada devolvendo timeout e 502. Cada
    # órgão esgotava as tentativas de novo, e a rodada queimou 48 min.
    api = PncpForaDoAr()
    monkeypatch.setattr(coleta, "Pncp", lambda: api)
    monkeypatch.setattr(sys, "argv", ["coleta.py", "--seco"])
    assert coleta.main() == 1
    assert len(api.orgaos) == 1
