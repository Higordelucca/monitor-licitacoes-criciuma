"""Cliente HTTP do PNCP. Só busca dado e devolve JSON — não interpreta nada.
A tradução para as tabelas fica em mapeamento.py, que não toca a rede."""

import logging
import time

import httpx

from config import (
    API_BASE,
    API_BUSCA,
    ESPERA_MAXIMA,
    STATUS_BUSCA,
    TAM_PAGINA,
    TENTATIVAS,
    TENTATIVAS_BUSCA,
    TIMEOUT,
)

log = logging.getLogger(__name__)


class PncpFora(Exception):
    """O PNCP não respondeu nem depois de todas as tentativas.

    Não é problema de uma compra: é o portal fora do ar ou degradado. Quem
    coleta deve interromper a rodada em vez de insistir nos órgãos seguintes.
    """


class Pncp:
    def __init__(self):
        self._c = httpx.Client(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"Accept": "application/json"},
        )

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self._c.close()

    def _get(self, url, params=None, tentativas=TENTATIVAS, espera=2):
        """Devolve o JSON, ou None quando o PNCP responde 204 (sem conteúdo).

        O 204 não é erro: é como a API diz que um item não tem resultado.
        """
        for tentativa in range(1, tentativas + 1):
            try:
                r = self._c.get(url, params=params)
                if r.status_code == 204:
                    return None
                r.raise_for_status()
                return r.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as erro:
                if isinstance(erro, httpx.HTTPStatusError) and 400 <= erro.response.status_code < 500:
                    raise
                if tentativa == tentativas:
                    raise PncpFora(f"{url}: {erro}") from erro
                log.warning("tentativa %d/%d falhou em %s: %s", tentativa, tentativas, url, erro)
                time.sleep(espera)
                espera = min(espera * 2, ESPERA_MAXIMA)

    def buscar_compras(self, orgao_id):
        """Percorre todas as páginas da busca de editais de um órgão."""
        return self._buscar("edital", orgao_id)

    def buscar_contratos(self, orgao_id):
        """Contratos do órgão. A busca exige `status`, mas para contrato o
        ignora: `divulgada` e `encerrado` devolvem a mesma lista (2026-09-25)."""
        return self._buscar("contrato", orgao_id)

    def _buscar(self, tipo, orgao_id):
        pagina = 1
        while True:
            dados = self._get(
                API_BUSCA,
                {
                    "tipos_documento": tipo,
                    "status": STATUS_BUSCA,
                    "orgaos": orgao_id,
                    "pagina": pagina,
                    "tam_pagina": TAM_PAGINA,
                },
                tentativas=TENTATIVAS_BUSCA,
                espera=1,
            )
            itens = dados["items"]
            yield from itens
            if pagina * TAM_PAGINA >= dados["total"] or not itens:
                return
            pagina += 1

    def _compra(self, cnpj, ano, sequencial, sufixo=""):
        return f"{API_BASE}/orgaos/{cnpj}/compras/{ano}/{sequencial}{sufixo}"

    def arquivos(self, cnpj, ano, sequencial):
        return self._get(self._compra(cnpj, ano, sequencial, "/arquivos")) or []

    def itens(self, cnpj, ano, sequencial):
        dados = self._get(self._compra(cnpj, ano, sequencial, "/itens"))
        if dados is None:
            return []
        return dados if isinstance(dados, list) else dados.get("content", [])

    def historico(self, cnpj, ano, sequencial):
        dados = self._get(self._compra(cnpj, ano, sequencial, "/historico"))
        if dados is None:
            return []
        return dados if isinstance(dados, list) else dados.get("content", [])

    def resultados(self, cnpj, ano, sequencial, numero_item):
        url = self._compra(cnpj, ano, sequencial, f"/itens/{numero_item}/resultados")
        return self._get(url) or []

    def _contrato(self, cnpj, ano, sequencial, sufixo=""):
        return f"{API_BASE}/orgaos/{cnpj}/contratos/{ano}/{sequencial}{sufixo}"

    def contrato(self, cnpj, ano, sequencial):
        return self._get(self._contrato(cnpj, ano, sequencial))

    def arquivos_contrato(self, cnpj, ano, sequencial):
        return self._get(self._contrato(cnpj, ano, sequencial, "/arquivos")) or []
