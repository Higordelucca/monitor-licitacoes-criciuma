import { describe, expect, it } from "vitest";
import { resumoResultados, type ResultadoItem } from "./itens";

const r = (ordem: number | null, cnpj: string | null = "11111111000111"): ResultadoItem => ({
  cnpj,
  razao_social: cnpj ? "Empresa" : null,
  tipo_pessoa: cnpj ? "PJ" : "PF",
  ordem,
  valor_total_homologado: 10,
  valor_unitario_homologado: 1,
});

describe("resumoResultados", () => {
  it("sem resultado, sem vencedor", () => {
    expect(resumoResultados([])).toEqual({ vencedor: null, outros: 0 });
  });

  it("no registro de preços, vence a ordem 1 e as demais são outras registradas", () => {
    const [um, dois, tres] = [r(1, "1"), r(2, "2"), r(3, "3")];
    expect(resumoResultados([dois, tres, um])).toEqual({ vencedor: um, outros: 2 });
  });

  it("fora do registro de preços, sem ordem, o único resultado vence", () => {
    const unico = r(null);
    expect(resumoResultados([unico])).toEqual({ vencedor: unico, outros: 0 });
  });

  it("pessoa física também vence", () => {
    const pf = r(1, null);
    expect(resumoResultados([pf]).vencedor).toBe(pf);
  });
});
