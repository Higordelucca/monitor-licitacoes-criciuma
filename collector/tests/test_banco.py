"""Conexão que se refaz depois de muito tempo parada, com conexão e relógio
falsos: não toca banco."""

import pathlib
import sys
from types import SimpleNamespace

import psycopg
from psycopg.pq import TransactionStatus

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import db


class ConexaoFalsa:
    def __init__(self, rollback_quebra=False):
        self.rollback_quebra = rollback_quebra
        self.fechada = False
        self.info = SimpleNamespace(transaction_status=TransactionStatus.IDLE)

    def cursor(self):
        return self

    def rollback(self):
        if self.rollback_quebra:
            raise psycopg.InternalError("received 2 results from command 'ROLLBACK'")

    def commit(self):
        pass

    def close(self):
        self.fechada = True


class Cenario:
    def __init__(self):
        self.agora = 0.0
        self.abertas = []
        self.banco = db.Banco(conectar=self._conectar, relogio=lambda: self.agora)

    def _conectar(self):
        self.abertas.append(ConexaoFalsa())
        return self.abertas[-1]


def test_conexao_usada_ha_pouco_e_reaproveitada():
    c = Cenario()
    c.agora = db.Banco.OCIOSA - 1
    c.banco.cursor()
    assert len(c.abertas) == 1


def test_conexao_parada_demais_e_refeita_antes_de_usar():
    # Em 2026-09-24 a rodada completa passou ~35 min conferindo histórico sem
    # tocar o banco, e a conexão já estava fechada na hora de gravar o sync_log.
    c = Cenario()
    velha = c.abertas[0]
    c.agora = db.Banco.OCIOSA + 1
    assert c.banco.cursor() is c.abertas[1]
    assert velha.fechada


def test_commit_sem_transacao_nao_conta_como_uso():
    # O caminho leve não grava nada e o commit dele não sai da máquina: não
    # prova que a conexão continua viva.
    c = Cenario()
    for minuto in range(1, 10):
        c.agora = minuto * 60
        c.banco.commit()
    c.banco.cursor()
    assert len(c.abertas) == 2


def test_nao_refaz_conexao_no_meio_de_uma_transacao():
    c = Cenario()
    c.abertas[0].info.transaction_status = TransactionStatus.INTRANS
    c.agora = db.Banco.OCIOSA + 1
    c.banco.cursor()
    assert len(c.abertas) == 1


def test_rollback_numa_conexao_morta_abre_outra():
    # Em 2026-09-23 o ROLLBACK falhou depois de ~8 min sem consulta e derrubou
    # a coleta inteira em vez de seguir para o próximo órgão.
    c = Cenario()
    c.abertas[0].rollback_quebra = True
    c.banco.rollback()
    assert c.abertas[0].fechada
    assert c.banco.cursor() is c.abertas[1]


class CursorSync:
    """Cursor falso que devolve ids em sequência e guarda os UPDATEs."""

    def __init__(self):
        self.proximo = 0
        self.fechadas = {}

    def execute(self, sql, params):
        if sql.lstrip().startswith("insert"):
            self.proximo += 1
        else:
            status, _, erro, sync_id = params
            self.fechadas[sync_id] = (status, erro)

    def fetchone(self):
        return (self.proximo,)


class BancoSync:
    def __init__(self):
        self.cur = CursorSync()
        self.commits = 0

    def cursor(self):
        return self.cur

    def rollback(self):
        pass

    def commit(self):
        self.commits += 1


def test_interrupcao_fecha_como_erro_o_que_ficou_rodando():
    # Job cancelado pelo Actions deixava a linha em "rodando" para sempre, e
    # o Header mostrava "Sincronizando agora" sem nada rodar (6 linhas em
    # 2026-09-30).
    b = BancoSync()
    terminada = db.abrir_sync(b.cursor(), "PNCP · A")
    db.fechar_sync(b.cursor(), terminada, "ok")
    presa = db.abrir_sync(b.cursor(), "PNCP · B")

    db.interromper(b)

    assert b.cur.fechadas[terminada] == ("ok", None)
    assert b.cur.fechadas[presa][0] == "erro"
    assert "interrompida" in b.cur.fechadas[presa][1]
    assert b.commits == 1


def test_interrupcao_sem_nada_aberto_nao_grava():
    b = BancoSync()
    db.fechar_sync(b.cursor(), db.abrir_sync(b.cursor(), "PNCP · A"), "ok")
    b.cur.fechadas.clear()
    db.interromper(b)
    assert b.cur.fechadas == {}
