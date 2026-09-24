import type { Metadata } from "next";
import Form from "next/form";
import { redirect } from "next/navigation";
import { ListaEmpresas } from "@/components/ListaEmpresas";
import { interpretarBusca } from "@/lib/busca";
import { buscarEmpresas, empresasQueMaisVenceram } from "@/lib/empresas";

/* Consulta de empresa (PDF 3.3, itens 2 e 3). Aceita CNPJ ou nome. CNPJ
   válido vai direto para a ficha; nome lista as empresas que batem. Sem
   busca, mostra as que mais venceram em Criciúma.

   O PDF pede que um CNPJ fora do banco seja buscado na API de CNPJ e gravado.
   Isso é a fase 3; por ora a ficha responde que a empresa não foi encontrada. */

export const metadata: Metadata = { title: "Empresas · Monitor de Licitações · Criciúma" };

export default async function Empresas(props: PageProps<"/empresas">) {
  const busca = interpretarBusca((await props.searchParams).q);
  if (busca.tipo === "cnpj") redirect(`/empresas/${busca.cnpj}`);

  const texto = busca.tipo === "texto" ? busca.texto : "";
  const empresas = texto ? await buscarEmpresas(texto) : await empresasQueMaisVenceram();

  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-8 sm:px-10">
      <h1 className="text-titulo font-bold text-texto">Empresas</h1>
      <p className="mt-1 text-texto-suave">
        Consulte uma empresa pelo CNPJ ou pelo nome e veja o histórico dela nas licitações de Criciúma.
      </p>

      <Form action="/empresas" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="busca-empresa" className="sr-only">
          CNPJ ou razão social
        </label>
        <input
          id="busca-empresa"
          name="q"
          type="search"
          defaultValue={texto}
          placeholder="00.000.000/0000-00 ou razão social"
          className="h-12 min-w-0 flex-1 rounded-controle border border-borda bg-superficie px-4 text-corpo text-texto focus:border-primaria focus:outline-none"
        />
        <button
          type="submit"
          className="h-12 rounded-controle bg-primaria px-6 font-semibold text-superficie hover:bg-primaria-hover"
        >
          Consultar
        </button>
      </Form>

      <h2 className="mt-8 mb-3 text-secao font-bold text-texto">
        {texto ? `Resultado para “${texto}”` : "Empresas que mais venceram"}
      </h2>
      <ListaEmpresas empresas={empresas} />
    </main>
  );
}
