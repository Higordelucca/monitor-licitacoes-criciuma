import type { Metadata } from "next";
import Link from "next/link";
import { exigirSessao } from "@/lib/sessao";
import { FormSenha } from "./FormSenha";

/* Troca de senha. Fica fora do grupo (app) de propósito: o layout de lá manda
   quem tem senha temporária para cá, e aqui dentro isso viraria um laço. */

export const metadata: Metadata = { title: "Trocar senha · Monitor de Licitações · Criciúma" };

export default async function TrocarSenha() {
  const s = await exigirSessao({ permitirSenhaTemporaria: true });
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-card border border-borda bg-superficie p-8">
        <h1 className="text-secao font-bold text-texto">Trocar senha</h1>
        <p className="mt-1 mb-6 text-legenda text-texto-suave">
          {s.trocarSenha
            ? "Sua senha é temporária. Escolha uma senha nova para continuar."
            : `Usuário ${s.login}`}
        </p>
        <FormSenha />
        {s.trocarSenha ? null : (
          <Link href="/" className="mt-4 inline-block text-legenda font-semibold text-primaria">
            ← Voltar ao painel
          </Link>
        )}
      </div>
    </main>
  );
}
