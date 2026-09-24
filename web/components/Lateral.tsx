import Link from "next/link";
import { Termo } from "@/components/Termo";
import { dataHora, diaEMes, haQuantoTempo, numeroLicitacao } from "@/lib/format";

/* Coluna lateral do Painel (PDF 3.1, itens 7, 8 e 9). Os três blocos só
   mostram o que recebem; as consultas ficam na página. */

export type Abertura = {
  id: string;
  processo: string | null;
  ano: number | null;
  objeto: string;
  data_abertura: Date;
};

export type Evento = {
  id: string;
  licitacao_id: string;
  tipo: string;
  descricao: string | null;
  data: Date;
  fonte: string | null;
  processo: string | null;
  ano: number | null;
};

export type Fonte = {
  fonte: string;
  status: "rodando" | "ok" | "erro" | "parcial";
  iniciado_em: Date;
  finalizado_em: Date | null;
};

function Bloco({ titulo, children }: { titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-borda bg-superficie p-5">
      <h2 className="mb-4 flex items-center gap-1 text-secao font-bold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

export function ProximasAberturas({ itens }: { itens: Abertura[] }) {
  return (
    <Bloco titulo="Próximas aberturas">
      {itens.length === 0 ? (
        <p className="text-legenda text-texto-suave">Nenhuma sessão de abertura marcada.</p>
      ) : (
        <ul className="space-y-4">
          {itens.map((a) => {
            const { dia, mes } = diaEMes(a.data_abertura);
            return (
              <li key={a.id} className="flex gap-3">
                <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-controle bg-primaria-clara py-1.5 text-primaria">
                  <span className="font-mono text-secao leading-none font-semibold">{dia}</span>
                  <span className="text-legenda uppercase">{mes}</span>
                </div>
                <Link href={`/licitacoes/${a.id}`} className="group min-w-0">
                  <p className="font-mono text-legenda text-texto-suave">{numeroLicitacao(a.processo, a.ano)}</p>
                  <p className="line-clamp-2 text-legenda text-texto group-hover:text-primaria">{a.objeto}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Bloco>
  );
}

export function UltimasAtualizacoes({ eventos }: { eventos: Evento[] }) {
  return (
    <Bloco titulo="Últimas atualizações">
      {eventos.length === 0 ? (
        <p className="text-legenda text-texto-suave">Nenhuma atualização registrada.</p>
      ) : (
        <ul className="space-y-3">
          {eventos.map((e) => (
            <li key={e.id} className="border-b border-borda-leve pb-3 last:border-0 last:pb-0">
              {/* No PNCP, o tipo é o verbo (Inclusão, Retificação, Exclusão) e a
                  descrição é o que mudou (Item de Contratação, Documento...). */}
              <p className="text-legenda text-texto">
                {e.tipo}: {e.descricao ?? "registro"}
              </p>
              <p className="mt-0.5 text-legenda text-texto-suave">
                <Link href={`/licitacoes/${e.licitacao_id}`} className="font-mono hover:text-primaria">
                  {numeroLicitacao(e.processo, e.ano)}
                </Link>{" "}
                ·{" "}
                <span title={dataHora(e.data)}>{haQuantoTempo(e.data)}</span> · {e.fonte ?? "PNCP"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}

/* Uma linha de sync_log por órgão coletado. Para quem lê, o que importa é se
   o PNCP como um todo está em dia, então as linhas viram um estado só. */
function estadoPncp(fontes: Fonte[]) {
  if (fontes.length === 0) return { texto: "Nunca coletado", cor: "bg-encerrada-texto" };
  if (fontes.some((f) => f.status === "erro")) return { texto: "Falha", cor: "bg-suspensa-texto" };
  if (fontes.some((f) => f.status === "rodando")) return { texto: "Coletando", cor: "bg-analise-texto" };
  if (fontes.some((f) => f.status === "parcial")) return { texto: "Parcial", cor: "bg-analise-texto" };
  return { texto: "OK", cor: "bg-aberta-texto" };
}

export function FontesDados({ fontes }: { fontes: Fonte[] }) {
  const pncp = estadoPncp(fontes);
  const ultima = fontes
    .map((f) => f.finalizado_em)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const linhas = [
    {
      nome: <>PNCP <Termo chave="pncp" /></>,
      estado: pncp,
      detalhe: ultima ? `última coleta ${haQuantoTempo(ultima)}` : undefined,
      titulo: fontes.map((f) => `${f.fonte}: ${f.status}`).join("\n"),
    },
    {
      nome: "Portal da Transparência",
      estado: { texto: "Ainda não coletado", cor: "bg-encerrada-texto" },
    },
    {
      nome: "Dados de CNPJ",
      estado: { texto: "Ainda não coletado", cor: "bg-encerrada-texto" },
    },
  ];

  return (
    <Bloco titulo="Fontes de dados">
      <ul className="space-y-3">
        {linhas.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-3 text-legenda">
            <span className="flex items-center gap-1 text-texto">{l.nome}</span>
            <span className="text-right" title={l.titulo}>
              <span className="inline-flex items-center gap-1.5 font-semibold text-texto-2">
                <span aria-hidden className={`size-2 rounded-pilula ${l.estado.cor}`} />
                {l.estado.texto}
              </span>
              {l.detalhe ? <span className="block text-texto-suave">{l.detalhe}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}
