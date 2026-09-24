import Form from "next/form";
import Link from "next/link";
import { STATUS } from "@/components/Pilula";
import type { Filtros as TFiltros } from "@/lib/filtros";
import { ORGAOS } from "@/lib/orgaos";

/* Filtros da tabela do Painel (PDF 3.1, item 6.1). É um formulário GET comum:
   funciona sem JavaScript, e o next/form só troca o recarregamento da página
   por navegação no cliente. A URL resultante é o link compartilhável.

   Ordem e direção vão em campo oculto para sobreviver ao filtro; a página não,
   porque filtrar de novo tem de voltar para a página 1. */

const CAMPO =
  "h-campo w-full rounded-controle border border-borda bg-superficie px-3 text-corpo text-texto focus:border-primaria focus:outline-none";

export function Filtros({ filtros, modalidades }: { filtros: TFiltros; modalidades: string[] }) {
  return (
    <Form action="/" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <Rotulo texto="Buscar no objeto" campo="filtro-q" className="sm:col-span-2 lg:col-span-2">
        <input
          id="filtro-q"
          name="q"
          type="search"
          defaultValue={filtros.q}
          placeholder="ex.: merenda, asfalto, uniforme"
          className={CAMPO}
        />
      </Rotulo>

      <Rotulo texto="Status" campo="filtro-status" grupo="status">
        <select id="filtro-status" name="status" defaultValue={filtros.status ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([valor, { rotulo }]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </Rotulo>

      <Rotulo texto="Modalidade" campo="filtro-modalidade" grupo="modalidade">
        <select id="filtro-modalidade" name="modalidade" defaultValue={filtros.modalidade ?? ""} className={CAMPO}>
          <option value="">Todas</option>
          {modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Rotulo>

      <Rotulo texto="Órgão" campo="filtro-orgao">
        <select id="filtro-orgao" name="orgao" defaultValue={filtros.orgao ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          {Object.entries(ORGAOS).map(([cnpj, nome]) => (
            <option key={cnpj} value={cnpj}>
              {nome}
            </option>
          ))}
        </select>
      </Rotulo>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-legenda font-semibold text-texto-suave">Publicada entre</legend>
        <input name="de" type="date" aria-label="De" defaultValue={filtros.de} className={CAMPO} />
        <input name="ate" type="date" aria-label="Até" defaultValue={filtros.ate} className={CAMPO} />
      </fieldset>

      {filtros.ordem !== "publicacao" ? <input type="hidden" name="ordem" value={filtros.ordem} /> : null}
      {filtros.dir !== "desc" ? <input type="hidden" name="dir" value={filtros.dir} /> : null}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
        <Link
          href="/"
          className="inline-flex h-botao items-center rounded-controle border border-borda bg-superficie px-4 font-semibold text-texto-2 hover:bg-borda-leve"
        >
          Limpar
        </Link>
        <button
          type="submit"
          className="inline-flex h-botao items-center rounded-controle bg-primaria px-5 font-semibold text-superficie hover:bg-primaria-hover"
        >
          Filtrar
        </button>
      </div>
    </Form>
  );
}

/* No filtro, o ⓘ explica o grupo inteiro (todos os status, todas as
   modalidades), então leva direto à seção da página Entenda em vez de abrir o
   balão de um termo só. Fica fora do <label> para o clique não focar o campo. */
function Rotulo({
  texto,
  campo,
  grupo,
  className = "",
  children,
}: {
  texto: string;
  campo: string;
  grupo?: "status" | "modalidade";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1">
        <label htmlFor={campo} className="text-legenda font-semibold text-texto-suave">
          {texto}
        </label>
        {grupo ? (
          <Link
            href={`/entenda#${grupo}`}
            aria-label={`O que significa cada ${texto.toLowerCase()}`}
            className="inline-flex size-5 items-center justify-center rounded-pilula text-[0.75rem] leading-none text-texto-suave hover:bg-primaria-clara hover:text-primaria"
          >
            ⓘ
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}
