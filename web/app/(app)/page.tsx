import { Filtros } from "@/components/Filtros";
import { KpiCard } from "@/components/KpiCard";
import {
  FontesDados,
  ProximasAberturas,
  UltimasAtualizacoes,
  type Abertura,
  type Evento,
  type Fonte,
} from "@/components/Lateral";
import { Paginacao } from "@/components/Paginacao";
import { TabelaLicitacoes, type LinhaLicitacao } from "@/components/TabelaLicitacoes";
import { consultar } from "@/lib/db";
import { hrefCom, lerFiltros, montarConsulta } from "@/lib/filtros";
import { inteiro, moeda, moedaCurta } from "@/lib/format";

/* Painel geral (PDF 3.1).

   Os filtros moram na URL, então a página é renderizada a cada requisição —
   searchParams tira a rota do cache. São oito consultas pequenas em paralelo,
   todas por índice. */

type Kpis = {
  abertas: string;
  em_analise: string;
  homologadas_mes: string;
  valor_aberto: string;
};

export default async function Painel(props: PageProps<"/">) {
  const filtros = lerFiltros(await props.searchParams);
  const c = montarConsulta(filtros);
  const semFiltro = lerFiltros({});

  let kpis: Kpis | undefined;
  let linhas: LinhaLicitacao[] = [];
  let total = 0;
  let modalidades: string[] = [];
  let aberturas: Abertura[] = [];
  let eventos: Evento[] = [];
  let fontes: Fonte[] = [];
  let falha: string | null = null;

  try {
    let contagem: { total: string }[];
    let listaModalidades: { modalidade: string }[];
    [[kpis], linhas, contagem, listaModalidades, aberturas, eventos, fontes] = await Promise.all([
      consultar<Kpis>("select * from vw_kpis_painel"),
      consultar<LinhaLicitacao>(
        `select id, processo, ano, objeto, modalidade, left(id_pncp, 14) as orgao,
                data_abertura, valor_estimado, status
           from licitacoes
           ${c.where}
          order by ${c.orderBy}
          limit $${c.valores.length + 1} offset $${c.valores.length + 2}`,
        [...c.valores, c.limit, c.offset],
      ),
      consultar<{ total: string }>(`select count(*) as total from licitacoes ${c.where}`, c.valores),
      consultar<{ modalidade: string }>(
        `select modalidade from licitacoes
          where modalidade is not null
          group by modalidade
          order by count(*) desc`,
      ),
      consultar<Abertura>(
        `select id, processo, ano, objeto, data_abertura
           from licitacoes
          where data_abertura >= now()
          order by data_abertura
          limit 3`,
      ),
      // O PNCP registra um evento por item: uma licitação de 40 itens enche o
      // feed sozinha. Fica só o evento mais recente de cada licitação.
      consultar<Evento>(
        `select * from (
           select distinct on (e.licitacao_id)
                  e.id, e.licitacao_id, e.tipo, e.descricao, e.data, e.fonte, l.processo, l.ano
             from eventos e
             join licitacoes l on l.id = e.licitacao_id
            order by e.licitacao_id, e.data desc
         ) ultimos
          order by data desc
          limit 6`,
      ),
      // A última rodada de cada órgão; rodadas antigas não dizem nada do agora.
      consultar<Fonte>(
        `select distinct on (fonte) fonte, status, iniciado_em, finalizado_em
           from sync_log
          where fonte like 'PNCP%'
          order by fonte, iniciado_em desc`,
      ),
    ]);
    total = Number(contagem[0]?.total ?? 0);
    modalidades = listaModalidades.map((m) => m.modalidade);
  } catch (erro) {
    // A mensagem do driver não carrega a connection string, mas carrega host
    // e usuário em alguns casos. Só o texto curto vai para a tela.
    falha = erro instanceof Error ? erro.message : "erro desconhecido";
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 sm:px-10">
      <h1 className="text-titulo font-bold text-texto">Painel geral</h1>
      <p className="mt-1 text-texto-suave">
        Licitações da administração municipal de Criciúma, a partir dos dados públicos do PNCP.
      </p>

      {falha ? (
        <p className="mt-8 rounded-card border border-suspensa-texto/30 bg-suspensa-fundo p-6 text-suspensa-texto">
          Não foi possível ler o banco: {falha}
        </p>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              rotulo="Abertas"
              valor={inteiro(kpis?.abertas)}
              legenda="prazo de proposta em curso"
              href={hrefCom(semFiltro, { status: "aberta" })}
              termo="aberta"
            />
            <KpiCard
              rotulo="Em análise"
              valor={inteiro(kpis?.em_analise)}
              legenda="prazo encerrado, sem resultado"
              href={hrefCom(semFiltro, { status: "em_analise" })}
              termo="em_analise"
            />
            <KpiCard
              rotulo="Homologadas no mês"
              valor={inteiro(kpis?.homologadas_mes)}
              legenda="pela data do último resultado"
              href={hrefCom(semFiltro, { status: "homologada" })}
              termo="homologada"
            />
            <KpiCard
              rotulo="Valor em aberto"
              valor={moedaCurta(kpis?.valor_aberto)}
              titulo={moeda(kpis?.valor_aberto)}
              legenda="soma do estimado das abertas"
              href={hrefCom(semFiltro, { status: "aberta", ordem: "valor", dir: "desc" })}
              termo="valor_estimado"
            />
          </section>

          <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <h2 className="mb-4 text-secao font-bold text-texto">Licitações</h2>
              {/* A key remonta o formulário a cada navegação: sem ela, "Limpar"
                  mudaria a URL e os campos continuariam com o valor antigo. */}
              <div key={hrefCom(filtros, { pagina: filtros.pagina })} className="mb-4">
                <Filtros filtros={filtros} modalidades={modalidades} />
              </div>
              <TabelaLicitacoes linhas={linhas} filtros={filtros} />
              <Paginacao filtros={filtros} total={total} />
            </section>

            <aside className="space-y-4">
              <ProximasAberturas itens={aberturas} />
              <UltimasAtualizacoes eventos={eventos} />
              <FontesDados fontes={fontes} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
