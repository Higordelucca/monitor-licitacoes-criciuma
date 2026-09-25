import { describe, expect, it } from "vitest";
import { dataCurta, lerDia, moedaUnitaria, quantidade, tituloDocumento } from "./format";

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
    // O pg lia date como meia-noite do fuso do servidor. Na Vercel (UTC) isso
    // é 21h do dia anterior em Brasília, e a Ficha mostraria 25/05 no lugar
    // de 26/05.
    expect(lerDia("2017-05-26").toISOString()).toBe("2017-05-26T15:00:00.000Z");
    expect(dataCurta(lerDia("2017-05-26"))).toBe("26/05/2017");
  });
});

describe("moedaUnitaria", () => {
  // O Intl separa o símbolo do número com espaço inseparável (U+00A0).
  it("mostra as casas que o PNCP publica, até quatro", () => {
    // Preço de combustível vem com quatro casas; cortar em duas mudaria o valor.
    expect(moedaUnitaria("5.8923")).toBe("R$\u00a05,8923");
  });

  it("nunca menos de duas casas", () => {
    expect(moedaUnitaria("74.84")).toBe("R$\u00a074,84");
    expect(moedaUnitaria("80")).toBe("R$\u00a080,00");
  });

  it("sem valor vira travessão", () => {
    expect(moedaUnitaria(null)).toBe("—");
  });
});

describe("quantidade", () => {
  it("junta número e unidade, sem zeros à toa", () => {
    expect(quantidade("10.0000", "PACOTE")).toBe("10 PACOTE");
    expect(quantidade("2.5000", "Litro")).toBe("2,5 Litro");
  });

  it("milhar com ponto", () => {
    expect(quantidade("12000", "UN")).toBe("12.000 UN");
  });

  it("sem unidade fica só o número; sem número, travessão", () => {
    expect(quantidade("3", null)).toBe("3");
    expect(quantidade(null, "UN")).toBe("—");
  });
});
