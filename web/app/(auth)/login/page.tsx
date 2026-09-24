import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/destino";
import { FormLogin } from "./FormLogin";

/* Login (fase 5). Não há cadastro: as contas são criadas pelo admin com
   `npm run usuario -- criar`. */

export const metadata: Metadata = { title: "Entrar · Monitor de Licitações · Criciúma" };

export default async function Login(props: PageProps<"/login">) {
  const { volta } = await props.searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-card border border-borda bg-superficie p-8">
        <p className="text-secao font-bold text-primaria">Monitor de Licitações</p>
        <p className="text-legenda text-texto-suave">Prefeitura de Criciúma · SC</p>
        <h1 className="mt-6 mb-4 text-secao font-bold text-texto">Entrar</h1>
        <FormLogin volta={destinoSeguro(Array.isArray(volta) ? volta[0] : volta)} />
        <p className="mt-6 text-legenda text-texto-suave">
          Acesso só para usuários cadastrados. Para pedir uma conta ou uma senha nova, fale com o
          administrador do monitor.
        </p>
      </div>
    </main>
  );
}
