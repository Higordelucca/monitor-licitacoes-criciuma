"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoSenha } from "./acoes";

const CAMPO =
  "h-campo w-full rounded-controle border border-borda bg-superficie px-3 text-corpo text-texto focus:border-primaria focus:outline-none";

export function FormSenha() {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(trocarSenha, {});

  return (
    <form action={acao} className="space-y-4">
      {[
        { nome: "atual", rotulo: "Senha atual", auto: "current-password" },
        { nome: "nova", rotulo: "Senha nova", auto: "new-password" },
        { nome: "repetida", rotulo: "Repita a senha nova", auto: "new-password" },
      ].map((c) => (
        <div key={c.nome}>
          <label htmlFor={c.nome} className="mb-1 block text-legenda font-semibold text-texto-suave">
            {c.rotulo}
          </label>
          <input id={c.nome} name={c.nome} type="password" autoComplete={c.auto} required className={CAMPO} />
        </div>
      ))}
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
        {enviando ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}
