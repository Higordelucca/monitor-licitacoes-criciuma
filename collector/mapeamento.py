"""Traduz o JSON do PNCP para as linhas das tabelas.

Funções puras: entra dicionário, sai dicionário. Nenhuma toca rede nem banco,
por isso os testes rodam sem depender do PNCP estar no ar.
"""

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

SO_DIGITOS = re.compile(r"\D")

BRASILIA = timezone(timedelta(hours=-3))

# situacao_nome do PNCP -> status do nosso CHECK. Os valores da esquerda foram
# levantados sobre 1.500 editais reais; nenhum outro apareceu.
SITUACAO_TERMINAL = {
    "Revogada": "encerrada",
    "Anulada": "encerrada",
    "Suspensa": "suspensa",
}


def digitos(valor):
    return SO_DIGITOS.sub("", valor or "")


def data(valor):
    """ISO do PNCP para datetime com fuso. O PNCP manda horário de Brasília,
    às vezes sem indicar o fuso; sem isso o Postgres assumiria UTC e as datas
    de abertura sairiam três horas adiantadas na tela."""
    if not valor:
        return None
    texto = valor.replace("Z", "+00:00")
    try:
        momento = datetime.fromisoformat(texto)
    except ValueError:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=BRASILIA)
    return momento


def status_licitacao(situacao_nome, data_fim_vigencia, tem_resultado, agora=None):
    """Deriva a pílula de status.

    O PNCP não tem um campo equivalente: `situacao_nome` só distingue
    publicada de revogada/anulada/suspensa. Aberta, em análise e homologada
    saem do prazo de proposta e da existência de resultado.
    """
    terminal = SITUACAO_TERMINAL.get(situacao_nome)
    if terminal:
        return terminal
    agora = agora or datetime.now(timezone.utc)
    fim = data(data_fim_vigencia) if isinstance(data_fim_vigencia, str) else data_fim_vigencia
    if fim and fim > agora:
        return "aberta"
    return "homologada" if tem_resultado else "em_analise"


def valor_estimado(itens):
    """Soma o valor dos itens. Devolve None quando não há nada somável.

    Item com `orcamentoSigiloso` é pulado: a lei permite manter o orçamento em
    sigilo até o fim da disputa, e nesses casos o valor vem zerado. Somá-lo
    faria o total parecer menor do que é, o que é pior que não ter total.
    """
    soma, achou = Decimal(0), False
    for item in itens:
        if item.get("orcamentoSigiloso"):
            continue
        bruto = item.get("valorTotal")
        if bruto is None:
            continue
        soma += Decimal(str(bruto))
        achou = True
    return soma if achou else None


def valor_homologado(resultados):
    soma, achou = Decimal(0), False
    for resultado in resultados:
        bruto = resultado.get("valorTotalHomologado")
        if bruto is None:
            continue
        soma += Decimal(str(bruto))
        achou = True
    return soma if achou else None


def licitacao(item_busca, tem_resultado=False, data_homologacao=None,
              estimado=None, homologado=None):
    """Item da API de busca -> linha de `licitacoes`.

    Valores e data de homologação não vêm da busca: são calculados a partir
    dos itens e dos resultados, que o collector busca no mesmo passo.
    """
    return {
        "valor_estimado": estimado,
        "valor_homologado": homologado,
        "id_pncp": item_busca["numero_controle_pncp"],
        "numero": item_busca.get("numero"),
        "ano": int(item_busca["ano"]) if item_busca.get("ano") else None,
        "modalidade": item_busca.get("modalidade_licitacao_nome"),
        "objeto": item_busca.get("description") or "",
        "secretaria": item_busca.get("unidade_nome"),
        "processo": item_busca.get("numero_sequencial"),
        "data_publicacao": data(item_busca.get("data_publicacao_pncp")),
        "data_abertura": data(item_busca.get("data_inicio_vigencia")),
        "data_homologacao": data_homologacao,
        "status": status_licitacao(
            item_busca.get("situacao_nome"),
            item_busca.get("data_fim_vigencia"),
            tem_resultado,
        ),
        "url_pncp": url_pncp(item_busca),
    }


def url_pncp(item_busca):
    """Link da página do edital no portal do PNCP.

    O `item_url` da busca (/compras/{cnpj}/{ano}/{seq}) dá 404 no portal. A
    rota da página, conferida no código do próprio portal em 2026-09-23, é
    /app/editais/:cnpj/:ano/:sequencial. Sem os três dados, fica nula: link
    quebrado é pior que link nenhum.
    """
    cnpj = item_busca.get("orgao_cnpj")
    ano = item_busca.get("ano")
    seq = item_busca.get("numero_sequencial")
    if not (cnpj and ano and seq):
        return None
    return f"https://pncp.gov.br/app/editais/{cnpj}/{ano}/{seq}"


def documento(arquivo, licitacao_id):
    """Item de /arquivos -> linha de `documentos`."""
    return {
        "licitacao_id": licitacao_id,
        "tipo": arquivo.get("tipoDocumentoNome"),
        "titulo": arquivo.get("titulo") or "(sem título)",
        "url": arquivo.get("url") or arquivo.get("uri"),
        "tamanho_bytes": None,  # a API não informa o tamanho
        "data_publicacao": data(arquivo.get("dataPublicacaoPncp")),
    }


def evento(log_pncp, licitacao_id):
    """Item de /historico -> linha de `eventos`."""
    partes = [log_pncp.get("categoriaLogManutencaoNome"), log_pncp.get("documentoTitulo")]
    return {
        "licitacao_id": licitacao_id,
        "tipo": log_pncp.get("tipoLogManutencaoNome") or "Alteração",
        "descricao": " · ".join(p for p in partes if p) or None,
        "data": data(log_pncp.get("logManutencaoDataInclusao")),
        "fonte": "PNCP",
    }


def participante(resultado, licitacao_id):
    """Item de /resultados -> (linha de `empresas`, linha de `participantes`).

    Devolve (None, None) quando o fornecedor é pessoa física: `niFornecedor`
    traz um CPF de 11 dígitos, que não cabe na tabela `empresas`, cuja chave é
    um CNPJ de 14.
    """
    ni = digitos(resultado.get("niFornecedor"))
    if resultado.get("tipoPessoa") != "PJ" or len(ni) != 14:
        return None, None
    empresa = {
        "cnpj": ni,
        "razao_social": resultado.get("nomeRazaoSocialFornecedor") or "(sem razão social)",
        "porte": resultado.get("porteFornecedorNome"),
    }
    vinculo = {
        "licitacao_id": licitacao_id,
        "cnpj": ni,
        "valor_proposta": resultado.get("valorTotalHomologado"),
        "situacao": "vencedora" if resultado.get("ordemClassificacaoSrp") == 1 else "habilitada",
    }
    return empresa, vinculo


# --- enriquecimento (fase 3) ------------------------------------------------


def dia(valor, formato="%Y-%m-%d"):
    """Data sem hora. A BrasilAPI manda ISO; o Portal da Transparência,
    dd/mm/aaaa. Vazio ou fora do formato vira None."""
    if not valor:
        return None
    try:
        return datetime.strptime(valor.strip(), formato).date()
    except ValueError:
        return None


def empresa_brasilapi(dados):
    """Resposta de /api/cnpj/v1/{cnpj} -> linha de `empresas`."""
    cnae = " · ".join(
        str(p) for p in (dados.get("cnae_fiscal"), dados.get("cnae_fiscal_descricao")) if p
    )
    capital = dados.get("capital_social")
    return {
        "cnpj": digitos(dados["cnpj"]),
        "razao_social": dados.get("razao_social") or "(sem razão social)",
        "nome_fantasia": dados.get("nome_fantasia") or None,
        "porte": dados.get("porte") or None,
        "situacao_cadastral": dados.get("descricao_situacao_cadastral") or None,
        "data_abertura": dia(dados.get("data_inicio_atividade")),
        "cnae_principal": cnae or None,
        "municipio": dados.get("municipio") or None,
        "uf": dados.get("uf") or None,
        "capital_social": Decimal(str(capital)) if capital is not None else None,
    }


def socios_brasilapi(dados):
    """Quadro de sócios (`qsa`) -> linhas de `socios`.

    O CPF do sócio vem mascarado pela Receita e fica de fora: é dado pessoal
    e a tela não o usa.
    """
    cnpj = digitos(dados["cnpj"])
    return [
        {
            "cnpj": cnpj,
            "nome": s["nome_socio"],
            "qualificacao": s.get("qualificacao_socio") or None,
            "data_entrada": dia(s.get("data_entrada_sociedade")),
        }
        for s in dados.get("qsa") or []
        if s.get("nome_socio")
    ]


def sancao(cadastro, linha):
    """Linha do CSV do CEIS, do CNEP ou do CEPIM -> linha de `sancoes`.

    Devolve None para pessoa física, pelo mesmo motivo do participante: CPF
    não cabe em `empresas.cnpj`. "Sem Informação" na abrangência vira nulo.
    """
    if cadastro == "CEPIM":
        cnpj = digitos(linha["CNPJ ENTIDADE"])
        convenio = linha["NÚMERO CONVÊNIO"].strip()
        return {
            "cnpj": cnpj,
            "cadastro": cadastro,
            "chave": f"{cnpj}-{convenio}",
            "categoria": None,
            "descricao": linha["MOTIVO DO IMPEDIMENTO"].strip() or None,
            "orgao_sancionador": linha["ÓRGÃO CONCEDENTE"].strip() or None,
            "abrangencia": None,
            "processo": convenio or None,
            "data_inicio": None,
            "data_fim": None,
        }
    cnpj = digitos(linha["CPF OU CNPJ DO SANCIONADO"])
    if linha["TIPO DE PESSOA"] != "J" or len(cnpj) != 14:
        return None
    abrangencia = linha["ABRAGÊNCIA DA SANÇÃO"].strip()
    return {
        "cnpj": cnpj,
        "cadastro": cadastro,
        "chave": linha["CÓDIGO DA SANÇÃO"].strip(),
        "categoria": linha["CATEGORIA DA SANÇÃO"].strip() or None,
        "descricao": linha["FUNDAMENTAÇÃO LEGAL"].strip() or None,
        "orgao_sancionador": linha["ÓRGÃO SANCIONADOR"].strip() or None,
        "abrangencia": None if abrangencia in ("", "Sem Informação") else abrangencia,
        "processo": linha["NÚMERO DO PROCESSO"].strip() or None,
        "data_inicio": dia(linha["DATA INÍCIO SANÇÃO"], "%d/%m/%Y"),
        "data_fim": dia(linha["DATA FINAL SANÇÃO"], "%d/%m/%Y"),
    }
