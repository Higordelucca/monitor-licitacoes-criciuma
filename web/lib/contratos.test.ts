import { describe, expect, it } from "vitest";
import { lerDia } from "./format";
import { conferidosEm, contratoVigente } from "./contratos";

const HOJE = new Date("2026-09-25T12:00:00-03:00");

describe("contrato vigente", () => {
  it("vale até o último dia da vigência, inclusive", () => {
    expect(contratoVigente({ vigencia_fim: lerDia("2026-09-25") }, HOJE)).toBe(true);
    expect(contratoVigente({ vigencia_fim: lerDia("2026-09-24") }, HOJE)).toBe(false);
  });

  it("sem data de fim conta como vigente", () => {
    expect(contratoVigente({ vigencia_fim: null }, HOJE)).toBe(true);
  });
});

describe("conferidosEm", () => {
  const conferencia = (orgao: number, dia: string) => ({
    fonte: `PNCP · Contratos · Órgão ${orgao}`,
    finalizado_em: new Date(dia),
  });

  it("com os sete órgãos conferidos, vale a conferência mais antiga", () => {
    const ultimas = [1, 2, 3, 4, 5, 6, 7].map((o) => conferencia(o, `2026-09-2${o % 3 + 3}T10:00:00Z`));
    expect(conferidosEm(ultimas)).toEqual(new Date("2026-09-23T10:00:00Z"));
  });

  it("faltando um órgão, não dá para dizer que não há contrato", () => {
    const ultimas = [1, 2, 3, 4, 5, 6].map((o) => conferencia(o, "2026-09-25T10:00:00Z"));
    expect(conferidosEm(ultimas)).toBeNull();
  });
});
