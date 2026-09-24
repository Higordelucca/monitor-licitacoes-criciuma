"""Configuração da coleta. Nada aqui vem de adivinhação: os ids de órgão
foram levantados por varredura da API de busca em 2026-09-22 e estão
documentados no CLAUDE.md da raiz."""

import os

# O caminho depois da base é idêntico na API do portal e na API de consulta
# (/orgaos/{cnpj}/compras/...). Quando a API de consulta voltar do ar, basta
# trocar esta variável — não existe fallback nem segundo cliente.
API_BASE = os.environ.get("PNCP_API_BASE", "https://pncp.gov.br/api/pncp/v1")
API_BUSCA = os.environ.get("PNCP_API_BUSCA", "https://pncp.gov.br/api/search/")

# A administração municipal de Criciúma. 1.011 editais em status=divulgada.
#
# Ficam de fora, de propósito, órgãos que aparecem no município 4386 mas não
# são entidades de Criciúma:
#
#   Comando do Exército, Base Administrativa do QG — o orgao_id é o da
#   entidade nacional. Filtrar por ele traz 97 mil editais do Brasil inteiro,
#   não os da unidade sediada aqui.
#   FUPESC — fundo penitenciário estadual, 1.064 editais de toda Santa Catarina.
#   CISAMREC, Consórcio Macro Sul — consórcios que licitam para várias cidades.
ORGAOS = {
    85877: ("82916818000113", "Município de Criciúma"),
    58246: ("08435209000190", "Fundo Municipal de Saúde"),
    54398: ("05140677000149", "CriciúmaPrev"),
    42823: ("00074312000140", "Fundação Cultural de Criciúma"),
    40426: ("83728949000130", "Câmara Municipal de Criciúma"),
    8848: ("11786437000119", "Fundo Municipal de Assistência Social"),
    40633: ("86951555000134", "Fundação Municipal de Esportes"),
}

# A API de busca exige o filtro status e recusa a requisição sem ele.
# 'divulgada' devolve tudo que foi publicado; os outros dois são subconjuntos.
STATUS_BUSCA = "divulgada"

# A busca aceita 500 por página (testado em 2026-09-24). Menos páginas, menos
# chances de cair numa das conexões que ela derruba: o Município passa de 8
# requisições para 2.
TAM_PAGINA = 500

# pncp.gov.br derruba conexão de forma intermitente. Retry é requisito,
# não refinamento.
TENTATIVAS = 6
TIMEOUT = 40

# A busca é pior que os detalhes. Em 2026-09-23 ela derrubava ~metade das
# conexões em 0,1 s, alternando erro e sucesso (cara de balanceador com um
# servidor ruim), e seis tentativas seguidas falharam numa rodada do Actions.
# Esperar muito não ajuda; tentar de novo logo, sim. 10 tentativas com espera
# de 1 s dobrando até 16 s somam ~95 s antes de desistir.
TENTATIVAS_BUSCA = 10
ESPERA_MAXIMA = 16
