import { describe, expect, it } from "vitest";
import { chaveModalidade, GLOSSARIO, GRUPOS } from "./glossario";

/* Valores de licitacoes.modalidade encontrados no banco em 2026-09-23. Se o
   PNCP trouxer um novo, acrescentar aqui e no glossário juntos. */
const MODALIDADES_NO_BANCO = [
  "Pregão - Eletrônico",
  "Concorrência - Eletrônica",
  "Inexigibilidade",
  "Dispensa",
  "Credenciamento",
  "Leilão - Eletrônico",
  "Concorrência - Presencial",
  "Pregão - Presencial",
];

const STATUS_DO_CHECK = ["aberta", "em_analise", "homologada", "suspensa", "encerrada"];

describe("glossário", () => {
  it("todo status do CHECK tem explicação", () => {
    for (const status of STATUS_DO_CHECK) {
      expect(GLOSSARIO, status).toHaveProperty(status);
    }
  });

  it("toda modalidade do banco aponta para uma entrada que existe", () => {
    for (const nome of MODALIDADES_NO_BANCO) {
      const chave = chaveModalidade(nome);
      expect(chave, nome).toBeDefined();
      expect(GLOSSARIO, nome).toHaveProperty(chave!);
    }
  });

  it("modalidade desconhecida não inventa explicação", () => {
    expect(chaveModalidade("Diálogo Competitivo Interplanetário")).toBeUndefined();
    expect(chaveModalidade(null)).toBeUndefined();
  });

  it("texto curto cabe no balão e o longo não está vazio", () => {
    for (const [chave, e] of Object.entries(GLOSSARIO)) {
      expect(e.curto.length, chave).toBeGreaterThan(0);
      expect(e.curto.length, chave).toBeLessThanOrEqual(220);
      expect(e.longo.length, chave).toBeGreaterThan(0);
    }
  });

  it("toda entrada pertence a um grupo que a página Entenda mostra", () => {
    const grupos = GRUPOS.map((g) => g.id);
    for (const [chave, e] of Object.entries(GLOSSARIO)) {
      expect(grupos, chave).toContain(e.grupo);
    }
  });
});
