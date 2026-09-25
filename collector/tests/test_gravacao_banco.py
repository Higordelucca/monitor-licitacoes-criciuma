"""Gravação dos itens contra o Neon de verdade, dentro de uma transação que
sempre é desfeita. Fica fora do `pytest` comum, que não usa rede:

    TESTAR_BANCO=1 .venv/bin/python -m pytest collector/tests/test_gravacao_banco.py -q
"""

import json
import os
import pathlib
import sys

from types import SimpleNamespace

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import db
import mapeamento as m

pytestmark = pytest.mark.skipif(not os.environ.get("TESTAR_BANCO"), reason="só com TESTAR_BANCO=1")

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
PF = {"numeroItem": 2, "tipoPessoa": "PF", "niFornecedor": "12345678901",
      "nomeRazaoSocialFornecedor": "Fulano", "valorTotalHomologado": 10, "ordemClassificacaoSrp": 1}


@pytest.fixture
def b():
    conexao = db.conectar()
    try:
        cursor = conexao.cursor()
        cursor.execute(
            """insert into licitacoes (id_pncp, objeto, status)
               values ('00000000000000-1-999999/1900', 'teste', 'em_analise') returning id"""
        )
        yield SimpleNamespace(cur=cursor, id=cursor.fetchone()[0])
    finally:
        conexao.rollback()
        conexao.close()


def dados():
    itens = json.loads((FIXTURES / "itens_com_resultado.json").read_text())
    resultados = json.loads((FIXTURES / "resultados.json").read_text()) + [PF]
    return itens, resultados


def contar(b, sql):
    b.cur.execute(sql, {"id": b.id})
    return b.cur.fetchone()[0]


ITENS = "select count(*) from itens where licitacao_id = %(id)s"
RESULTADOS = """select count(*) from resultados_item r join itens i on i.id = r.item_id
                where i.licitacao_id = %(id)s"""


def test_grava_itens_e_resultados(b):
    itens, resultados = dados()
    db.gravar_itens(b.cur, b.id, itens, resultados)
    assert contar(b, ITENS) == len(itens)
    assert contar(b, RESULTADOS) == 2
    b.cur.execute(
        """select r.cnpj, r.tipo_pessoa from resultados_item r join itens i on i.id = r.item_id
           where i.licitacao_id = %s and i.numero = 2""",
        (b.id,),
    )
    assert b.cur.fetchone() == (None, "PF")


def test_gravar_de_novo_nao_duplica(b):
    itens, resultados = dados()
    db.gravar_itens(b.cur, b.id, itens, resultados)
    db.gravar_itens(b.cur, b.id, itens, resultados)
    assert contar(b, ITENS) == len(itens)
    assert contar(b, RESULTADOS) == 2


def test_resultado_que_saiu_do_pncp_sai_do_banco(b):
    itens, resultados = dados()
    db.gravar_itens(b.cur, b.id, itens, resultados)
    db.gravar_itens(b.cur, b.id, itens, resultados[:1])
    assert contar(b, RESULTADOS) == 1


def test_grava_o_criterio_quando_os_itens_concordam(b):
    itens, resultados = dados()
    db.gravar_itens(b.cur, b.id, itens, resultados)
    assert contar(b, "select count(*) from licitacoes where id = %(id)s and criterio_julgamento = 'Menor preço'") == 1


def test_itens_que_ficam_mistos_deixam_o_criterio_nulo(b):
    itens, _ = dados()
    db.gravar_itens(b.cur, b.id, itens, [])
    misto = itens + [{**itens[0], "numeroItem": 99, "criterioJulgamentoNome": "Maior desconto"}]
    db.gravar_itens(b.cur, b.id, misto, [])
    assert contar(b, "select count(*) from licitacoes where id = %(id)s and criterio_julgamento is null") == 1


def test_mapeamento_e_gravacao_concordam_nas_colunas(b):
    # Toda chave que o mapeamento produz tem coluna na tabela.
    b.cur.execute("select column_name from information_schema.columns where table_name = 'itens'")
    colunas = {c for (c,) in b.cur.fetchall()}
    assert set(m.item(dados()[0][0], 1)) <= colunas
