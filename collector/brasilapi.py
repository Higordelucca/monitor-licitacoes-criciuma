"""Cliente da BrasilAPI (cadastro de CNPJ da Receita). Só busca e devolve
JSON; a tradução para as tabelas fica em mapeamento.py.

Testado em 2026-09-24: /api/cnpj/v1/{cnpj} responde sem chave em ~0,5 s. O
limite de requisições não é documentado na resposta, então quem chama espera
entre uma empresa e outra (enriquecimento.PAUSA) e o 429 é tratado aqui.
"""

import logging
import time

import httpx

log = logging.getLogger(__name__)

BASE = "https://brasilapi.com.br/api/cnpj/v1"
TENTATIVAS = 5
TIMEOUT = 30
ESPERA_MAXIMA = 60


class BrasilApiFora(Exception):
    """A BrasilAPI não respondeu nem depois de todas as tentativas."""


class BrasilApi:
    def __init__(self):
        self._c = httpx.Client(timeout=TIMEOUT, headers={"Accept": "application/json"})

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self._c.close()

    def cnpj(self, cnpj):
        """Cadastro da empresa, ou None quando a Receita não conhece o CNPJ."""
        url = f"{BASE}/{cnpj}"
        espera = 5
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                r = self._c.get(url)
                if r.status_code == 404:
                    return None
                r.raise_for_status()
                return r.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as erro:
                if isinstance(erro, httpx.HTTPStatusError):
                    codigo = erro.response.status_code
                    if 400 <= codigo < 500 and codigo != 429:
                        raise
                if tentativa == TENTATIVAS:
                    raise BrasilApiFora(f"{url}: {erro}") from erro
                log.warning("tentativa %d/%d falhou em %s: %s", tentativa, TENTATIVAS, url, erro)
                time.sleep(espera)
                espera = min(espera * 2, ESPERA_MAXIMA)
