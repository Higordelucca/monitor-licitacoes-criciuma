import { describe, expect, it } from "vitest";
import { cnpjValido, interpretarBusca } from "./busca";

describe("cnpjValido", () => {
  it("aceita CNPJ real com dígito verificador certo", () => {
    expect(cnpjValido("82916818000113")).toBe(true); // Município de Criciúma
    expect(cnpjValido("05140677000149")).toBe(true); // CriciúmaPrev
  });

  it("recusa dígito verificador errado", () => {
    expect(cnpjValido("82916818000112")).toBe(false);
    expect(cnpjValido("82916818000103")).toBe(false);
  });

  it("recusa tamanho errado e sequência repetida", () => {
    expect(cnpjValido("8291681800011")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

describe("interpretarBusca", () => {
  it("CNPJ com ou sem máscara vira busca por CNPJ, só com dígitos", () => {
    expect(interpretarBusca("82.916.818/0001-13")).toEqual({ tipo: "cnpj", cnpj: "82916818000113" });
    expect(interpretarBusca(" 82916818000113 ")).toEqual({ tipo: "cnpj", cnpj: "82916818000113" });
  });

  it("14 dígitos com verificador errado é tratado como texto, não como CNPJ", () => {
    expect(interpretarBusca("82916818000112")).toEqual({ tipo: "texto", texto: "82916818000112" });
  });

  it("texto comum é aparado e limitado", () => {
    expect(interpretarBusca("  merenda escolar ")).toEqual({ tipo: "texto", texto: "merenda escolar" });
    expect(interpretarBusca("a".repeat(300))).toEqual({ tipo: "texto", texto: "a".repeat(200) });
  });

  it("vazio, só espaço ou ausente não busca nada", () => {
    expect(interpretarBusca("")).toEqual({ tipo: "vazia" });
    expect(interpretarBusca("   ")).toEqual({ tipo: "vazia" });
    expect(interpretarBusca(undefined)).toEqual({ tipo: "vazia" });
    expect(interpretarBusca(["merenda", "outra"])).toEqual({ tipo: "texto", texto: "merenda" });
  });
});
