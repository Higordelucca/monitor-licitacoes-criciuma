import { describe, expect, it } from "vitest";
import { lerDia } from "./format";
import { rotuloAbrangencia, vigente, verificadoEm } from "./sancoes";

const HOJE = new Date("2026-09-24T12:00:00-03:00");

describe("sanção vigente", () => {
  it("sem data final continua valendo", () => {
    expect(vigente({ data_fim: null }, HOJE)).toBe(true);
  });

  it("vale até o último dia, inclusive", () => {
    expect(vigente({ data_fim: lerDia("2026-09-24") }, HOJE)).toBe(true);
  });

  it("com data final passada já terminou", () => {
    // O CEIS de 2026-09-23 ainda trazia 6 sanções das nossas empresas com
    // data final vencida. Elas aparecem, mas não como impedimento atual.
    expect(vigente({ data_fim: lerDia("2026-09-23") }, HOJE)).toBe(false);
  });
});

describe("verificação das listas", () => {
  const ok = (fonte: string, dia: string) => ({ fonte, finalizado_em: new Date(dia) });

  it("é a mais antiga das três últimas verificações", () => {
    expect(
      verificadoEm([
        ok("Transparência · CEIS", "2026-09-24T09:00:00Z"),
        ok("Transparência · CNEP", "2026-09-23T09:00:00Z"),
        ok("Transparência · CEPIM", "2026-09-24T09:00:00Z"),
      ]),
    ).toEqual(new Date("2026-09-23T09:00:00Z"));
  });

  it("sem uma das listas não há verificação", () => {
    // "Nada consta" afirmaria uma consulta que não aconteceu.
    expect(
      verificadoEm([ok("Transparência · CEIS", "2026-09-24T09:00:00Z"), ok("Transparência · CNEP", "2026-09-24T09:00:00Z")]),
    ).toBeNull();
  });
});

describe("abrangência", () => {
  it("nula vira não informada", () => {
    expect(rotuloAbrangencia(null)).toBe("Abrangência não informada pelo órgão");
  });

  it("informada fica como veio", () => {
    expect(rotuloAbrangencia("No órgão sancionador")).toBe("No órgão sancionador");
  });
});
