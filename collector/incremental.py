"""Decisões da coleta incremental (ver CLAUDE.md, "Atualização contínua").

Refazer as 1.013 compras a cada rodada leva mais de uma hora. A maior parte
não muda: licitação homologada há dois anos raramente recebe coisa nova.

O `data_atualizacao_pncp` da busca NÃO serve para saber se algo mudou: em
2026-09-23, em 115 de 300 compras do Município havia registros no histórico
posteriores a ele (resultado de item, documento). Quem registra toda alteração
é o /historico da compra — por isso a conferência é por ele, uma requisição
por compra, e só quando ele tem registro novo o resto é buscado.

Funções puras: não tocam rede nem banco.
"""

from datetime import timedelta

import mapeamento as m

# Julgamento em curso ou suspensão que pode acabar: ainda andam, mas só vale
# conferir a cada hora as que se mexeram há pouco. Em 2026-09-23 eram 389
# nesses status e só 119 com publicação ou evento nos últimos 180 dias — o
# resto é processo esquecido no PNCP, que a rodada completa (semanal) confere.
# Aberta é sempre conferida: prazo de proposta correndo é o que não se perde.
# Homologada e encerrada ficam para a completa.
EM_ANDAMENTO = {"em_analise", "suspensa"}
JANELA = timedelta(days=180)

# Colunas que o caminho leve grava (db.atualizar_da_busca) e que
# db.estado_compras traz do banco para comparar.
CAMPOS_BUSCA = (
    "modalidade", "objeto", "secretaria", "data_publicacao", "data_abertura",
    "status", "url_pncp",
)


def plano(modo, estado, agora):
    """O que fazer com uma compra da busca.

    modo: "rapida" (de hora em hora), "completa" (semanal) ou "tudo" (refaz
    todas, como a coleta antes de ser incremental — para reprocessar depois
    de mudar o mapeamento).
    estado: None se a compra não está no banco, senão {"status",
    "ultimo_evento", "movimento"}; movimento é a data mais recente entre a
    publicação e o último evento.

    Devolve "completa" (busca tudo), "historico" (confere o histórico e busca
    o resto só se houver novidade) ou "leve" (só grava os dados da busca).
    """
    if estado is None or modo == "tudo":
        return "completa"
    if modo == "completa" or estado["status"] == "aberta":
        return "historico"
    movimento = estado.get("movimento")
    if estado["status"] in EM_ANDAMENTO and movimento and agora - movimento <= JANELA:
        return "historico"
    return "leve"


def busca_mudou(linha, estado):
    """Os dados da busca diferem do que está gravado?

    A comparação é feita aqui, e não com um UPDATE por compra, porque cada ida
    ao banco custa: em 2026-09-23 a rodada rápida no GitHub levou 12,8 min, ~9
    deles em UPDATE e COMMIT de linhas que não tinham mudado (o runner fica nos
    EUA, o Neon em São Paulo). Datas com fuso comparam pelo instante.
    """
    return any(linha[c] != estado[c] for c in CAMPOS_BUSCA)


def houve_novidade(historico, ultimo_evento):
    """Há no /historico algum registro mais novo que o último evento gravado?"""
    datas = [m.data(h.get("logManutencaoDataInclusao")) for h in historico]
    datas = [d for d in datas if d]
    if not datas:
        return False
    return ultimo_evento is None or max(datas) > ultimo_evento
