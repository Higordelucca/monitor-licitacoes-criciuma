import Link from "next/link";
import { hrefCom, POR_PAGINA, type Filtros } from "@/lib/filtros";
import { inteiro } from "@/lib/format";

/* Paginação da tabela (PDF 3.1, item 6.4): "Mostrando 21–40 de 773" e
   Anterior/Próxima. Nas pontas, o botão vira texto apagado em vez de sumir,
   para o layout não pular. */

const BOTAO = "inline-flex h-botao items-center rounded-controle border border-borda px-4 font-semibold";

export function Paginacao({ filtros, total }: { filtros: Filtros; total: number }) {
  const inicio = total === 0 ? 0 : Math.min((filtros.pagina - 1) * POR_PAGINA + 1, total);
  const fim = Math.min(filtros.pagina * POR_PAGINA, total);
  const temAnterior = filtros.pagina > 1;
  const temProxima = fim < total;

  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-legenda text-texto-suave">
        Mostrando <span className="font-mono tabular-nums">{inteiro(inicio)}–{inteiro(fim)}</span> de{" "}
        <span className="font-mono tabular-nums">{inteiro(total)}</span>
      </p>
      <div className="flex gap-2">
        {temAnterior ? (
          <Link href={hrefCom(filtros, { pagina: filtros.pagina - 1 })} className={`${BOTAO} bg-superficie text-texto-2 hover:bg-borda-leve`}>
            Anterior
          </Link>
        ) : (
          <span aria-disabled className={`${BOTAO} text-texto-suave/50`}>Anterior</span>
        )}
        {temProxima ? (
          <Link href={hrefCom(filtros, { pagina: filtros.pagina + 1 })} className={`${BOTAO} bg-superficie text-texto-2 hover:bg-borda-leve`}>
            Próxima
          </Link>
        ) : (
          <span aria-disabled className={`${BOTAO} text-texto-suave/50`}>Próxima</span>
        )}
      </div>
    </nav>
  );
}
