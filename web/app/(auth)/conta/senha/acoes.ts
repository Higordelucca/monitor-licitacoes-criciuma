"use server";

import { redirect } from "next/navigation";
import { consultar } from "@/lib/db";
import { conferirSenha, hashSenha, senhaAceitavel } from "@/lib/senha";
import { exigirSessao, gravarSessao } from "@/lib/sessao";

export type EstadoSenha = { erro?: string };

export async function trocarSenha(_anterior: EstadoSenha, dados: FormData): Promise<EstadoSenha> {
  const s = await exigirSessao({ permitirSenhaTemporaria: true });
  const atual = String(dados.get("atual") ?? "").slice(0, 200);
  const nova = String(dados.get("nova") ?? "");
  const repetida = String(dados.get("repetida") ?? "");

  if (!senhaAceitavel(nova)) return { erro: "Informe uma senha nova de até 200 caracteres." };
  if (nova !== repetida) return { erro: "As duas senhas novas não são iguais." };
  if (nova === atual) return { erro: "A senha nova precisa ser diferente da atual." };

  const [u] = await consultar<{ senha_hash: string }>("select senha_hash from usuarios where id = $1", [s.id]);
  if (!u || !(await conferirSenha(u.senha_hash, atual))) return { erro: "A senha atual está incorreta." };

  await consultar("update usuarios set senha_hash = $2, trocar_senha = false where id = $1", [
    s.id,
    await hashSenha(nova),
  ]);
  // Token novo: o antigo ainda diz trocarSenha = true e o proxy voltaria aqui.
  await gravarSessao({ ...s, trocarSenha: false });
  redirect("/");
}
