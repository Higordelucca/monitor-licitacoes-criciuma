import type { Metadata } from "next";
import Link from "next/link";
import { marcarTodosLidos } from "@/app/(app)/acoes";
import { BotaoSeguir } from "@/components/BotaoSeguir";
import { agruparPorDia } from "@/lib/agrupar";
import { consultar } from "@/lib/db";
import { cnpj as mascaraCnpj, dataHora, haQuantoTempo, numeroLicitacao } from "@/lib/format";
import { exigirSessao } from "@/lib/sessao";

/* Alertas (PDF 4.4, trazida para a web): avisos agrupados por dia e, embaixo,
   tudo o que a pessoa segue. Os avisos nascem nos triggers da migration 006;
   esta tela só lê. As preferências por tipo do PDF ficaram de fora — os três
   avisos estão sempre ligados (ver CLAUDE.md). */

export const metadata: Metadata = { title: "Alertas · Monitor de Licitações · Criciúma" };

type Aviso = {
  id: string;
  tipo: "documento_novo" | "mudanca_status" | "empresa_venceu" | "contrato";
  titulo: string;
  texto: string | null;
  quantidade: number;
  lido: boolean;
  criado_em: Date;
};

type LicitacaoSeguida = { id: string; processo: string | null; ano: number | null; objeto: string };
type EmpresaSeguida = { cnpj: string; razao_social: string };

// Azul = informação, âmbar = prazo/status, verde = vitória e contrato (PDF 4.4, adaptado).
const COR: Record<Aviso["tipo"], string> = {
  documento_novo: "bg-primaria",
  mudanca_status: "bg-analise-texto",
  empresa_venceu: "bg-aberta-texto",
  contrato: "bg-aberta-texto",
};

function resumo(a: Aviso): string {
  if (a.tipo === "documento_novo" && a.quantidade > 1) return `${a.quantidade} documentos novos · último: ${a.texto}`;
  if (a.tipo === "mudanca_status" && a.quantidade > 1) return `${a.texto} (mudou ${a.quantidade} vezes)`;
  if (a.tipo === "contrato" && a.quantidade > 1) return `${a.quantidade} contratos novos · último: ${a.texto}`;
  return a.texto ?? "";
}

export default async function Alertas() {
  const s = await exigirSessao();

  const [avisos, licitacoes, empresas] = await Promise.all([
    consultar<Aviso>(
      `select id, tipo, titulo, texto, quantidade, lido, criado_em
         from alertas
        where user_id = $1
        order by criado_em desc
        limit 100`,
      [s.id],
    ),
    consultar<LicitacaoSeguida>(
      `select l.id, l.processo, l.ano, l.objeto
         from seguindo sg join licitacoes l on l.id = sg.licitacao_id
        where sg.user_id = $1
        order by sg.criado_em desc`,
      [s.id],
    ),
    consultar<EmpresaSeguida>(
      `select e.cnpj, e.razao_social
         from seguindo_empresas sg join empresas e on e.cnpj = sg.cnpj
        where sg.user_id = $1
        order by sg.criado_em desc`,
      [s.id],
    ),
  ]);

  const naoLidos = avisos.filter((a) => !a.lido).length;
  const grupos = agruparPorDia(avisos);

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8 sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-titulo font-bold text-texto">Alertas</h1>
          <p className="mt-1 text-texto-suave">
            Novidades nas licitações e empresas que você segue: documento novo, mudança de status e
            vitória de empresa.
          </p>
        </div>
        {naoLidos > 0 ? (
          <form action={marcarTodosLidos}>
            <button
              type="submit"
              className="inline-flex h-botao items-center rounded-controle border border-borda bg-superficie px-4 font-semibold text-texto-2 hover:bg-borda-leve"
            >
              Marcar todos como lidos
            </button>
          </form>
        ) : null}
      </div>

      {grupos.length === 0 ? (
        <p className="mt-8 rounded-card border border-borda bg-superficie p-6 text-texto-suave">
          Nenhum alerta ainda. Siga uma licitação no Detalhe ou uma empresa na Ficha para ser avisado
          das novidades.
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g.rotulo} className="mt-8">
            <h2 className="mb-2 text-legenda font-semibold tracking-wide text-texto-suave uppercase">{g.rotulo}</h2>
            <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
              {g.itens.map((a) => (
                <li key={a.id}>
                  {/* <a> e não <Link>: o Link pré-carrega a URL, e abrir o
                      aviso marca como lido — seria marcado sem clique. */}
                  <a
                    href={`/alertas/abrir/${a.id}`}
                    className={`flex gap-3 px-4 py-3 hover:bg-primaria-clara/40 ${a.lido ? "opacity-70" : ""}`}
                  >
                    <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-pilula ${COR[a.tipo]}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-texto ${a.lido ? "" : "font-semibold"}`}>
                        {a.titulo}
                        {a.lido ? null : <span className="sr-only"> (não lido)</span>}
                      </span>
                      <span className="line-clamp-2 text-legenda text-texto-2">{resumo(a)}</span>
                    </span>
                    <span title={dataHora(a.criado_em)} className="shrink-0 text-legenda text-texto-suave">
                      {haQuantoTempo(a.criado_em)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section className="mt-12">
        <h2 className="text-secao font-bold text-texto">O que você segue</h2>

        <h3 className="mt-4 mb-2 font-semibold text-texto-2">Licitações ({licitacoes.length})</h3>
        {licitacoes.length === 0 ? (
          <p className="text-legenda text-texto-suave">Nenhuma. Use o botão “Seguir licitação” no Detalhe.</p>
        ) : (
          <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
            {licitacoes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/licitacoes/${l.id}`} className="group min-w-0">
                  <span className="font-mono text-legenda text-texto-suave">{numeroLicitacao(l.processo, l.ano)}</span>
                  <span className="line-clamp-1 text-texto group-hover:text-primaria">{l.objeto}</span>
                </Link>
                <BotaoSeguir tipo="licitacao" id={l.id} seguindo />
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 mb-2 font-semibold text-texto-2">Empresas ({empresas.length})</h3>
        {empresas.length === 0 ? (
          <p className="text-legenda text-texto-suave">Nenhuma. Use o botão “Seguir empresa” na Ficha.</p>
        ) : (
          <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
            {empresas.map((e) => (
              <li key={e.cnpj} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/empresas/${e.cnpj}`} className="group min-w-0">
                  <span className="block text-texto group-hover:text-primaria">{e.razao_social}</span>
                  <span className="font-mono text-legenda text-texto-suave">{mascaraCnpj(e.cnpj)}</span>
                </Link>
                <BotaoSeguir tipo="empresa" cnpj={e.cnpj} seguindo />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
