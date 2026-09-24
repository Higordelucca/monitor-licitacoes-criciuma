import type { Status } from "../components/Pilula";
import { ORGAOS } from "./orgaos";

/* Filtros do Painel, lidos da URL (PDF 3.1, item 6.1: "filtros vão para a URL
   para poder compartilhar o link").

   Tudo que vem da URL é tratado como hostil. Cada valor é validado contra uma
   lista branca e descartado se não passar — um filtro inválido some, não
   quebra a página. Valor de filtro só chega ao SQL como parâmetro ($1, $2…),
   e nome de coluna nunca vem da URL: `ordem` é a chave de um mapa fixo. */

export const POR_PAGINA = 20;

/* Record<Status, …> obriga a listar os cinco status do CHECK, nem mais nem
   menos — um status novo em Pilula quebra aqui na compilação. */
const STATUS_VALIDOS: Record<Status, true> = {
  aberta: true,
  em_analise: true,
  homologada: true,
  suspensa: true,
  encerrada: true,
};

export const ORDENS = {
  numero: ["ano", "processo"],
  objeto: ["objeto"],
  modalidade: ["modalidade"],
  orgao: ["left(id_pncp, 14)"],
  abertura: ["data_abertura"],
  valor: ["valor_estimado"],
  status: ["status"],
  publicacao: ["data_publicacao"],
} as const;

export type Ordem = keyof typeof ORDENS;
export type Direcao = "asc" | "desc";

export type Filtros = {
  status?: Status;
  modalidade?: string;
  orgao?: string;
  de?: string;
  ate?: string;
  q?: string;
  ordem: Ordem;
  dir: Direcao;
  pagina: number;
};

type Bruto = Record<string, string | string[] | undefined>;

const PADRAO = { ordem: "publicacao", dir: "desc", pagina: 1 } as const;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function texto(valor: string | undefined, limite: number): string | undefined {
  const t = valor?.trim();
  return t ? t.slice(0, limite) : undefined;
}

function dataValida(valor: string | undefined): string | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const [a, m, d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  // 2026-02-30 vira 2 de março no Date; comparar de volta pega isso.
  const existe =
    data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
  return existe ? valor : undefined;
}

export function lerFiltros(bruto: Bruto): Filtros {
  const f: Filtros = { ...PADRAO };

  const status = primeiro(bruto.status);
  if (status && Object.hasOwn(STATUS_VALIDOS, status)) f.status = status as Status;

  // Modalidade é texto livre porque o PNCP cria valores novos. Como só chega
  // ao banco como parâmetro, um valor desconhecido devolve zero linhas.
  const modalidade = primeiro(bruto.modalidade)?.trim();
  if (modalidade && modalidade.length <= 100) f.modalidade = modalidade;

  const orgao = primeiro(bruto.orgao);
  if (orgao && Object.hasOwn(ORGAOS, orgao)) f.orgao = orgao;

  const de = dataValida(primeiro(bruto.de));
  if (de) f.de = de;
  const ate = dataValida(primeiro(bruto.ate));
  if (ate) f.ate = ate;

  const q = texto(primeiro(bruto.q), 200);
  if (q) f.q = q;

  const ordem = primeiro(bruto.ordem);
  if (ordem && Object.hasOwn(ORDENS, ordem)) f.ordem = ordem as Ordem;

  const dir = primeiro(bruto.dir);
  if (dir === "asc" || dir === "desc") f.dir = dir;

  const pagina = primeiro(bruto.pagina);
  if (pagina && /^\d+$/.test(pagina) && Number(pagina) >= 1) f.pagina = Number(pagina);

  return f;
}

export type Consulta = {
  where: string;
  valores: unknown[];
  orderBy: string;
  limit: number;
  offset: number;
};

const FUSO = "'America/Sao_Paulo'";

export function montarConsulta(f: Filtros): Consulta {
  const condicoes: string[] = [];
  const valores: unknown[] = [];
  const param = (valor: unknown) => {
    valores.push(valor);
    return `$${valores.length}`;
  };

  if (f.status) condicoes.push(`status = ${param(f.status)}`);
  if (f.modalidade) condicoes.push(`modalidade = ${param(f.modalidade)}`);
  if (f.orgao) condicoes.push(`left(id_pncp, 14) = ${param(f.orgao)}`);
  // O período conta o dia inteiro em Brasília: "até 31/01" inclui 31/01 às 23h.
  if (f.de)
    condicoes.push(`data_publicacao >= (${param(f.de)}::date)::timestamp at time zone ${FUSO}`);
  if (f.ate)
    condicoes.push(`data_publicacao < (${param(f.ate)}::date + 1)::timestamp at time zone ${FUSO}`);
  // Mesma expressão do índice GIN licitacoes_objeto_busca_idx, senão ele não é usado.
  if (f.q)
    condicoes.push(
      `to_tsvector('portuguese', objeto) @@ plainto_tsquery('portuguese', ${param(f.q)})`,
    );

  return {
    where: condicoes.length ? `where ${condicoes.join(" and ")}` : "",
    valores,
    // O id desempata: sem ele, linhas com a mesma data trocam de página entre
    // uma requisição e outra.
    orderBy: [...ORDENS[f.ordem].map((col) => `${col} ${f.dir} nulls last`), "id desc"].join(", "),
    limit: POR_PAGINA,
    offset: (f.pagina - 1) * POR_PAGINA,
  };
}

/** Link para o Painel com os filtros atuais e as mudanças pedidas. Mudar
    qualquer coisa além da página volta para a página 1. */
export function hrefCom(f: Filtros, mudancas: Partial<Filtros>): string {
  const novo: Filtros = { ...f, ...mudancas };
  if (!("pagina" in mudancas)) novo.pagina = 1;

  const params = new URLSearchParams();
  const chaves = ["status", "modalidade", "orgao", "de", "ate", "q", "ordem", "dir", "pagina"] as const;
  for (const chave of chaves) {
    const valor = novo[chave];
    if (valor === undefined || valor === PADRAO[chave as keyof typeof PADRAO]) continue;
    params.set(chave, String(valor));
  }
  const busca = params.toString();
  return busca ? `/?${busca}` : "/";
}
