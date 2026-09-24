import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { consultar } from "@/lib/db";
import { COOKIE, criarToken, lerToken, SEGUNDOS_SESSAO, segredoDoAmbiente, type Sessao } from "@/lib/token";

/* Sessão do lado do servidor. O proxy.ts só confere a assinatura do cookie;
   aqui a sessão é confrontada com o banco a cada requisição, para que
   desativar um usuário ou obrigar a troca de senha valha na hora, e não só
   quando o token de 7 dias expirar. */

type Linha = { id: string; login: string; papel: Sessao["papel"]; ativo: boolean; trocar_senha: boolean };

export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  const doToken = await lerToken(token, segredoDoAmbiente());
  if (!doToken) return null;

  const [u] = await consultar<Linha>(
    "select id, login, papel, ativo, trocar_senha from usuarios where id = $1",
    [doToken.id],
  );
  if (!u || !u.ativo) return null;
  return { id: u.id, login: u.login, papel: u.papel, trocarSenha: u.trocar_senha };
});

/** Para páginas e Server Actions: sem sessão, vai para o login; com senha
    temporária, vai trocar a senha antes de qualquer outra coisa. */
export async function exigirSessao({ permitirSenhaTemporaria = false } = {}): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  if (s.trocarSenha && !permitirSenhaTemporaria) redirect("/conta/senha");
  return s;
}

export async function gravarSessao(s: Sessao) {
  (await cookies()).set(COOKIE, await criarToken(s, segredoDoAmbiente()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEGUNDOS_SESSAO,
  });
}

export async function apagarSessao() {
  (await cookies()).delete(COOKIE);
}
