import { consultar } from "@/lib/db";

/* Consultas de empresa usadas por /empresas e /buscar. */

export type ResumoEmpresa = {
  cnpj: string;
  razao_social: string;
  porte: string | null;
  participacoes: string;
  vitorias: string;
};

const RESUMO = `
  select e.cnpj, e.razao_social, e.porte,
         count(p.id) as participacoes,
         count(p.id) filter (where p.situacao = 'vencedora') as vitorias
    from empresas e
    left join participantes p on p.cnpj = e.cnpj`;

/** Empresas cujo nome contém o texto. `position` em vez de LIKE: assim % e _
    digitados pela pessoa são texto comum, não curinga. */
export function buscarEmpresas(texto: string, limite = 20) {
  return consultar<ResumoEmpresa>(
    `${RESUMO}
      where position(lower($1) in lower(e.razao_social)) > 0
      group by e.cnpj
      order by vitorias desc, e.razao_social
      limit $2`,
    [texto, limite],
  );
}

export function empresasQueMaisVenceram(limite = 20) {
  return consultar<ResumoEmpresa>(
    `${RESUMO}
      group by e.cnpj
      order by vitorias desc, e.razao_social
      limit $1`,
    [limite],
  );
}
