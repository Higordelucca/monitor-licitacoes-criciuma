"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Menu principal do Header (PDF 1.2). Client component só para saber a rota
   atual e marcar o item ativo.

   Contratos e Alertas entram quando a tela deles existir — link para página
   que não existe é pior que link nenhum. "Licitações" não tem página própria:
   a lista é a do Painel, e o Detalhe acende o Painel. */

const ITENS = [
  { href: "/", rotulo: "Painel", ativoEm: ["/licitacoes", "/buscar"] },
  { href: "/empresas", rotulo: "Empresas", ativoEm: [] },
  { href: "/entenda", rotulo: "Entenda", ativoEm: [] },
];

export function Menu() {
  const atual = usePathname();

  return (
    <nav aria-label="Principal" className="flex items-center gap-1">
      {ITENS.map(({ href, rotulo, ativoEm }) => {
        const ativo =
          (href === "/" ? atual === "/" : atual.startsWith(href)) ||
          ativoEm.some((prefixo) => atual.startsWith(prefixo));
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-controle px-3 py-2 font-semibold ${
              ativo ? "bg-primaria-clara text-primaria" : "text-texto-2 hover:bg-borda-leve"
            }`}
          >
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
