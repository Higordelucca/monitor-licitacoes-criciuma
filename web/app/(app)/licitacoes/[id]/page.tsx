import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BotaoSeguir } from "@/components/BotaoSeguir";
import { LinhaDoTempo } from "@/components/LinhaDoTempo";
import { ListaDocumentos, type Documento } from "@/components/ListaDocumentos";
import { Pilula, type Status } from "@/components/Pilula";
import { TabelaParticipantes, type Participante } from "@/components/TabelaParticipantes";
import { Termo } from "@/components/Termo";
import { consultar } from "@/lib/db";
import { etapas } from "@/lib/etapas";
import { dataCurta, dataHora, haQuantoTempo, moeda, numeroLicitacao } from "@/lib/format";
import { chaveModalidade, type ChaveGlossario } from "@/lib/glossario";
import { nomeOrgao } from "@/lib/orgaos";
import { exigirSessao } from "@/lib/sessao";

/* Detalhe da licitação (PDF 3.2). O id na URL é o `licitacoes.id`, para que o
   link possa ser mandado por e-mail ou WhatsApp (PDF pág. 2).

   O bloco de itens/lotes do PDF não existe ainda: o collector não grava os
   itens. */

type Licitacao = {
  id: string;
  processo: string | null;
  ano: number | null;
  modalidade: string | null;
  objeto: string;
  secretaria: string | null;
  orgao: string;
  criterio_julgamento: string | null;
  modo_disputa: string | null;
  data_publicacao: Date | null;
  data_abertura: Date | null;
  data_homologacao: Date | null;
  valor_estimado: string | null;
  valor_homologado: string | null;
  status: Status;
  url_pncp: string | null;
  atualizado_em: Date;
};

type EventoPncp = { id: string; tipo: string; descricao: string | null; data: Date };

/* cache() faz generateMetadata e a página dividirem a mesma consulta. */
const carregar = cache(async (id: string) => {
  // bigint do Postgres vai até 19 dígitos; mais que isso nem chega ao banco.
  if (!/^\d{1,18}$/.test(id)) return undefined;
  const [l] = await consultar<Licitacao>(
    `select id, processo, ano, modalidade, objeto, secretaria, left(id_pncp, 14) as orgao,
            criterio_julgamento, modo_disputa, data_publicacao, data_abertura,
            data_homologacao, valor_estimado, valor_homologado, status, url_pncp, atualizado_em
       from licitacoes
      where id = $1`,
    [id],
  );
  return l;
});

export async function generateMetadata(props: PageProps<"/licitacoes/[id]">): Promise<Metadata> {
  const l = await carregar((await props.params).id);
  if (!l) return { title: "Licitação não encontrada" };
  return {
    title: `${l.modalidade ?? "Licitação"} ${numeroLicitacao(l.processo, l.ano)} · Criciúma`,
    description: l.objeto.slice(0, 200),
  };
}

export default async function Detalhe(props: PageProps<"/licitacoes/[id]">) {
  const sessao = await exigirSessao();
  const l = await carregar((await props.params).id);
  if (!l) notFound();

  const [participantes, documentos, historico, [{ total_historico }], [{ seguindo }]] = await Promise.all([
    consultar<Participante>(
      // Mesma regra de lib/sancoes.ts (vigente): sem data final ou ainda por vir.
      `select p.cnpj, e.razao_social, e.porte, p.valor_proposta, p.situacao,
              exists (
                select 1 from sancoes s
                 where s.cnpj = p.cnpj
                   and (s.data_fim is null
                        or s.data_fim >= (now() at time zone 'America/Sao_Paulo')::date)
              ) as sancionada
         from participantes p
         join empresas e on e.cnpj = p.cnpj
        where p.licitacao_id = $1
        order by nullif(p.valor_proposta, 0) asc nulls last, e.razao_social`,
      [l.id],
    ),
    consultar<Documento>(
      `select id, tipo, titulo, url, data_publicacao
         from documentos
        where licitacao_id = $1
        order by data_publicacao desc nulls last, id desc`,
      [l.id],
    ),
    consultar<EventoPncp>(
      `select id, tipo, descricao, data
         from eventos
        where licitacao_id = $1
        order by data desc
        limit 10`,
      [l.id],
    ),
    consultar<{ total_historico: string }>(
      "select count(*) as total_historico from eventos where licitacao_id = $1",
      [l.id],
    ),
    consultar<{ seguindo: boolean }>(
      "select exists (select 1 from seguindo where user_id = $1 and licitacao_id = $2) as seguindo",
      [sessao.id, l.id],
    ),
  ]);

  const numero = numeroLicitacao(l.processo, l.ano);
  const chaveMod = chaveModalidade(l.modalidade);

  const dados: { rotulo: string; valor: React.ReactNode; termo?: ChaveGlossario; mono?: boolean }[] = [
    { rotulo: "Órgão", valor: nomeOrgao(l.orgao) },
    { rotulo: "Unidade compradora", valor: l.secretaria ?? "—" },
    { rotulo: "Critério de julgamento", valor: l.criterio_julgamento ?? "—", termo: "criterio_julgamento" },
    { rotulo: "Modo de disputa", valor: l.modo_disputa ?? "—", termo: "modo_disputa" },
    { rotulo: "Publicação no PNCP", valor: dataCurta(l.data_publicacao), mono: true },
    { rotulo: "Abertura", valor: l.data_abertura ? dataHora(l.data_abertura) : "—", mono: true },
    { rotulo: "Valor estimado", valor: moeda(l.valor_estimado), termo: "valor_estimado", mono: true },
    { rotulo: "Valor homologado", valor: moeda(l.valor_homologado), termo: "valor_homologado", mono: true },
  ];

  const abas = [
    { href: "#resumo", rotulo: "Resumo" },
    { href: "#participantes", rotulo: `Participantes (${participantes.length})` },
    { href: "#documentos", rotulo: `Documentos (${documentos.length})` },
    { href: "#historico", rotulo: "Histórico" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 sm:px-10">
      <nav aria-label="Trilha" className="text-legenda text-texto-suave">
        <Link href="/" className="hover:text-primaria">
          Licitações
        </Link>{" "}
        / <span className="font-mono">{numero}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-4xl min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-texto-2">
            <span className="font-semibold">
              {chaveMod ? <Termo chave={chaveMod}>{l.modalidade}</Termo> : (l.modalidade ?? "Licitação")}{" "}
              nº <span className="font-mono">{numero}</span>
            </span>
            <Pilula status={l.status} explicar />
            <span className="flex items-center gap-1 text-legenda text-texto-suave">
              Fonte: PNCP <Termo chave="pncp" />
            </span>
          </div>
          <h1 className="mt-3 text-titulo-detalhe leading-tight font-bold text-texto">{l.objeto}</h1>
          <p className="mt-2 text-legenda text-texto-suave">
            {nomeOrgao(l.orgao)} · atualizado no monitor{" "}
            <span title={dataHora(l.atualizado_em)}>{haQuantoTempo(l.atualizado_em)}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <BotaoSeguir tipo="licitacao" id={l.id} seguindo={seguindo} />
          {l.url_pncp ? (
            <a
              href={l.url_pncp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-botao shrink-0 items-center rounded-controle border border-borda bg-superficie px-4 font-semibold text-texto-2 hover:border-primaria hover:text-primaria"
            >
              Abrir no PNCP ↗
            </a>
          ) : null}
        </div>
      </header>

      <nav aria-label="Seções" className="mt-6 flex gap-1 overflow-x-auto border-b border-borda">
        {abas.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="border-b-2 border-transparent px-3 py-2.5 font-semibold whitespace-nowrap text-texto-2 hover:border-primaria hover:text-primaria"
          >
            {a.rotulo}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          <section id="resumo" className="scroll-mt-24">
            <h2 className="mb-3 text-secao font-bold text-texto">Dados gerais</h2>
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-borda bg-borda-leve sm:grid-cols-2 lg:grid-cols-4">
              {dados.map((d) => (
                <div key={d.rotulo} className="bg-superficie p-4">
                  <dt className="flex items-center gap-1 text-legenda text-texto-suave">
                    {d.rotulo}
                    {d.termo ? <Termo chave={d.termo} /> : null}
                  </dt>
                  <dd className={`mt-1 text-texto ${d.mono ? "font-mono tabular-nums" : ""}`}>{d.valor}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="participantes" className="scroll-mt-24">
            <h2 className="mb-2 text-secao font-bold text-texto">Empresas participantes</h2>
            <TabelaParticipantes linhas={participantes} />
          </section>

          <section id="historico" className="scroll-mt-24">
            <h2 className="mb-2 text-secao font-bold text-texto">Histórico no PNCP</h2>
            <p className="mb-3 text-legenda text-texto-suave">
              Registro de cada alteração feita pela prefeitura no PNCP.{" "}
              {Number(total_historico) > historico.length
                ? `Mostrando as ${historico.length} mais recentes de ${Number(total_historico).toLocaleString("pt-BR")}.`
                : null}
            </p>
            {historico.length === 0 ? (
              <p className="text-legenda text-texto-suave">Nenhum registro.</p>
            ) : (
              <ul className="divide-y divide-borda-leve rounded-card border border-borda bg-superficie">
                {historico.map((h) => (
                  <li key={h.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-legenda">
                    <span className="text-texto">
                      {h.tipo}: {h.descricao ?? "registro"}
                    </span>
                    <span className="font-mono text-texto-suave">{dataHora(h.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section id="documentos" className="scroll-mt-24 rounded-card border border-borda bg-superficie p-5">
            <h2 className="mb-4 text-secao font-bold text-texto">Documentos</h2>
            <ListaDocumentos documentos={documentos} />
          </section>
          <section className="rounded-card border border-borda bg-superficie p-5">
            <h2 className="mb-4 flex items-center gap-1 text-secao font-bold text-texto">
              Andamento <Termo chave="etapas" />
            </h2>
            <LinhaDoTempo etapas={etapas(l)} />
          </section>
        </aside>
      </div>
    </main>
  );
}
