import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { BotaoSeguir } from "@/components/BotaoSeguir";
import { Termo } from "@/components/Termo";
import { consultar } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";
import { cnpj as mascaraCnpj, dataCurta, inteiro, moeda, moedaCurta, numeroLicitacao } from "@/lib/format";

/* Ficha da empresa (PDF 3.3), parcial.

   Hoje o banco só sabe da empresa o que o resultado do PNCP traz: CNPJ, razão
   social e porte. Cadastro da Receita, sócios, sanções e contratos são a fase
   3, e aparecem como "ainda não verificado" — nunca como "nada consta", que
   afirmaria uma verificação que não aconteceu. */

type Empresa = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  porte: string | null;
  situacao_cadastral: string | null;
  data_abertura: Date | null;
  cnae_principal: string | null;
  municipio: string | null;
  uf: string | null;
  capital_social: string | null;
};

type Resumo = { participacoes: string; vitorias: string; valor_ganho: string | null };

type Participacao = {
  id: string;
  processo: string | null;
  ano: number | null;
  objeto: string;
  data: Date | null;
  valor_proposta: string | null;
  situacao: "vencedora" | "habilitada" | "em_analise" | "inabilitada" | null;
};

const carregar = cache(async (cnpj: string) => {
  const [e] = await consultar<Empresa>(
    `select cnpj, razao_social, nome_fantasia, porte, situacao_cadastral, data_abertura,
            cnae_principal, municipio, uf, capital_social
       from empresas
      where cnpj = $1`,
    [cnpj],
  );
  return e;
});

/* O CNPJ chega da URL como a pessoa digitou. Com máscara, redireciona para a
   forma só com dígitos, que é a do banco e a do link canônico. */
async function cnpjDaUrl(props: PageProps<"/empresas/[cnpj]">) {
  const bruto = decodeURIComponent((await props.params).cnpj);
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length !== 14) notFound();
  if (digitos !== bruto) redirect(`/empresas/${digitos}`);
  return digitos;
}

export async function generateMetadata(props: PageProps<"/empresas/[cnpj]">): Promise<Metadata> {
  const e = await carregar(await cnpjDaUrl(props));
  return { title: e ? `${e.razao_social} · Monitor de Licitações · Criciúma` : "Empresa não encontrada" };
}

export default async function Ficha(props: PageProps<"/empresas/[cnpj]">) {
  const sessao = await exigirSessao();
  const cnpj = await cnpjDaUrl(props);
  const e = await carregar(cnpj);
  if (!e) notFound();

  const [[resumo], historico, [{ seguindo }]] = await Promise.all([
    consultar<Resumo>(
      `select count(*) as participacoes,
              count(*) filter (where situacao = 'vencedora') as vitorias,
              sum(valor_proposta) filter (where situacao = 'vencedora') as valor_ganho
         from participantes
        where cnpj = $1`,
      [cnpj],
    ),
    consultar<Participacao>(
      `select l.id, l.processo, l.ano, l.objeto,
              coalesce(l.data_homologacao, l.data_publicacao) as data,
              p.valor_proposta, p.situacao
         from participantes p
         join licitacoes l on l.id = p.licitacao_id
        where p.cnpj = $1
        order by data desc nulls last, l.id desc`,
      [cnpj],
    ),
    consultar<{ seguindo: boolean }>(
      "select exists (select 1 from seguindo_empresas where user_id = $1 and cnpj = $2) as seguindo",
      [sessao.id, cnpj],
    ),
  ]);

  const participacoes = Number(resumo.participacoes);
  const vitorias = Number(resumo.vitorias);
  const taxa = participacoes > 0 ? Math.round((vitorias / participacoes) * 100) : null;

  const PENDENTE = "ainda não coletado";
  const cadastro: { rotulo: string; valor: string; termo?: "porte" }[] = [
    { rotulo: "Nome fantasia", valor: e.nome_fantasia ?? PENDENTE },
    { rotulo: "Porte", valor: e.porte ?? "—", termo: "porte" },
    { rotulo: "Abertura", valor: e.data_abertura ? dataCurta(e.data_abertura) : PENDENTE },
    { rotulo: "CNAE principal", valor: e.cnae_principal ?? PENDENTE },
    { rotulo: "Município", valor: e.municipio ? `${e.municipio}${e.uf ? `/${e.uf}` : ""}` : PENDENTE },
    { rotulo: "Capital social", valor: e.capital_social ? moeda(e.capital_social) : PENDENTE },
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 sm:px-10">
      <nav aria-label="Trilha" className="text-legenda text-texto-suave">
        <Link href="/empresas" className="hover:text-primaria">
          Empresas
        </Link>{" "}
        / <span className="font-mono">{mascaraCnpj(cnpj)}</span>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          <section className="rounded-card border border-borda bg-superficie p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-titulo-detalhe leading-tight font-bold text-texto">{e.razao_social}</h1>
                <p className="mt-1 font-mono text-texto-2">{mascaraCnpj(cnpj)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <BotaoSeguir tipo="empresa" cnpj={cnpj} seguindo={seguindo} />
                <span
                  title="A situação na Receita Federal entra quando a consulta de CNPJ for implementada."
                  className="rounded-pilula bg-encerrada-fundo px-2.5 py-1 text-legenda font-semibold text-encerrada-texto"
                >
                  Situação na Receita: {e.situacao_cadastral ?? "não consultada"}
                </span>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              {cadastro.map((c) => (
                <div key={c.rotulo}>
                  <dt className="flex items-center gap-1 text-legenda text-texto-suave">
                    {c.rotulo}
                    {c.termo ? <Termo chave={c.termo} /> : null}
                  </dt>
                  <dd className={c.valor === PENDENTE ? "text-legenda text-texto-suave italic" : "text-texto"}>
                    {c.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Indicador rotulo="Participações" valor={inteiro(participacoes)} />
            <Indicador rotulo="Vitórias" valor={inteiro(vitorias)} termo="vencedora" />
            <Indicador rotulo="Taxa de vitória" valor={taxa === null ? "—" : `${taxa}%`} />
            <Indicador
              rotulo="Valor ganho"
              valor={moedaCurta(resumo.valor_ganho)}
              titulo={moeda(resumo.valor_ganho)}
              legenda="soma das propostas vencedoras"
            />
          </section>

          <section>
            <h2 className="mb-2 text-secao font-bold text-texto">Histórico em Criciúma</h2>
            <p className="mb-3 text-legenda text-texto-suave">
              Só aparecem as licitações em que a empresa consta no resultado publicado no PNCP.
            </p>
            <div className="overflow-x-auto rounded-card border border-borda bg-superficie">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-borda text-legenda text-texto-suave">
                    <th className="w-28 px-4 py-3 font-semibold">Licitação</th>
                    <th className="px-4 py-3 font-semibold">Objeto</th>
                    <th className="w-28 px-4 py-3 font-semibold">Data</th>
                    <th className="w-40 px-4 py-3 text-right font-semibold">Proposta</th>
                    <th className="w-32 px-4 py-3 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="h-linha border-b border-borda-leve last:border-0 align-top">
                      <td className="px-4 py-3 font-mono whitespace-nowrap text-texto-2">
                        <Link href={`/licitacoes/${h.id}`} className="hover:text-primaria">
                          {numeroLicitacao(h.processo, h.ano)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/licitacoes/${h.id}`} className="line-clamp-2 text-texto hover:text-primaria hover:underline">
                          {h.objeto}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-legenda text-texto-suave">{dataCurta(h.data)}</td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                        {Number(h.valor_proposta) > 0 ? moeda(h.valor_proposta) : "—"}
                      </td>
                      <td className="px-4 py-3 text-legenda text-texto-2">
                        {h.situacao === "vencedora" ? "Vencedora" : h.situacao === "habilitada" ? "Habilitada" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <NaoVerificado titulo="Sanções e impedimentos">
            Consulta ao CEIS, CNEP e CEPIM, do Portal da Transparência federal. Ainda não
            implementada: a ausência de registro aqui <strong>não</strong> quer dizer que a empresa
            não tem sanção.
          </NaoVerificado>
          <NaoVerificado titulo="Sócios (QSA)">
            Quadro de sócios da Receita Federal. Entra com a consulta de CNPJ.
          </NaoVerificado>
          <NaoVerificado titulo="Contratos vigentes">
            Os contratos ainda não são coletados do PNCP.
          </NaoVerificado>
        </aside>
      </div>
    </main>
  );
}

function Indicador({
  rotulo,
  valor,
  legenda,
  termo,
  titulo,
}: {
  rotulo: string;
  valor: string;
  legenda?: string;
  termo?: "vencedora";
  titulo?: string;
}) {
  return (
    <div className="rounded-card border border-borda bg-superficie p-5">
      <p className="flex items-center gap-1 text-legenda font-semibold tracking-wide text-texto-suave uppercase">
        {rotulo}
        {termo ? <Termo chave={termo} /> : null}
      </p>
      <p title={titulo} className="mt-2 font-mono text-titulo leading-none font-semibold text-texto tabular-nums">
        {valor}
      </p>
      {legenda ? <p className="mt-2 text-legenda text-texto-suave">{legenda}</p> : null}
    </div>
  );
}

function NaoVerificado({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-dashed border-borda bg-superficie p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-secao font-bold text-texto">{titulo}</h2>
        <span className="rounded-pilula bg-encerrada-fundo px-2.5 py-1 text-legenda font-semibold whitespace-nowrap text-encerrada-texto">
          Não verificado
        </span>
      </div>
      <p className="mt-2 text-legenda text-texto-suave">{children}</p>
    </section>
  );
}
