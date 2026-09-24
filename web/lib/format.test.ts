import { describe, expect, it } from "vitest";
import { tituloDocumento } from "./format";

describe("tituloDocumento", () => {
  it("título legível passa como está", () => {
    expect(tituloDocumento("Edital 118/PMC/2026", "Edital")).toBe("Edital 118/PMC/2026");
  });

  it("título que é hash do PNCP cede lugar ao tipo", () => {
    expect(tituloDocumento("5f7696e2c8a9491a840402aa5df14e96", "Edital")).toBe("Edital");
  });

  it("sem título e sem tipo, um nome genérico", () => {
    expect(tituloDocumento("  ", null)).toBe("Documento");
  });
});
