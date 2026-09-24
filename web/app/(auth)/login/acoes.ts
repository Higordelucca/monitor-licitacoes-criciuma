"use server";

import { redirect } from "next/navigation";
import { consultar } from "@/lib/db";
import { destinoSeguro } from "@/lib/destino";
import { normalizarLogin } from "@/lib/login";
import { aposFalha, bloqueado, conferirSenha, hashDeFachada } from "@/lib/senha";
import { gravarSessao } from "@/lib/sessao";
import type { Sessao } from "@/lib/token";

export type EstadoLogin = { erro?: string; login?: string };

type Usuario = {
  id: string;
  login: string;
  senha_hash: string;
  papel: Sessao["papel"];
  ativo: boolean;
  trocar_senha: boolean;
  falhas_login: number;
  bloqueado_ate: Date | null;
};

const INCORRETO = "Usuário ou senha incorretos.";

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const digitado = String(dados.get("login") ?? "").slice(0, 40);
  const login = normalizarLogin(digitado);
  const senha = String(dados.get("senha") ?? "").slice(0, 200);
  const volta = destinoSeguro(dados.get("volta"));
  if (!digitado.trim() || !senha) return { erro: "Informe usuário e senha.", login: digitado };

  const [u] = await consultar<Usuario>(
    `select id, login, senha_hash, papel, ativo, trocar_senha, falhas_login, bloqueado_ate
       from usuarios
      where login = $1`,
    [login],
  );

  const agora = new Date();
  if (u && bloqueado(u.bloqueado_ate, agora)) {
    return { erro: "Muitas tentativas erradas. Tente de novo em 15 minutos.", login: digitado };
  }

  // Confere contra um hash falso quando o usuário não existe, para o tempo de
  // resposta não dizer quais usuários têm conta.
  const certa = await conferirSenha(u?.senha_hash ?? (await hashDeFachada()), senha);

  if (!u || !u.ativo || !certa) {
    if (u) {
      // Não é atômico: duas tentativas simultâneas podem contar como uma.
      // Num site de poucos usuários convidados, o custo não compensa.
      const r = aposFalha(u.falhas_login, agora);
      await consultar("update usuarios set falhas_login = $2, bloqueado_ate = $3 where id = $1", [
        u.id,
        r.falhas,
        r.bloqueadoAte,
      ]);
    }
    return { erro: INCORRETO, login: digitado };
  }

  await consultar("update usuarios set falhas_login = 0, bloqueado_ate = null where id = $1", [u.id]);
  await gravarSessao({ id: u.id, login: u.login, papel: u.papel, trocarSenha: u.trocar_senha });
  redirect(u.trocar_senha ? "/conta/senha" : volta);
}
