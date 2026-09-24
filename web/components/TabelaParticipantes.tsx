import Link from "next/link";
import { Termo } from "@/components/Termo";
import { cnpj, moeda } from "@/lib/format";

/* Empresas participantes (PDF 3.2, item 6). O PNCP só publica os vencedores de
   cada item — a lista completa de licitantes está na ata, que não é lida. O
   aviso fica fixo no bloco para ninguém tomar a tabela por completa. */

export type Participante = {
  cnpj: string;
  razao_social: string;
  porte: string | null;
  valor_proposta: string | null;
  situacao: "vencedora" | "habilitada" | "em_analise" | "inabilitada" | null;
  /** Tem sanção vigente no CEIS, CNEP ou CEPIM. */
  sancionada: boolean;
};

const SITUACAO = {
  vencedora: { rotulo: "Vencedora", cor: "bg-aberta-fundo text-aberta-texto" },
  habilitada: { rotulo: "Habilitada", cor: "bg-homologada-fundo text-homologada-texto" },
  em_analise: { rotulo: "Em análise", cor: "bg-analise-fundo text-analise-texto" },
  inabilitada: { rotulo: "Inabilitada", cor: "bg-suspensa-fundo text-suspensa-texto" },
} as const;

export function TabelaParticipantes({ linhas }: { linhas: Participante[] }) {
  return (
    <>
      <p className="mb-3 text-legenda text-texto-suave">
        O PNCP publica apenas as empresas vencedoras de cada item. As demais participantes
        constam na ata da sessão.
      </p>
      {linhas.length === 0 ? (
        <p className="rounded-card border border-borda bg-superficie p-6 text-texto-suave">
          Nenhum resultado publicado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-borda bg-superficie">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-borda text-legenda text-texto-suave">
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="w-48 px-4 py-3 font-semibold">CNPJ</th>
                <th className="w-28 px-4 py-3 font-semibold">Porte</th>
                <th className="w-40 px-4 py-3 text-right font-semibold">Proposta</th>
                <th className="w-32 px-4 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((p) => {
                const s = p.situacao ? SITUACAO[p.situacao] : null;
                return (
                  <tr key={p.cnpj} className="h-linha border-b border-borda-leve last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/empresas/${p.cnpj}`} className="text-texto hover:text-primaria hover:underline">
                        {p.razao_social}
                      </Link>
                      {p.sancionada ? (
                        <span className="ml-2 inline-flex">
                          <Termo chave="sancao">
                            <span className="inline-flex rounded-pilula bg-suspensa-fundo px-2 py-0.5 text-legenda font-semibold text-suspensa-texto">
                              Sanção registrada
                            </span>
                          </Termo>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap text-legenda text-texto-2">{cnpj(p.cnpj)}</td>
                    <td className="px-4 py-3 text-legenda text-texto-suave">{p.porte ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-texto-2 tabular-nums">
                      {/* 85 das 113 habilitadas vêm com valor zero do PNCP: são as
                          classificadas atrás da vencedora num registro de preços,
                          sem valor homologado. Zero aqui é "não informado". */}
                      {Number(p.valor_proposta) > 0 ? moeda(p.valor_proposta) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s && (p.situacao === "vencedora" || p.situacao === "habilitada") ? (
                        <Termo chave={p.situacao}>
                          <span className={`${s.cor} inline-flex rounded-pilula px-2.5 py-1 text-legenda font-semibold`}>
                            {s.rotulo}
                          </span>
                        </Termo>
                      ) : s ? (
                        <span className={`${s.cor} inline-flex rounded-pilula px-2.5 py-1 text-legenda font-semibold`}>
                          {s.rotulo}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
