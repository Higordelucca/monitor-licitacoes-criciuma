import { describe, expect, it } from "vitest";
import { normalizarLogin } from "./login";

describe("normalizarLogin", () => {
  it("aceita letras, números, ponto, hífen e sublinhado, e grava em minúsculas", () => {
    expect(normalizarLogin(" Ana.Souza ")).toBe("ana.souza");
    expect(normalizarLogin("joao_2")).toBe("joao_2");
  });

  it("recusa o que o CHECK do banco recusaria", () => {
    expect(normalizarLogin("jo")).toBeNull();
    expect(normalizarLogin("joão")).toBeNull();
    expect(normalizarLogin("ana souza")).toBeNull();
    expect(normalizarLogin("ana@criciuma")).toBeNull();
    expect(normalizarLogin("a".repeat(41))).toBeNull();
    expect(normalizarLogin(null)).toBeNull();
  });
});
