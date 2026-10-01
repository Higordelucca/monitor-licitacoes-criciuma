"""Orquestração da coleta de contratos com API falsa, em modo seco: não toca
banco nem rede."""

import json
import pathlib
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import contratos
from pncp import PncpFora

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
HOJE = date(2026, 9, 25)
ID = "82916818000113-2-000001/2023"


def test_contrato_novo_busca_detalhe():
    assert contratos.precisa_detalhe("rapida", ID, {}, HOJE)


def test_contrato_conhecido_na_rapida_nao_busca_nada():
    assert not contratos.precisa_detalhe("rapida", ID, {ID: date(2029, 2, 18)}, HOJE)


def test_na_rapida_contrato_fora_do_banco_e_antigo_fica_para_a_completa():
    # Contrato de pessoa física nunca entra no banco, e a rápida buscava o
    # detalhe dos 7 a cada rodada; em 2026-10-01 um deles derrubou o
    # CriciúmaPrev. Novo de verdade é o publicado há pouco.
    assert contratos.precisa_detalhe("rapida", ID, {}, HOJE, publicado=date(2026, 9, 1))
    assert not contratos.precisa_detalhe("rapida", ID, {}, HOJE, publicado=date(2026, 8, 1))
    assert contratos.precisa_detalhe("completa", ID, {}, HOJE, publicado=date(2024, 1, 1))


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
    # Completa: o contrato da fixture é de 2023, e a rápida só busca os recentes.
    novos = contratos.coletar_orgao(api, None, 85877, "82916818000113", "completa", True, HOJE)
    assert novos == 0  # seco não grava
    assert ("contrato", "82916818000113", "2023", "1") in api.chamadas
    assert ("arquivos", "82916818000113", "2023", "1") in api.chamadas


def test_leitura_dos_conhecidos_nao_deixa_transacao_aberta_esperando_o_pncp(monkeypatch):
    # Mesmo caso da coleta das compras: o Neon derruba a conexão com transação
    # parada há 5 min, e a busca mais os detalhes passam disso.
    passos = []

    class Banco:
        def cursor(self):
            return self

        def commit(self):
            passos.append("commit")

    class Api(ApiFalsa):
        def buscar_contratos(self, orgao_id):
            passos.append("busca")
            return []

    monkeypatch.setattr(
        contratos.db, "contratos_conhecidos", lambda cur, cnpj: passos.append("conhecidos") or {}
    )
    contratos.coletar_orgao(Api(), Banco(), 85877, "82916818000113", "rapida", False, HOJE)
    assert passos == ["conhecidos", "commit", "busca"]


# --- vários órgãos, falha e prazo --------------------------------------------

ALVOS = {1: ("11111111000111", "A"), 2: ("22222222000122", "B"), 3: ("33333333000133", "C")}


class ApiPorOrgao(ApiFalsa):
    """A busca do órgão em `fora` esgota as tentativas; cada busca avança o
    relógio em `custo` segundos."""

    def __init__(self, fora=(), relogio=None, custo=0):
        super().__init__()
        self.fora, self.relogio, self.custo = set(fora), relogio, custo
        self.buscados = []

    def buscar_contratos(self, orgao_id):
        self.buscados.append(orgao_id)
        if self.relogio:
            self.relogio[0] += self.custo
        if orgao_id in self.fora:
            raise PncpFora("https://pncp.gov.br/api/search/: [Errno 104] Connection reset by peer")
        return []


def test_busca_que_cai_num_orgao_nao_impede_os_seguintes():
    # Em 2026-09-30 a busca caiu nos contratos da Fundação Cultural e a
    # rodada parou ali: quatro órgãos ficaram sem conferir contrato.
    api = ApiPorOrgao(fora={2})
    falhas = contratos.coletar_orgaos(api, None, ALVOS, "rapida", True, HOJE)
    assert api.buscados == [1, 2, 3]
    assert falhas == ["B"]


def test_passado_o_prazo_nenhum_orgao_novo_comeca():
    agora = [0.0]
    api = ApiPorOrgao(fora={1, 2, 3}, relogio=agora, custo=95)
    falhas = contratos.coletar_orgaos(
        api, None, ALVOS, "rapida", True, HOJE, prazo=150, relogio=lambda: agora[0]
    )
    # A começa em 0 s e B em 95 s, dentro do prazo; C começaria em 190 s.
    assert api.buscados == [1, 2]
    assert falhas == ["A", "B"]


def test_sem_prazo_todos_os_orgaos_rodam():
    agora = [0.0]
    api = ApiPorOrgao(relogio=agora, custo=1000)
    contratos.coletar_orgaos(api, None, ALVOS, "completa", True, HOJE, relogio=lambda: agora[0])
    assert api.buscados == [1, 2, 3]
