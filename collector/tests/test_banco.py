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
