import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, lerToken, segredoDoAmbiente } from "@/lib/token";

/* Primeira barreira do site fechado (ver CLAUDE.md, "Decisões das fases 5 e
   6"): sem cookie de sessão com assinatura válida, toda rota leva ao login.

   Só confere a assinatura — não consulta o banco. Usuário desativado e troca
   de senha obrigatória são conferidos de novo em lib/sessao.ts, em toda
   página e Server Action. */

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sessao = await lerToken(req.cookies.get(COOKIE)?.value, segredoDoAmbiente());

  if (pathname === "/login") {
    // Quem já entrou e abre o login vai direto para o Painel.
    return sessao ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (!sessao) {
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("volta", pathname + search);
    return NextResponse.redirect(login);
  }

  if (sessao.trocarSenha && pathname !== "/conta/senha") {
    return NextResponse.redirect(new URL("/conta/senha", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Tudo menos os arquivos estáticos do Next e os ícones.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
