import { Header } from "@/components/Header";
import { consultar } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";

/* Moldura das telas do site: Header em cima, a tela embaixo. O site é
   fechado: o proxy.ts barra quem não tem cookie, e este layout confere a
   sessão contra o banco (usuário ativo, senha temporária já trocada).

   Com a sessão lida do cookie, toda página é renderizada a cada requisição —
   o revalidate de 60s que existia antes do login deixou de fazer sentido. */

type Sync = { finalizado_em: Date | null; status: string };

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sessao = await exigirSessao();

  let sync: Sync | undefined;
  let naoLidos = 0;
  try {
    const [ultimos, contagem] = await Promise.all([
      consultar<Sync>(
        `select finalizado_em, status
           from sync_log
          order by iniciado_em desc
          limit 1`,
      ),
      // Usa o índice parcial alertas_nao_lidos_idx.
      consultar<{ n: string }>("select count(*) as n from alertas where user_id = $1 and not lido", [sessao.id]),
    ]);
    sync = ultimos[0];
    naoLidos = Number(contagem[0]?.n ?? 0);
  } catch {
    // Sem banco, o Header ainda aparece; a tela mostra o erro.
  }

  return (
    <>
      <Header
        sincronizadoEm={sync?.finalizado_em ?? null}
        rodando={sync?.status === "rodando"}
        login={sessao.login}
        naoLidos={naoLidos}
      />
      {children}
    </>
  );
}
