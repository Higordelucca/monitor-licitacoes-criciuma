import { FaixaAvisos } from "@/components/FaixaAvisos";
import { Header } from "@/components/Header";
import { avisosVigentes } from "@/lib/avisos";
import { consultar } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";
import { resumoSync, type FonteSync, type ResumoSync } from "@/lib/sincronizacao";

/* Moldura das telas do site: Header em cima, a tela embaixo. O site é
   fechado: o proxy.ts barra quem não tem cookie, e este layout confere a
   sessão contra o banco (usuário ativo, senha temporária já trocada).

   Com a sessão lida do cookie, toda página é renderizada a cada requisição —
   o revalidate de 60s que existia antes do login deixou de fazer sentido. */

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sessao = await exigirSessao();

  let sync: ResumoSync = { situacao: "falhou", sincronizadoEm: null };
  let naoLidos = 0;
  try {
    const [ultimos, contagem] = await Promise.all([
      consultar<FonteSync>(
        // Só o PNCP: o enriquecimento diário (Transparência, CNPJ) não diz se
        // as licitações estão em dia. Uma linha por fonte, com a última
        // tentativa e o último sucesso; fonte parada há 7 dias saiu da coleta.
        // Parcial é a rápida que adiou conferências pelo prazo: a busca e as
        // compras novas entraram, então conta como sincronizada.
        `select fonte,
                (array_agg(status order by iniciado_em desc))[1] as ultimo_status,
                max(iniciado_em) as ultimo_inicio,
                max(finalizado_em) filter (where status in ('ok', 'parcial')) as ultimo_ok
           from sync_log
          where fonte like 'PNCP%'
            and iniciado_em > now() - interval '7 days'
          group by fonte`,
      ),
      // Usa o índice parcial alertas_nao_lidos_idx.
      consultar<{ n: string }>("select count(*) as n from alertas where user_id = $1 and not lido", [sessao.id]),
    ]);
    sync = resumoSync(ultimos);
    naoLidos = Number(contagem[0]?.n ?? 0);
  } catch {
    // Sem banco, o Header ainda aparece; a tela mostra o erro.
  }

  return (
    <>
      <Header
        sync={sync}
        login={sessao.login}
        naoLidos={naoLidos}
      />
      <FaixaAvisos avisos={avisosVigentes()} />
      {children}
    </>
  );
}
