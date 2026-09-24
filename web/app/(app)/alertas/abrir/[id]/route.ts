import { NextResponse, type NextRequest } from "next/server";
import { consultar } from "@/lib/db";
import { sessaoAtual } from "@/lib/sessao";

/* Abrir um aviso: marca como lido e leva ao Detalhe ou à Ficha. O `user_id`
   no where garante que ninguém marca nem descobre o aviso de outra pessoa
   trocando o número na URL. */

export async function GET(req: NextRequest, ctx: RouteContext<"/alertas/abrir/[id]">) {
  const sessao = await sessaoAtual();
  if (!sessao) return NextResponse.redirect(new URL("/login", req.url));

  const { id } = await ctx.params;
  if (!/^\d{1,18}$/.test(id)) return NextResponse.redirect(new URL("/alertas", req.url));

  const [a] = await consultar<{ licitacao_id: string | null; cnpj: string | null; tipo: string }>(
    `update alertas set lido = true
      where id = $1 and user_id = $2
      returning licitacao_id, cnpj, tipo`,
    [id, sessao.id],
  );

  // Empresa venceu leva à licitação que ela venceu; sem licitação, à ficha.
  const destino = a?.licitacao_id
    ? `/licitacoes/${a.licitacao_id}`
    : a?.cnpj
      ? `/empresas/${a.cnpj}`
      : "/alertas";
  return NextResponse.redirect(new URL(destino, req.url));
}
