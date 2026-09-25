import Link from "next/link";
import { Termo } from "@/components/Termo";
import { contratoVigente } from "@/lib/contratos";
import { cnpj, dataCurta, moeda } from "@/lib/format";
import { nomeOrgao } from "@/lib/orgaos";

/* Contratos do PNCP. No Detalhe, cada contrato diz com qual empresa foi; na
   Ficha, de qual órgão e de qual licitação saiu. */

export type Contrato = {
  id_pncp: string;
  numero: string | null;
  tipo: string | null;
  objeto: string | null;
  cnpj: string;
  razao_social: string;
  licitacao_id: string | null;
  valor_inicial: string | null;
  valor_global: string | null;
  data_assinatura: Date | null;
  vigencia_inicio: Date | null;
  vigencia_fim: Date | null;
  url_pncp: string | null;
  url_documento: string | null;
};

export function ListaContratos({ contratos, na }: { contratos: Contrato[]; na: "licitacao" | "empresa" }) {
  return (
    <ul className="space-y-3">
      {contratos.map((c) => (
        <ItemContrato key={c.id_pncp} c={c} na={na} />
      ))}
    </ul>
  );
}

function ItemContrato({ c, na }: { c: Contrato; na: "licitacao" | "empresa" }) {
  const vigente = contratoVigente(c);
  const mudouDeValor =
    c.valor_inicial !== null && c.valor_global !== null && Number(c.valor_inicial) !== Number(c.valor_global);
  return (
    <li
      className={`rounded-card border border-borda bg-superficie p-4 ${vigente ? "" : "opacity-70"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-texto">
          {c.tipo ?? "Contrato"} <span className="font-mono">{c.numero ?? ""}</span>
        </p>
        <Termo chave="vigencia">
          <span
            className={`${vigente ? "bg-aberta-fundo text-aberta-texto" : "bg-encerrada-fundo text-encerrada-texto"} inline-flex rounded-pilula px-2.5 py-1 text-legenda font-semibold`}
          >
            {vigente ? "Vigente" : "Encerrado"}
          </span>
        </Termo>
      </div>

      {na === "licitacao" ? (
        <p className="mt-2 text-legenda">
          <Link href={`/empresas/${c.cnpj}`} className="text-texto hover:text-primaria hover:underline">
            {c.razao_social}
          </Link>{" "}
          <span className="font-mono text-texto-suave">{cnpj(c.cnpj)}</span>
        </p>
      ) : (
        <p className="mt-2 text-legenda text-texto-2">
          {nomeOrgao(c.id_pncp.slice(0, 14))}
          {c.licitacao_id ? (
            <>
              {" · "}
              <Link href={`/licitacoes/${c.licitacao_id}`} className="text-primaria hover:underline">
                ver licitação
              </Link>
            </>
          ) : null}
        </p>
      )}

      {c.objeto ? <p className="mt-1 line-clamp-2 text-legenda text-texto-suave">{c.objeto}</p> : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-legenda sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-1 text-texto-suave">
            Valor global <Termo chave="valor_global" />
          </dt>
          <dd className="font-mono text-texto tabular-nums">
            {moeda(c.valor_global)}
            {mudouDeValor ? (
              <span className="ml-2 text-texto-suave line-through" title="Valor na assinatura">
                {moeda(c.valor_inicial)}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-texto-suave">Assinatura</dt>
          <dd className="font-mono text-texto-2">{dataCurta(c.data_assinatura)}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Vigência</dt>
          <dd className="font-mono text-texto-2">
            {dataCurta(c.vigencia_inicio)} a {c.vigencia_fim ? dataCurta(c.vigencia_fim) : "sem data final"}
          </dd>
        </div>
      </dl>

      {c.url_documento || c.url_pncp ? (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-legenda font-semibold">
          {c.url_documento ? (
            <a href={c.url_documento} target="_blank" rel="noopener noreferrer" className="text-primaria hover:underline">
              Abrir contrato (PDF) ↗
            </a>
          ) : null}
          {c.url_pncp ? (
            <a href={c.url_pncp} target="_blank" rel="noopener noreferrer" className="text-primaria hover:underline">
              Ver no PNCP ↗
            </a>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
