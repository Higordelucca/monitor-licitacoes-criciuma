"use client";

import Link from "next/link";
import { useId, type CSSProperties, type ReactNode } from "react";
import { GLOSSARIO, type ChaveGlossario } from "@/lib/glossario";

/* Explicação de um termo para o público: um ⓘ, ou o próprio texto sublinhado,
   que abre um balão com a frase curta do glossário e o link "Saiba mais".

   O balão é o atributo HTML `popover`: abre por clique ou toque (hover não
   existe no celular), fecha com Esc ou clique fora, e o navegador cuida do
   foco. É client component só por causa do useId, que dá a cada balão um id
   único na página. */

export function Termo({ chave, children }: { chave: ChaveGlossario; children?: ReactNode }) {
  const bruto = useId();
  const id = `termo-${bruto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const entrada = GLOSSARIO[chave];

  // anchorName/positionAnchor ainda não estão no tipo CSSProperties do React.
  const ancora = { anchorName: `--${id}` } as CSSProperties;
  const posicao = { positionAnchor: `--${id}` } as CSSProperties;

  return (
    <>
      {children ? (
        <button
          type="button"
          popoverTarget={id}
          style={ancora}
          className="cursor-help text-left underline decoration-texto-suave/50 decoration-dotted underline-offset-4 hover:decoration-primaria"
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          popoverTarget={id}
          style={ancora}
          aria-label={`O que é “${entrada.termo}”?`}
          className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-pilula align-middle text-[0.75rem] leading-none text-texto-suave hover:bg-primaria-clara hover:text-primaria"
        >
          ⓘ
        </button>
      )}

      <div
        id={id}
        popover="auto"
        style={posicao}
        className="balao rounded-card border border-borda bg-superficie p-4 text-left text-legenda font-normal tracking-normal text-texto-2 normal-case shadow-lg"
      >
        <p className="font-semibold text-texto">{entrada.termo}</p>
        <p className="mt-1">{entrada.curto}</p>
        <Link href={`/entenda#${chave}`} className="mt-2 inline-block font-semibold text-primaria hover:text-primaria-hover">
          Saiba mais →
        </Link>
      </div>
    </>
  );
}
