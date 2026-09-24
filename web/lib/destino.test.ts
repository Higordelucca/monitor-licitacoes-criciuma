import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino";

describe("destinoSeguro", () => {
  it("aceita caminho interno, com busca", () => {
    expect(destinoSeguro("/licitacoes/70")).toBe("/licitacoes/70");
    expect(destinoSeguro("/?status=aberta&pagina=2")).toBe("/?status=aberta&pagina=2");
  });

  it("recusa qualquer coisa que leve para fora do site", () => {
    expect(destinoSeguro("https://golpe.com")).toBe("/");
    expect(destinoSeguro("//golpe.com")).toBe("/");
    expect(destinoSeguro("/\\golpe.com")).toBe("/");
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
  });

  it("não volta para o login nem para vazio", () => {
    expect(destinoSeguro("/login")).toBe("/");
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
  });
});
