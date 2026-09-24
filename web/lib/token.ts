import { jwtVerify, SignJWT } from "jose";

/* Token de sessão: JWT HS256 no cookie `sessao`. Este módulo não toca banco
   nem argon2 para poder rodar no proxy.ts, que confere toda requisição.

   O token carrega o necessário para o proxy decidir sem consultar o banco:
   quem é, o papel e se ainda precisa trocar a senha. Desativar um usuário só
   tem efeito imediato porque as páginas conferem `ativo` no banco
   (lib/sessao.ts); o proxy sozinho deixaria a sessão valer até expirar. */

export const COOKIE = "sessao";
export const SEGUNDOS_SESSAO = 7 * 24 * 60 * 60;

export type Papel = "admin" | "leitor";
export type Sessao = { id: string; login: string; papel: Papel; trocarSenha: boolean };

function chave(segredo: string) {
  // 32 bytes é o mínimo razoável para HS256. Segredo curto é erro de
  // configuração e tem de aparecer, não virar sessão fácil de forjar.
  if (segredo.length < 32) throw new Error("JWT_SECRET precisa de pelo menos 32 caracteres");
  return new TextEncoder().encode(segredo);
}

export async function criarToken(s: Sessao, segredo: string, agora: Date = new Date()): Promise<string> {
  const emitido = Math.floor(agora.getTime() / 1000);
  return new SignJWT({ login: s.login, papel: s.papel, trocarSenha: s.trocarSenha })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.id)
    .setIssuedAt(emitido)
    .setExpirationTime(emitido + SEGUNDOS_SESSAO)
    .sign(chave(segredo));
}

export async function lerToken(
  token: string | undefined,
  segredo: string,
  agora: Date = new Date(),
): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      algorithms: ["HS256"],
      currentDate: agora,
    });
    const { sub, login, papel, trocarSenha } = payload;
    if (typeof sub !== "string" || typeof login !== "string" || typeof trocarSenha !== "boolean") return null;
    if (papel !== "admin" && papel !== "leitor") return null;
    return { id: sub, login, papel, trocarSenha };
  } catch {
    return null;
  }
}

export function segredoDoAmbiente(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET não definida");
  return s;
}
