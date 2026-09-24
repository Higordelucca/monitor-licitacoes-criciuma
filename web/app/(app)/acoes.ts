"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consultar } from "@/lib/db";
import { apagarSessao, exigirSessao } from "@/lib/sessao";

/* Server Actions do grupo (app). Cada uma confere a sessão por conta própria:
   uma Server Action é um endpoint público, e o proxy sozinho não basta. */

export async function sair() {
  await apagarSessao();
  redirect("/login");
}

/** Liga ou desliga "seguir" uma licitação. O id vem de campo oculto do
    formulário, então é validado como qualquer entrada. */
export async function alternarSeguirLicitacao(dados: FormData) {
  const s = await exigirSessao();
  const id = String(dados.get("id") ?? "");
  if (!/^\d{1,18}$/.test(id)) return;

  const removidos = await consultar("delete from seguindo where user_id = $1 and licitacao_id = $2 returning 1", [
    s.id,
    id,
  ]);
  if (removidos.length === 0) {
    // `where exists` evita erro de FK se o id não existir.
    await consultar(
      `insert into seguindo (user_id, licitacao_id)
       select $1, id from licitacoes where id = $2
       on conflict do nothing`,
      [s.id, id],
    );
  }
  revalidatePath("/", "layout");
}

export async function alternarSeguirEmpresa(dados: FormData) {
  const s = await exigirSessao();
  const cnpj = String(dados.get("cnpj") ?? "");
  if (!/^\d{14}$/.test(cnpj)) return;

  const removidos = await consultar("delete from seguindo_empresas where user_id = $1 and cnpj = $2 returning 1", [
    s.id,
    cnpj,
  ]);
  if (removidos.length === 0) {
    await consultar(
      `insert into seguindo_empresas (user_id, cnpj)
       select $1, cnpj from empresas where cnpj = $2
       on conflict do nothing`,
      [s.id, cnpj],
    );
  }
  revalidatePath("/", "layout");
}

export async function marcarTodosLidos() {
  const s = await exigirSessao();
  await consultar("update alertas set lido = true where user_id = $1 and not lido", [s.id]);
  revalidatePath("/", "layout");
}
