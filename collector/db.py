"""Escrita no Postgres. Todo upsert é idempotente: rodar a coleta duas vezes
seguidas não cria linha repetida nem gera evento falso."""

import os
import pathlib
import time

import psycopg
from psycopg.pq import TransactionStatus

import mapeamento as m
from incremental import CAMPOS_BUSCA


def conectar():
    url = os.environ.get("DATABASE_URL") or _do_env_local()
    if not url:
        raise SystemExit(
            "DATABASE_URL não definida. Crie web/.env.local a partir de web/.env.example."
        )
    return psycopg.connect(url)


class Banco:
    """Conexão com o Neon que se refaz quando ficou parada tempo demais.

    O Neon fecha conexão ociosa. Em 2026-09-24 a rodada completa passou ~35
    min conferindo o /historico sem tocar o banco (o caminho leve compara em
    memória) e, na hora de gravar o sync_log, a conexão estava morta. Por isso
    quem vai falar com o banco pede o cursor na hora, e a conexão é refeita
    antes se o último pedido foi há mais de OCIOSA segundos — só entre
    transações, para nunca descartar escrita pendente.
    """

    OCIOSA = 240

    def __init__(self, conectar=conectar, relogio=time.monotonic):
        self._conectar = conectar
        self._relogio = relogio
        self._c = conectar()
        self._uso = relogio()

    def cursor(self):
        parada = self._relogio() - self._uso > self.OCIOSA
        if parada and self._c.info.transaction_status == TransactionStatus.IDLE:
            self._c.close()
            self._c = self._conectar()
        self._uso = self._relogio()
        return self._c.cursor()

    def commit(self):
        # Não conta como uso: sem transação aberta, o commit nem sai da máquina.
        self._c.commit()

    def rollback(self):
        """Desfaz a transação; se a conexão já caiu, abre outra."""
        try:
            self._c.rollback()
        except psycopg.Error:
            self._c.close()
            self._c = self._conectar()
            self._uso = self._relogio()

    def close(self):
        self._c.close()


def _do_env_local():
    caminho = pathlib.Path(__file__).resolve().parents[1] / "web" / ".env.local"
    if not caminho.exists():
        return None
    for linha in caminho.read_text().splitlines():
        chave, _, valor = linha.partition("=")
        if chave.strip() == "DATABASE_URL":
            return valor.strip().strip("\"'")
    return None


def upsert_licitacao(cur, linha):
    """Grava a licitação e devolve (id, mudou).

    `mudou` distingue linha nova ou alterada de linha idêntica, para não gerar
    evento de atualização quando nada mudou de fato.
    """
    cur.execute(
        """
        insert into licitacoes (
            id_pncp, numero, ano, modalidade, objeto, secretaria, processo,
            data_publicacao, data_abertura, data_homologacao,
            valor_estimado, valor_homologado, status, url_pncp, atualizado_em
        )
        values (
            %(id_pncp)s, %(numero)s, %(ano)s, %(modalidade)s, %(objeto)s,
            %(secretaria)s, %(processo)s, %(data_publicacao)s, %(data_abertura)s,
            %(data_homologacao)s, %(valor_estimado)s, %(valor_homologado)s,
            %(status)s, %(url_pncp)s, now()
        )
        on conflict (id_pncp) do update set
            numero           = excluded.numero,
            ano              = excluded.ano,
            modalidade       = excluded.modalidade,
            objeto           = excluded.objeto,
            secretaria       = excluded.secretaria,
            processo         = excluded.processo,
            data_publicacao  = excluded.data_publicacao,
            data_abertura    = excluded.data_abertura,
            data_homologacao = excluded.data_homologacao,
            valor_estimado   = excluded.valor_estimado,
            valor_homologado = excluded.valor_homologado,
            status           = excluded.status,
            url_pncp         = excluded.url_pncp,
            atualizado_em    = now()
        where licitacoes.status           is distinct from excluded.status
           or licitacoes.objeto           is distinct from excluded.objeto
           or licitacoes.data_abertura    is distinct from excluded.data_abertura
           or licitacoes.data_homologacao is distinct from excluded.data_homologacao
           or licitacoes.valor_estimado   is distinct from excluded.valor_estimado
           or licitacoes.valor_homologado is distinct from excluded.valor_homologado
        returning id, (xmax = 0) as inserida
        """,
        linha,
    )
    resultado = cur.fetchone()
    if resultado:
        return resultado[0], True
    # O WHERE barrou a atualização: nada mudou. Busca o id existente.
    cur.execute("select id from licitacoes where id_pncp = %s", (linha["id_pncp"],))
    return cur.fetchone()[0], False


def estado_compras(cur, cnpj_orgao):
    """Estado de cada licitação do órgão já no banco, por id_pncp: último
    evento, último movimento (publicação ou evento) e as colunas que vêm da
    busca (incremental.CAMPOS_BUSCA), status incluído.

    Uma consulta por órgão, não uma por compra: é o que a coleta incremental
    usa para decidir o que refazer (incremental.plano) e o que regravar
    (incremental.busca_mudou).
    """
    cur.execute(
        """
        select l.id_pncp, max(e.data), greatest(l.data_publicacao, max(e.data)),
               exists (select 1 from itens i where i.licitacao_id = l.id),
               l.modalidade, l.objeto, l.secretaria, l.data_publicacao,
               l.data_abertura, l.status, l.url_pncp
          from licitacoes l
          left join eventos e on e.licitacao_id = l.id
         where left(l.id_pncp, 14) = %s
         group by l.id
        """,
        (cnpj_orgao,),
    )
    colunas = ("ultimo_evento", "movimento", "tem_itens", *CAMPOS_BUSCA)
    return {id_pncp: dict(zip(colunas, resto)) for id_pncp, *resto in cur.fetchall()}


def atualizar_da_busca(cur, linha):
    """Grava só o que vem da busca, sem tocar valores, homologação e o resto que
    sai dos detalhes. É o caminho "leve" da coleta incremental: recalcula o
    status pelo prazo (aberta → em análise) e pega revogação e suspensão.

    Devolve True se algo mudou. Mudança de status dispara o trigger de aviso.
    """
    cur.execute(
        """
        update licitacoes set
            modalidade      = %(modalidade)s,
            objeto          = %(objeto)s,
            secretaria      = %(secretaria)s,
            data_publicacao = %(data_publicacao)s,
            data_abertura   = %(data_abertura)s,
            status          = %(status)s,
            url_pncp        = %(url_pncp)s,
            atualizado_em   = now()
        where id_pncp = %(id_pncp)s
          and (modalidade, objeto, secretaria, data_publicacao, data_abertura, status, url_pncp)
              is distinct from
              (%(modalidade)s, %(objeto)s, %(secretaria)s, %(data_publicacao)s::timestamptz,
               %(data_abertura)s::timestamptz, %(status)s, %(url_pncp)s)
        """,
        linha,
    )
    return cur.rowcount > 0


def inserir_documentos(cur, linhas):
    """Devolve quantos documentos são novos."""
    novos = 0
    for linha in linhas:
        if not linha["url"]:
            continue
        cur.execute(
            """
            insert into documentos (licitacao_id, tipo, titulo, url, tamanho_bytes, data_publicacao)
            values (%(licitacao_id)s, %(tipo)s, %(titulo)s, %(url)s, %(tamanho_bytes)s, %(data_publicacao)s)
            on conflict (licitacao_id, url) do nothing
            """,
            linha,
        )
        novos += cur.rowcount
    return novos


def inserir_eventos(cur, linhas):
    novos = 0
    for linha in linhas:
        if linha["data"] is None:
            continue
        cur.execute(
            """
            insert into eventos (licitacao_id, tipo, descricao, data, fonte)
            values (%(licitacao_id)s, %(tipo)s, %(descricao)s, %(data)s, %(fonte)s)
            on conflict do nothing
            """,
            linha,
        )
        novos += cur.rowcount
    return novos


def upsert_empresa(cur, linha):
    """Grava o esqueleto da empresa vindo do resultado do PNCP.

    Não sobrescreve empresa já enriquecida pela API de CNPJ (fase 3): quem tem
    `atualizado_em` preenchido passou por lá e tem dado melhor que este.
    """
    cur.execute(
        """
        insert into empresas (cnpj, razao_social, porte)
        values (%(cnpj)s, %(razao_social)s, %(porte)s)
        on conflict (cnpj) do update set
            razao_social = excluded.razao_social,
            porte        = coalesce(excluded.porte, empresas.porte)
        where empresas.atualizado_em is null
        """,
        linha,
    )


def upsert_participante(cur, linha):
    cur.execute(
        """
        insert into participantes (licitacao_id, cnpj, valor_proposta, situacao)
        values (%(licitacao_id)s, %(cnpj)s, %(valor_proposta)s, %(situacao)s)
        on conflict (licitacao_id, cnpj) do update set
            valor_proposta = excluded.valor_proposta,
            situacao       = excluded.situacao
        """,
        linha,
    )


def gravar_itens(cur, licitacao_id, itens, resultados):
    """Grava os itens da compra, quem ficou registrado em cada um e o
    critério de julgamento da licitação. Recebe o JSON cru de /itens e de
    /resultados.

    Itens por upsert. Os resultados são refeitos do zero a cada vez, como os
    sócios: o PNCP não dá chave estável para eles, e resultado cancelado some
    da lista.
    """
    ids = {}
    for item in itens:
        cur.execute(
            """
            insert into itens (
                licitacao_id, numero, descricao, tipo, quantidade, unidade,
                valor_unitario_estimado, valor_total_estimado, sigiloso, situacao,
                criterio_julgamento
            )
            values (
                %(licitacao_id)s, %(numero)s, %(descricao)s, %(tipo)s, %(quantidade)s,
                %(unidade)s, %(valor_unitario_estimado)s, %(valor_total_estimado)s,
                %(sigiloso)s, %(situacao)s, %(criterio_julgamento)s
            )
            on conflict (licitacao_id, numero) do update set
                descricao               = excluded.descricao,
                tipo                    = excluded.tipo,
                quantidade              = excluded.quantidade,
                unidade                 = excluded.unidade,
                valor_unitario_estimado = excluded.valor_unitario_estimado,
                valor_total_estimado    = excluded.valor_total_estimado,
                sigiloso                = excluded.sigiloso,
                situacao                = excluded.situacao,
                criterio_julgamento     = excluded.criterio_julgamento,
                atualizado_em           = now()
            returning id
            """,
            m.item(item, licitacao_id),
        )
        ids[item["numeroItem"]] = cur.fetchone()[0]

    cur.execute(
        """delete from resultados_item r using itens i
            where i.id = r.item_id and i.licitacao_id = %s""",
        (licitacao_id,),
    )
    for resultado in resultados:
        empresa, linha = m.resultado_item(resultado)
        item_id = ids.get(linha.pop("numero_item"))
        if item_id is None:
            continue
        if empresa:
            upsert_empresa(cur, empresa)
        cur.execute(
            """
            insert into resultados_item (
                item_id, cnpj, tipo_pessoa, ordem, quantidade_homologada,
                valor_unitario_homologado, valor_total_homologado, data_resultado, situacao
            )
            values (
                %(item_id)s, %(cnpj)s, %(tipo_pessoa)s, %(ordem)s, %(quantidade_homologada)s,
                %(valor_unitario_homologado)s, %(valor_total_homologado)s, %(data_resultado)s,
                %(situacao)s
            )
            """,
            {**linha, "item_id": item_id},
        )

    cur.execute(
        "update licitacoes set criterio_julgamento = %s where id = %s",
        (m.criterio_unico(itens), licitacao_id),
    )


def upsert_contrato(cur, linha):
    """Grava o contrato e devolve True se é novo. A licitação é achada pelo
    id_pncp da compra; compra fora do banco deixa `licitacao_id` nulo.

    A empresa tem de existir antes (FK): quem chama grava com upsert_empresa.
    """
    cur.execute(
        """
        insert into contratos (
            id_pncp, licitacao_id, cnpj, numero, tipo, objeto, valor_inicial, valor_global,
            data_assinatura, data_publicacao, vigencia_inicio, vigencia_fim, url_pncp, url_documento
        )
        values (
            %(id_pncp)s, (select id from licitacoes where id_pncp = %(id_pncp_compra)s),
            %(cnpj)s, %(numero)s, %(tipo)s, %(objeto)s, %(valor_inicial)s, %(valor_global)s,
            %(data_assinatura)s, %(data_publicacao)s, %(vigencia_inicio)s, %(vigencia_fim)s,
            %(url_pncp)s, %(url_documento)s
        )
        on conflict (id_pncp) do update set
            licitacao_id    = excluded.licitacao_id,
            cnpj            = excluded.cnpj,
            numero          = excluded.numero,
            tipo            = excluded.tipo,
            objeto          = excluded.objeto,
            valor_inicial   = excluded.valor_inicial,
            valor_global    = excluded.valor_global,
            data_assinatura = excluded.data_assinatura,
            data_publicacao = excluded.data_publicacao,
            vigencia_inicio = excluded.vigencia_inicio,
            vigencia_fim    = excluded.vigencia_fim,
            url_pncp        = excluded.url_pncp,
            url_documento   = excluded.url_documento,
            atualizado_em   = now()
        returning (xmax = 0) as inserido
        """,
        linha,
    )
    return cur.fetchone()[0]


def contratos_conhecidos(cur, cnpj_orgao):
    """id_pncp -> fim da vigência dos contratos do órgão já no banco. Uma
    consulta por órgão, como estado_compras."""
    cur.execute(
        "select id_pncp, vigencia_fim from contratos where left(id_pncp, 14) = %s",
        (cnpj_orgao,),
    )
    return dict(cur.fetchall())


def abrir_sync(cur, fonte):
    cur.execute(
        "insert into sync_log (fonte, status) values (%s, 'rodando') returning id",
        (fonte,),
    )
    return cur.fetchone()[0]


def fechar_sync(cur, sync_id, status, registros_novos=0, erro=None):
    cur.execute(
        """
        update sync_log
           set finalizado_em = now(), status = %s, registros_novos = %s, erro = %s
         where id = %s
        """,
        (status, registros_novos, erro, sync_id),
    )


# --- enriquecimento (fase 3) ------------------------------------------------


def cnpjs_conhecidos(cur):
    cur.execute("select cnpj from empresas")
    return {cnpj for (cnpj,) in cur.fetchall()}


def empresas_para_enriquecer(cur, limite=None):
    """CNPJs sem cadastro da Receita ou com cadastro de mais de 30 dias. As
    nunca consultadas vêm primeiro."""
    cur.execute(
        """
        select cnpj from empresas
         where atualizado_em is null or atualizado_em < now() - interval '30 days'
         order by atualizado_em nulls first, cnpj
         limit %s
        """,
        (limite,),
    )
    return [cnpj for (cnpj,) in cur.fetchall()]


def gravar_empresa(cur, empresa, socios):
    """Cadastro da Receita por cima do esqueleto vindo do PNCP, e o quadro de
    sócios refeito do zero — sócio que saiu da sociedade sai da tabela."""
    cur.execute(
        """
        update empresas set
            razao_social       = %(razao_social)s,
            nome_fantasia      = %(nome_fantasia)s,
            porte              = coalesce(%(porte)s, porte),
            situacao_cadastral = %(situacao_cadastral)s,
            data_abertura      = %(data_abertura)s,
            cnae_principal     = %(cnae_principal)s,
            municipio          = %(municipio)s,
            uf                 = %(uf)s,
            capital_social     = %(capital_social)s,
            atualizado_em      = now()
        where cnpj = %(cnpj)s
        """,
        empresa,
    )
    cur.execute("delete from socios where cnpj = %s", (empresa["cnpj"],))
    for socio in socios:
        cur.execute(
            """
            insert into socios (cnpj, nome, qualificacao, data_entrada)
            values (%(cnpj)s, %(nome)s, %(qualificacao)s, %(data_entrada)s)
            on conflict do nothing
            """,
            socio,
        )


def sincronizar_sancoes(cur, cadastro, sancoes):
    """Deixa o cadastro igual à lista do dia: grava as que estão nela e apaga
    as que saíram. Devolve (novas, saídas)."""
    novas = 0
    for s in sancoes:
        cur.execute(
            """
            insert into sancoes (cnpj, cadastro, chave, categoria, descricao,
                                 orgao_sancionador, abrangencia, processo,
                                 data_inicio, data_fim, verificado_em)
            values (%(cnpj)s, %(cadastro)s, %(chave)s, %(categoria)s, %(descricao)s,
                    %(orgao_sancionador)s, %(abrangencia)s, %(processo)s,
                    %(data_inicio)s, %(data_fim)s, now())
            on conflict (cadastro, chave) do update set
                cnpj              = excluded.cnpj,
                categoria         = excluded.categoria,
                descricao         = excluded.descricao,
                orgao_sancionador = excluded.orgao_sancionador,
                abrangencia       = excluded.abrangencia,
                processo          = excluded.processo,
                data_inicio       = excluded.data_inicio,
                data_fim          = excluded.data_fim,
                verificado_em     = now()
            returning (xmax = 0)
            """,
            s,
        )
        novas += cur.fetchone()[0]
    cur.execute(
        "delete from sancoes where cadastro = %s and not (chave = any(%s))",
        (cadastro, [s["chave"] for s in sancoes]),
    )
    return novas, cur.rowcount
