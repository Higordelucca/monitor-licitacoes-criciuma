import type { Etapa } from "@/lib/etapas";
import { dataCurta } from "@/lib/format";

/* Linha do tempo do Detalhe (PDF 3.2, item 8). Bolinha cheia = concluída,
   anel = em curso, vazada = por vir, riscada = o processo parou antes. */

const MARCA: Record<Etapa["estado"], string> = {
  concluida: "bg-primaria border-primaria",
  atual: "bg-superficie border-primaria ring-4 ring-primaria-clara",
  futura: "bg-superficie border-borda",
  interrompida: "bg-borda-leve border-borda",
};

const LEGENDA: Record<Etapa["estado"], string> = {
  concluida: "",
  atual: "em curso",
  futura: "a definir",
  interrompida: "não ocorreu",
};

export function LinhaDoTempo({ etapas }: { etapas: Etapa[] }) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-borda">
      {etapas.map((e) => (
        <li key={e.nome} className="relative flex gap-3">
          <span aria-hidden className={`relative mt-1 size-[15px] shrink-0 rounded-pilula border-2 ${MARCA[e.estado]}`} />
          <div>
            <p
              className={`font-semibold ${
                e.estado === "interrompida" ? "text-texto-suave line-through" : "text-texto"
              }`}
            >
              {e.nome}
            </p>
            <p className="text-legenda text-texto-suave">
              {e.data ? <span className="font-mono">{dataCurta(e.data)}</span> : null}
              {e.data && LEGENDA[e.estado] ? " · " : null}
              {LEGENDA[e.estado]}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
