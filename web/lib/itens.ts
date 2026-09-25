/* Itens da licitação e quem ficou registrado em cada um (tabela
   resultados_item, gravada pelo collector a partir do /resultados do PNCP). */

export type ResultadoItem = {
  /** Nulo quando o fornecedor é pessoa física: o CPF não é guardado. */
  cnpj: string | null;
  razao_social: string | null;
  tipo_pessoa: string | null;
  /** Ordem de classificação no registro de preços; nula fora dele. */
  ordem: number | null;
  valor_total_homologado: number | null;
  valor_unitario_homologado: number | null;
};

/** O vencedor do item e quantos outros fornecedores ficaram registrados.

    No registro de preços vence a ordem 1 e os demais ficam registrados atrás
    dela. Fora dele não há ordem, e o resultado é o vencedor. */
export function resumoResultados(resultados: ResultadoItem[]): {
  vencedor: ResultadoItem | null;
  outros: number;
} {
  if (resultados.length === 0) return { vencedor: null, outros: 0 };
  const vencedor =
    resultados.find((r) => r.ordem === 1) ?? resultados.find((r) => r.ordem === null) ?? null;
  return { vencedor, outros: resultados.length - (vencedor ? 1 : 0) };
}
