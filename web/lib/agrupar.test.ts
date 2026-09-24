import { describe, expect, it } from "vitest";
import { agruparPorDia } from "./agrupar";

// 23/09/2026 às 10h em Brasília (13h UTC).
const AGORA = new Date("2026-09-23T13:00:00Z");
const item = (iso: string) => ({ criado_em: new Date(iso) });

describe("agruparPorDia", () => {
  it("separa em Hoje, Ontem e data, pelo dia de Brasília, mantendo a ordem", () => {
    const grupos = agruparPorDia(
      [
        item("2026-09-23T12:00:00Z"), // hoje 9h
        item("2026-09-23T02:00:00Z"), // 22/09 às 23h em Brasília: ontem, embora seja 23/09 em UTC
        item("2026-09-22T15:00:00Z"), // ontem
        item("2026-09-20T15:00:00Z"),
      ],
      AGORA,
    );
    expect(grupos.map((g) => [g.rotulo, g.itens.length])).toEqual([
      ["Hoje", 1],
      ["Ontem", 2],
      ["20/09/2026", 1],
    ]);
  });

  it("lista vazia não tem grupo", () => {
    expect(agruparPorDia([], AGORA)).toEqual([]);
  });
});
