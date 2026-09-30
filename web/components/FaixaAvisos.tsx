import type { Aviso } from "@/lib/avisos";

/* Faixa logo abaixo do Header, em todas as telas, com os avisos de
   lib/avisos.ts que estão no período. Sem aviso vigente, não ocupa espaço. */

export function FaixaAvisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) return null;
  return (
    <div role="note" className="border-b border-borda bg-analise-fundo text-analise-texto">
      {avisos.map((a) => (
        <p key={a.chave} className="mx-auto flex max-w-[1440px] gap-2 px-5 py-2 text-legenda sm:px-10">
          <span aria-hidden>ⓘ</span>
          <span>
            {a.texto}{" "}
            <a href={a.fonte.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              {a.fonte.rotulo}
            </a>
          </span>
        </p>
      ))}
    </div>
  );
}
