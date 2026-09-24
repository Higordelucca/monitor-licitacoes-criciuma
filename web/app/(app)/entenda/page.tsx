import type { Metadata } from "next";
import { GLOSSARIO, GRUPOS, type Entrada } from "@/lib/glossario";

/* Página Entenda: explica ao público os termos que aparecem no site. Não está
   no PDF; foi pedida pelo Higor (ver CLAUDE.md, "Decisões da fase 4").

   Todo o conteúdo vem de lib/glossario.ts. Cada termo tem âncora com a chave
   do glossário — é para onde o "Saiba mais" do balão ⓘ aponta — e cada grupo
   tem âncora com o id do grupo, para o ⓘ dos filtros. */

export const metadata: Metadata = {
  title: "Entenda · Monitor de Licitações · Criciúma",
  description: "O que significa cada situação, tipo de contratação e etapa de uma licitação.",
};

const entradas = Object.entries(GLOSSARIO) as [string, Entrada][];

export default function Entenda() {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8 sm:px-10">
      <h1 className="text-titulo font-bold text-texto">Entenda as licitações</h1>
      <p className="mt-2 text-texto-2">
        Licitação é o processo pelo qual a prefeitura escolhe quem vai vender um produto ou
        prestar um serviço para ela. As regras estão na Lei 14.133, de 2021. Esta página explica
        os termos que aparecem no monitor.
      </p>

      <nav aria-label="Seções" className="mt-6 flex flex-wrap gap-2">
        {GRUPOS.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="rounded-pilula border border-borda bg-superficie px-3 py-1.5 text-legenda font-semibold text-texto-2 hover:border-primaria hover:text-primaria"
          >
            {g.titulo}
          </a>
        ))}
      </nav>

      {GRUPOS.map((g) => (
        <section key={g.id} id={g.id} className="mt-10 scroll-mt-24">
          <h2 className="text-secao font-bold text-texto">{g.titulo}</h2>
          <p className="mt-1 text-texto-suave">{g.intro}</p>

          <div className="mt-4 space-y-3">
            {entradas
              .filter(([, e]) => e.grupo === g.id)
              .map(([chave, e]) => (
                <article
                  key={chave}
                  id={chave}
                  className="scroll-mt-24 rounded-card border border-borda bg-superficie p-5 target:border-primaria target:bg-primaria-clara/30"
                >
                  <h3 className="font-bold text-texto">{e.termo}</h3>
                  <p className="mt-1 font-semibold text-texto-2">{e.curto}</p>
                  <div className="mt-3 space-y-2 text-texto-2">
                    {e.longo.map((paragrafo, i) => (
                      <p key={i}>{paragrafo}</p>
                    ))}
                  </div>
                  {e.baseLegal ? (
                    <p className="mt-3 text-legenda text-texto-suave">Base legal: {e.baseLegal}</p>
                  ) : null}
                </article>
              ))}
          </div>
        </section>
      ))}

      <p className="mt-12 border-t border-borda pt-6 text-legenda text-texto-suave">
        Este texto explica termos de forma simplificada e não substitui a leitura da lei nem a
        orientação jurídica.
      </p>
    </main>
  );
}
