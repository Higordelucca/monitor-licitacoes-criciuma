"""Arquivos diários do Portal da Transparência com as listas de sanções:
CEIS (inidôneas e suspensas), CNEP (punidas pela Lei Anticorrupção) e CEPIM
(entidades sem fins lucrativos impedidas).

Verificado em 2026-09-24: o download não pede chave, ao contrário da API. O
endereço /download-de-dados/{lista}/{aaaammdd} redireciona para um zip com um
CSV em latin-1, separado por ponto e vírgula. Só o arquivo mais recente
existe — naquele dia, o de ontem; o de hoje e o de anteontem davam 403.
"""

import csv
import io
import logging
import time
import zipfile
from datetime import timedelta

import httpx

log = logging.getLogger(__name__)

BASE = "https://portaldatransparencia.gov.br/download-de-dados"
DIAS_ATRAS = 3
TENTATIVAS = 4
TIMEOUT = 120


class SemArquivo(Exception):
    """Nenhum arquivo da lista nos últimos DIAS_ATRAS dias."""


class Portal:
    def __init__(self):
        self._c = httpx.Client(timeout=TIMEOUT, follow_redirects=True)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self._c.close()

    def lista(self, cadastro, hoje):
        """Devolve (data do arquivo, linhas do CSV como dicionários).

        Procura do dia de hoje para trás: 403 e 404 querem dizer que o arquivo
        daquele dia não existe, e o anterior é tentado.
        """
        for atras in range(DIAS_ATRAS + 1):
            dia = hoje - timedelta(days=atras)
            conteudo = self._baixar(f"{BASE}/{cadastro.lower()}/{dia:%Y%m%d}")
            if conteudo is not None:
                return dia, _ler_zip(conteudo)
        raise SemArquivo(f"{cadastro}: nenhum arquivo desde {hoje - timedelta(days=DIAS_ATRAS)}")

    def _baixar(self, url):
        espera = 5
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                r = self._c.get(url)
                if r.status_code in (403, 404):
                    return None
                r.raise_for_status()
                return r.content
            except (httpx.TransportError, httpx.HTTPStatusError) as erro:
                if tentativa == TENTATIVAS:
                    raise
                log.warning("tentativa %d/%d falhou em %s: %s", tentativa, TENTATIVAS, url, erro)
                time.sleep(espera)
                espera *= 2


def _ler_zip(conteudo):
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        (nome,) = [n for n in z.namelist() if n.lower().endswith(".csv")]
        texto = z.read(nome).decode("latin1")
    return list(csv.DictReader(io.StringIO(texto), delimiter=";"))
