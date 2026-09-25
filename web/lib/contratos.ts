import { ORGAOS } from "./orgaos";
import { vigente } from "./sancoes";

/* Regras de exibição dos contratos do PNCP (collector/contratos.py). */

/** Mesma regra da sanção: sem data de fim, ou com ela ainda por vir. */
export function contratoVigente(c: { vigencia_fim: Date | null }, hoje = new Date()): boolean {
  return vigente({ data_fim: c.vigencia_fim }, hoje);
}

/** A mais antiga das últimas conferências bem-sucedidas de contratos, uma por
    órgão (`PNCP · Contratos · <órgão>` no sync_log). Null se algum órgão
    nunca foi conferido: "nenhum contrato" afirmaria uma consulta que não
    aconteceu — a mesma regra das sanções. */
export function conferidosEm(ultimas: { fonte: string; finalizado_em: Date }[]): Date | null {
  if (new Set(ultimas.map((u) => u.fonte)).size < Object.keys(ORGAOS).length) return null;
  return new Date(Math.min(...ultimas.map((u) => u.finalizado_em.getTime())));
}
