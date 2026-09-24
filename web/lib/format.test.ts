import { describe, expect, it } from "vitest";
import { dataCurta, lerDia, tituloDocumento } from "./format";

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

describe("coluna date do Postgres", () => {
  it("vira meio-dia em Brasília, para cair no mesmo dia em qualquer fuso", () => {
    // O pg lia date como meia-noite do fuso do servidor. No Netlify (UTC) isso
    // é 21h do dia anterior em Brasília, e a Ficha mostraria 25/05 no lugar
    // de 26/05.
    expect(lerDia("2017-05-26").toISOString()).toBe("2017-05-26T15:00:00.000Z");
    expect(dataCurta(lerDia("2017-05-26"))).toBe("26/05/2017");
  });
});
