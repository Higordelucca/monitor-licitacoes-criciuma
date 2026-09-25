import Link from "next/link";
import { Termo } from "@/components/Termo";
import { moeda, moedaUnitaria, quantidade } from "@/lib/format";
import { resumoResultados, type ResultadoItem } from "@/lib/itens";

/* Itens da licitação, com o vencedor de cada um. No celular a tabela vira
   uma lista: a descrição do item é longa demais para rolar de lado. */

export type Item = {
  numero: number;
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
  valor_unitario_estimado: string | null;
  valor_total_estimado: string | null;
  sigiloso: boolean;
  situacao: string | null;
  resultados: ResultadoItem[];
};

export function TabelaItens({
  itens,
  total,
  linkTodos,
}: {
  itens: Item[];
  total: number;
  /** Presente quando há mais itens do que os mostrados. */
  linkTodos?: string;
}) {
  if (total === 0) {
    return (
      <p className="rounded-card border border-borda bg-superficie p-6 text-texto-suave">
        Nenhum item publicado no PNCP.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-borda bg-superficie md:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-borda text-legenda text-texto-suave">
              <th className="w-14 px-4 py-3 font-semibold">Nº</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">Quantidade</th>
              <th className="w-40 px-4 py-3 text-right font-semibold">Estimado</th>
              <th className="w-56 px-4 py-3 font-semibold">Vencedor</th>
              <th className="w-40 px-4 py-3 text-right font-semibold">Homologado</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const { vencedor, outros } = resumoResultados(i.resultados);
              return (
                <tr key={i.numero} className="border-b border-borda-leve align-top last:border-0">
                  <td className="px-4 py-3 font-mono text-texto-2">{i.numero}</td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-3 text-texto" title={i.descricao ?? undefined}>
                      {i.descricao ?? "—"}
                    </p>
                    {i.situacao ? <p className="mt-1 text-legenda text-texto-suave">{i.situacao}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                    {quantidade(i.quantidade, i.unidade)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                    <Estimado item={i} />
                  </td>
                  <td className="px-4 py-3">
                    <Vencedor vencedor={vencedor} outros={outros} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                    <Homologado vencedor={vencedor} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie md:hidden">
        {itens.map((i) => {
          const { vencedor, outros } = resumoResultados(i.resultados);
          return (
            <li key={i.numero} className="space-y-2 p-4">
              <p className="text-texto">
                <span className="mr-2 font-mono text-texto-suave">{i.numero}</span>
                <span className="line-clamp-4">{i.descricao ?? "—"}</span>
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-legenda">
                <dt className="text-texto-suave">Quantidade</dt>
                <dd className="text-right font-mono text-texto-2">{quantidade(i.quantidade, i.unidade)}</dd>
                <dt className="text-texto-suave">Estimado</dt>
                <dd className="text-right font-mono text-texto-2">
                  <Estimado item={i} />
                </dd>
                <dt className="text-texto-suave">Homologado</dt>
                <dd className="text-right font-mono text-texto-2">
                  <Homologado vencedor={vencedor} />
                </dd>
              </dl>
              <Vencedor vencedor={vencedor} outros={outros} />
            </li>
          );
        })}
      </ul>

      {linkTodos ? (
        <p className="mt-3">
          <Link href={linkTodos} scroll={false} className="font-semibold text-primaria hover:underline">
            Mostrar todos os {total.toLocaleString("pt-BR")} itens
          </Link>
        </p>
      ) : null}
    </>
  );
}

function Estimado({ item }: { item: Item }) {
  if (item.sigiloso) {
    return (
      <Termo chave="orcamento_sigiloso">
        <span className="font-sans text-texto-suave">Sigiloso</span>
      </Termo>
    );
  }
  return (
    <>
      {moeda(item.valor_total_estimado)}
      {item.valor_unitario_estimado ? (
        <span className="block text-legenda text-texto-suave">
          {moedaUnitaria(item.valor_unitario_estimado)} un.
        </span>
      ) : null}
    </>
  );
}

function Homologado({ vencedor }: { vencedor: ResultadoItem | null }) {
  // Registrada atrás da vencedora vem com zero do PNCP: zero é "não informado".
  if (!vencedor || !(Number(vencedor.valor_total_homologado) > 0)) return <>—</>;
  return (
    <>
      {moeda(vencedor.valor_total_homologado)}
      {vencedor.valor_unitario_homologado ? (
        <span className="block text-legenda text-texto-suave">
          {moedaUnitaria(vencedor.valor_unitario_homologado)} un.
        </span>
      ) : null}
    </>
  );
}

function Vencedor({ vencedor, outros }: { vencedor: ResultadoItem | null; outros: number }) {
  if (!vencedor) return <span className="text-legenda text-texto-suave">Sem resultado publicado</span>;
  return (
    <div className="text-legenda">
      {vencedor.cnpj ? (
        <Link href={`/empresas/${vencedor.cnpj}`} className="text-texto hover:text-primaria hover:underline">
          {vencedor.razao_social ?? vencedor.cnpj}
        </Link>
      ) : (
        // O CPF e o nome de pessoa física não são guardados.
        <span className="text-texto">Pessoa física</span>
      )}
      {outros > 0 ? (
        <span className="mt-0.5 flex items-center gap-1 text-texto-suave">
          + {outros} {outros === 1 ? "registrada" : "registradas"} <Termo chave="habilitada" />
        </span>
      ) : null}
    </div>
  );
}
