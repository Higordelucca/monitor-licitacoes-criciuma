import { diaEmBrasilia } from "./format";

/* Regras de exibição das sanções (CEIS, CNEP, CEPIM), que o collector lê dos
   arquivos diários do Portal da Transparência (collector/transparencia.py). */

export const LISTAS = ["CEIS", "CNEP", "CEPIM"] as const;

/** Sem data final, ou com ela ainda por vir (o último dia conta). */
export function vigente(s: { data_fim: Date | null }, hoje = new Date()): boolean {
  return s.data_fim === null || diaEmBrasilia(s.data_fim) >= diaEmBrasilia(hoje);
}

/** A mais antiga das últimas verificações bem-sucedidas de cada lista, ou
    null se alguma lista nunca foi conferida — aí "nada consta" seria afirmar
    uma consulta que não aconteceu. */
export function verificadoEm(ultimas: { fonte: string; finalizado_em: Date }[]): Date | null {
  const datas = LISTAS.map((l) => ultimas.find((u) => u.fonte === `Transparência · ${l}`)?.finalizado_em);
  if (datas.some((d) => !d)) return null;
  return new Date(Math.min(...datas.map((d) => d!.getTime())));
}

export function rotuloAbrangencia(abrangencia: string | null): string {
  return abrangencia ?? "Abrangência não informada pelo órgão";
}
