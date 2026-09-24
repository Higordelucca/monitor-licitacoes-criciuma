import Form from "next/form";
import Link from "next/link";
import { Menu } from "@/components/Menu";
import { MenuUsuario } from "@/components/MenuUsuario";
import { haQuantoTempo } from "@/lib/format";

/* Cabeçalho fixo de 68px (PDF 1.x). O botão "Atualizar agora", só para
   admin, ainda não existe: disparar o workflow do GitHub pede um token com
   permissão de escrita no repositório, que não foi decidido onde guardar. */

export function Header({
  sincronizadoEm,
  rodando,
  login,
  naoLidos,
}: {
  sincronizadoEm: Date | string | null;
  rodando: boolean;
  login: string;
  naoLidos: number;
}) {
  return (
    <header className="sticky top-0 z-10 h-header border-b border-borda bg-superficie">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-6 px-5 sm:px-10">
        <Link href="/" className="flex min-w-0 items-baseline gap-3">
          <span className="text-secao font-bold text-primaria">Monitor de Licitações</span>
          <span className="hidden truncate text-legenda text-texto-suave md:inline">Criciúma · SC</span>
        </Link>

        <Menu />

        {/* Busca global (PDF 1.3). Envia com Enter para /buscar, que decide
            entre CNPJ, número e texto. Some em tela estreita: lá o caminho é o
            menu Empresas ou a busca do Painel. */}
        <Form action="/buscar" role="search" className="ml-auto hidden lg:block">
          <label htmlFor="busca-global" className="sr-only">
            Buscar por número, objeto, empresa ou CNPJ
          </label>
          <input
            id="busca-global"
            name="q"
            type="search"
            placeholder="Nº, objeto, empresa ou CNPJ"
            className="h-10 w-80 rounded-controle border border-borda bg-fundo px-3 text-legenda text-texto focus:border-primaria focus:bg-superficie focus:outline-none"
          />
        </Form>

        <div className="ml-auto hidden items-center gap-2 text-legenda text-texto-suave sm:flex lg:ml-0">
          <span
            aria-hidden
            className={`size-2 rounded-pilula ${rodando ? "bg-analise-texto" : "bg-aberta-texto"}`}
          />
          {rodando ? "Sincronizando agora" : `Sincronizado ${haQuantoTempo(sincronizadoEm)}`}
        </div>

        {/* Sino (PDF 4.4): leva à tela Alertas, com o número de não lidos. */}
        <Link
          href="/alertas"
          aria-label={naoLidos > 0 ? `Alertas: ${naoLidos} não lidos` : "Alertas"}
          className="relative flex size-9 items-center justify-center rounded-pilula text-texto-2 hover:bg-borda-leve"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
          </svg>
          {naoLidos > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-pilula bg-suspensa-texto px-1 font-mono text-[0.625rem] leading-none font-semibold text-superficie">
              {naoLidos > 99 ? "99+" : naoLidos}
            </span>
          ) : null}
        </Link>

        <MenuUsuario login={login} />
      </div>
    </header>
  );
}
