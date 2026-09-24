import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListaEmpresas } from "@/components/ListaEmpresas";
import { Pilula, type Status } from "@/components/Pilula";
import { interpretarBusca } from "@/lib/busca";
import { consultar } from "@/lib/db";
import { buscarEmpresas } from "@/lib/empresas";
import { hrefCom, lerFiltros } from "@/lib/filtros";
import { inteiro, numeroLicitacao } from "@/lib/format";

/* Resultado da busca global do Header (PDF 3.1, item 1.3): nº, objeto,
   empresa ou CNPJ. CNPJ válido vai direto para a ficha. O resto procura em
   licitações (objeto e número) e em empresas (razão social) ao mesmo tempo. */

export const metadata: Metadata = { title: "Busca · Monitor de Licitações · Criciúma" };

type Achado = { id: string; processo: string | null; ano: number | null; objeto: string; status: Status };

export default async function Buscar(props: PageProps<"/buscar">) {
  const busca = interpretarBusca((await props.searchParams).q);
  if (busca.tipo === "cnpj") redirect(`/empresas/${busca.cnpj}`);
  if (busca.tipo === "vazia") redirect("/");

  const texto = busca.texto;
  // Mesmo tsvector do índice GIN do objeto. O número é comparado como a tela
  // o mostra ("118/2026") ou só o processo.
  const onde = `where to_tsvector('portuguese', objeto) @@ plainto_tsquery('portuguese', $1)
                   or processo || '/' || ano = $1
                   or processo = $1`;

  const [licitacoes, [{ total }], empresas] = await Promise.all([
    consultar<Achado>(
      `select id, processo, ano, objeto, status from licitacoes ${onde}
        order by data_publicacao desc nulls last, id desc
        limit 10`,
      [texto],
    ),
    consultar<{ total: string }>(`select count(*) as total from licitacoes ${onde}`, [texto]),
    buscarEmpresas(texto, 10),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-8 sm:px-10">
      <h1 className="text-titulo font-bold text-texto">Busca: “{texto}”</h1>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-secao font-bold text-texto">
            Licitações <span className="font-mono text-texto-suave">({inteiro(total)})</span>
          </h2>
          {Number(total) > licitacoes.length ? (
            <Link href={hrefCom(lerFiltros({}), { q: texto })} className="font-semibold text-primaria hover:text-primaria-hover">
              Ver todas no painel →
            </Link>
          ) : null}
        </div>
        {licitacoes.length === 0 ? (
          <p className="rounded-card border border-borda bg-superficie p-6 text-texto-suave">Nenhuma licitação encontrada.</p>
        ) : (
          <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
            {licitacoes.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <Link href={`/licitacoes/${l.id}`} className="group min-w-0">
                  <span className="font-mono text-legenda text-texto-suave">{numeroLicitacao(l.processo, l.ano)}</span>
                  <span className="line-clamp-2 text-texto group-hover:text-primaria">{l.objeto}</span>
                </Link>
                <Pilula status={l.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-secao font-bold text-texto">Empresas</h2>
        <ListaEmpresas empresas={empresas} />
      </section>
    </main>
  );
}
