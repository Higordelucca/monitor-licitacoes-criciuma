import Link from "next/link";
import { cnpj, inteiro } from "@/lib/format";
import type { ResumoEmpresa } from "@/lib/empresas";

/* Lista de empresas com vitórias e participações, usada em /empresas e /buscar. */

export function ListaEmpresas({ empresas }: { empresas: ResumoEmpresa[] }) {
  if (empresas.length === 0) {
    return (
      <p className="rounded-card border border-borda bg-superficie p-6 text-texto-suave">
        Nenhuma empresa encontrada.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
      {empresas.map((e) => (
        <li key={e.cnpj}>
          <Link
            href={`/empresas/${e.cnpj}`}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 hover:bg-primaria-clara/40"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-texto">{e.razao_social}</span>
              <span className="font-mono text-legenda text-texto-suave">{cnpj(e.cnpj)}</span>
              {e.porte ? <span className="text-legenda text-texto-suave"> · {e.porte}</span> : null}
            </span>
            <span className="text-legenda text-texto-2">
              <span className="font-mono tabular-nums">{inteiro(e.vitorias)}</span>{" "}
              {e.vitorias === "1" ? "vitória" : "vitórias"} em{" "}
              <span className="font-mono tabular-nums">{inteiro(e.participacoes)}</span>{" "}
              {e.participacoes === "1" ? "participação" : "participações"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
