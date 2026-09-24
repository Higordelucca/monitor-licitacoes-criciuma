import { Termo } from "@/components/Termo";

/* Pílula de status. As cinco chaves são exatamente as do CHECK de
   licitacoes.status — se o banco aceitar um valor novo, aqui quebra na
   compilação, que é onde se quer descobrir. */

export const STATUS = {
  aberta: { rotulo: "Aberta", cor: "bg-aberta-fundo text-aberta-texto" },
  em_analise: { rotulo: "Em análise", cor: "bg-analise-fundo text-analise-texto" },
  homologada: { rotulo: "Homologada", cor: "bg-homologada-fundo text-homologada-texto" },
  suspensa: { rotulo: "Suspensa", cor: "bg-suspensa-fundo text-suspensa-texto" },
  encerrada: { rotulo: "Encerrada", cor: "bg-encerrada-fundo text-encerrada-texto" },
} as const;

export type Status = keyof typeof STATUS;

/** Com `explicar`, a pílula vira o gatilho do balão que diz o que o status
    significa — o glossário tem uma entrada com a mesma chave de cada status. */
export function Pilula({ status, explicar = false }: { status: Status; explicar?: boolean }) {
  const { rotulo, cor } = STATUS[status];
  const pilula = (
    <span
      className={`${cor} inline-flex items-center gap-1 rounded-pilula px-2.5 py-1 text-legenda font-semibold whitespace-nowrap`}
    >
      {rotulo}
      {explicar ? <span aria-hidden className="opacity-60">ⓘ</span> : null}
    </span>
  );
  return explicar ? <Termo chave={status}>{pilula}</Termo> : pilula;
}
