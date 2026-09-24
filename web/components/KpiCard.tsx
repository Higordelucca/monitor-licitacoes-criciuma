import Link from "next/link";
import { Termo } from "@/components/Termo";
import type { ChaveGlossario } from "@/lib/glossario";

/* Card de indicador do Painel (PDF 3.1). Card branco, borda de 1px, sem
   sombra — a especificação é explícita quanto a isso.

   O card inteiro é um link que filtra a tabela (PDF 5.1–5.3). O ⓘ fica fora do
   link, por cima dele: botão dentro de <a> é HTML inválido. */

export function KpiCard({
  rotulo,
  valor,
  legenda,
  href,
  termo,
  titulo,
}: {
  rotulo: string;
  valor: string;
  legenda?: string;
  href: string;
  termo?: ChaveGlossario;
  /** Texto do tooltip nativo, ex.: o valor exato por trás de "R$ 129,8 mi". */
  titulo?: string;
}) {
  return (
    <div className="relative rounded-card border border-borda bg-superficie p-5 hover:border-primaria">
      <div className="flex items-center gap-1">
        <p className="text-legenda font-semibold tracking-wide text-texto-suave uppercase">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-card">
            {rotulo}
          </Link>
        </p>
        {termo ? (
          <span className="relative z-[1]">
            <Termo chave={termo} />
          </span>
        ) : null}
      </div>
      <p
        title={titulo}
        className="mt-2 font-mono text-titulo leading-none font-semibold text-texto tabular-nums"
      >
        {valor}
      </p>
      {legenda ? <p className="mt-2 text-legenda text-texto-suave">{legenda}</p> : null}
    </div>
  );
}
