import { describe, expect, it } from "vitest";
import { avisosVigentes } from "./avisos";

const em = (iso: string) => new Date(iso);

describe("avisos da faixa abaixo do Header", () => {
  it("defeso eleitoral aparece dentro do período", () => {
    expect(avisosVigentes(em("2026-09-30T13:00:00-03:00")).map((a) => a.chave)).toEqual(["defeso_eleitoral"]);
  });

  it("aparece no primeiro e no último dia, pelo dia de Brasília", () => {
    expect(avisosVigentes(em("2026-07-04T00:30:00-03:00"))).toHaveLength(1);
    expect(avisosVigentes(em("2026-10-25T23:30:00-03:00"))).toHaveLength(1);
  });

  it("some sozinho no dia seguinte ao fim", () => {
    expect(avisosVigentes(em("2026-10-26T00:30:00-03:00"))).toEqual([]);
  });

  it("não aparece antes do início", () => {
    expect(avisosVigentes(em("2026-07-03T23:30:00-03:00"))).toEqual([]);
  });
});
