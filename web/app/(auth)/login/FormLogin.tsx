"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./acoes";

const CAMPO =
  "h-campo w-full rounded-controle border border-borda bg-superficie px-3 text-corpo text-texto focus:border-primaria focus:outline-none";

export function FormLogin({ volta }: { volta: string }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="volta" value={volta} />
      <div>
        <label htmlFor="login" className="mb-1 block text-legenda font-semibold text-texto-suave">
          Usuário
        </label>
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={estado.login}
          className={CAMPO}
        />
      </div>
      <div>
        <label htmlFor="senha" className="mb-1 block text-legenda font-semibold text-texto-suave">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className={CAMPO} />
      </div>
      {estado.erro ? (
        <p role="alert" className="rounded-controle bg-suspensa-fundo px-3 py-2 text-legenda text-suspensa-texto">
          {estado.erro}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enviando}
        className="h-botao w-full rounded-controle bg-primaria font-semibold text-superficie hover:bg-primaria-hover disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
