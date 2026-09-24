import Link from "next/link";
import { Pilula, type Status } from "@/components/Pilula";
import { Termo } from "@/components/Termo";
import { hrefCom, type Filtros, type Ordem } from "@/lib/filtros";
import { dataCurta, moeda, numeroLicitacao } from "@/lib/format";
import { chaveModalidade } from "@/lib/glossario";
import { nomeOrgao } from "@/lib/orgaos";

export type LinhaLicitacao = {
  id: string;
  processo: string | null;
  ano: number | null;
  objeto: string;
  modalidade: string | null;
  orgao: string;
  data_abertura: Date | null;
  valor_estimado: string | null;
  status: Status;
};

/* Colunas do PDF 3.1, item 6.2, com Órgão no lugar de Secretaria (ver
   CLAUDE.md, "Decisões da fase 4"). Texto começa em A→Z; número, data e valor
   começam do maior. */
const COLUNAS: { ordem: Ordem; rotulo: string; primeira: "asc" | "desc"; className: string }[] = [
  { ordem: "numero", rotulo: "Nº/Ano", primeira: "desc", className: "w-28" },
  { ordem: "objeto", rotulo: "Objeto", primeira: "asc", className: "" },
  { ordem: "modalidade", rotulo: "Modalidade", primeira: "asc", className: "w-40" },
  { ordem: "orgao", rotulo: "Órgão", primeira: "asc", className: "w-40" },
  { ordem: "abertura", rotulo: "Abertura", primeira: "desc", className: "w-28" },
  { ordem: "valor", rotulo: "Valor estimado", primeira: "desc", className: "w-40 text-right" },
  { ordem: "status", rotulo: "Status", primeira: "asc", className: "w-36" },
];

export function TabelaLicitacoes({ linhas, filtros }: { linhas: LinhaLicitacao[]; filtros: Filtros }) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-card border border-borda bg-superficie p-6 text-texto-suave">
        Nenhuma licitação encontrada com esses filtros.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-borda bg-superficie">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr className="border-b border-borda text-legenda text-texto-suave">
            {COLUNAS.map((c) => (
              <Th key={c.ordem} coluna={c} filtros={filtros} />
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const chave = chaveModalidade(l.modalidade);
            return (
              <tr
                key={l.id}
                className="h-linha border-b border-borda-leve last:border-0 align-top hover:bg-primaria-clara/40"
              >
                <Td className="font-mono whitespace-nowrap text-texto-2 tabular-nums">
                  <Link href={`/licitacoes/${l.id}`} className="hover:text-primaria">
                    {numeroLicitacao(l.processo, l.ano)}
                  </Link>
                </Td>
                <Td>
                  {/* Não é a linha inteira que vira link, como pede o PDF: a
                      pílula e a modalidade abrem o balão ⓘ, e botão dentro de
                      link é HTML inválido. Número e objeto levam ao Detalhe. */}
                  <Link href={`/licitacoes/${l.id}`} className="line-clamp-2 text-texto hover:text-primaria hover:underline">
                    {l.objeto}
                  </Link>
                </Td>
                <Td className="text-legenda text-texto-suave">
                  {chave ? <Termo chave={chave}>{l.modalidade}</Termo> : (l.modalidade ?? "—")}
                </Td>
                <Td className="text-legenda text-texto-suave">{nomeOrgao(l.orgao)}</Td>
                <Td className="font-mono whitespace-nowrap text-legenda text-texto-suave tabular-nums">
                  {dataCurta(l.data_abertura)}
                </Td>
                <Td className="text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                  {moeda(l.valor_estimado)}
                </Td>
                <Td>
                  <Pilula status={l.status} explicar />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ coluna, filtros }: { coluna: (typeof COLUNAS)[number]; filtros: Filtros }) {
  const ativa = filtros.ordem === coluna.ordem;
  const proxima = ativa ? (filtros.dir === "asc" ? "desc" : "asc") : coluna.primeira;
  const seta = ativa ? (filtros.dir === "asc" ? "↑" : "↓") : "";

  return (
    <th
      aria-sort={ativa ? (filtros.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-4 py-3 font-semibold ${coluna.className}`}
    >
      <Link
        href={hrefCom(filtros, { ordem: coluna.ordem, dir: proxima })}
        className={`hover:text-primaria ${ativa ? "text-texto" : ""}`}
      >
        {coluna.rotulo} <span aria-hidden>{seta}</span>
      </Link>
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
