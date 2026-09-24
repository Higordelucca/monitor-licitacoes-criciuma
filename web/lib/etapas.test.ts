import { describe, expect, it } from "vitest";
import { etapas, type DadosEtapas } from "./etapas";

const AGORA = new Date("2026-09-23T12:00:00Z");
const ONTEM = new Date("2026-09-22T12:00:00Z");
const AMANHA = new Date("2026-09-24T12:00:00Z");
const MES_PASSADO = new Date("2026-08-20T12:00:00Z");

function base(parcial: Partial<DadosEtapas>): DadosEtapas {
  return {
    status: "aberta",
    data_publicacao: MES_PASSADO,
    data_abertura: AMANHA,
    data_homologacao: null,
    ...parcial,
  };
}

const estados = (d: DadosEtapas) => etapas(d, AGORA).map((e) => [e.nome, e.estado]);

describe("etapas", () => {
  it("aberta: publicada, propostas em curso, o resto por vir", () => {
    expect(estados(base({}))).toEqual([
      ["Publicação no PNCP", "concluida"],
      ["Propostas", "atual"],
      ["Julgamento", "futura"],
      ["Homologação", "futura"],
      ["Contrato", "futura"],
    ]);
  });

  it("em análise: prazo encerrado, julgamento em curso", () => {
    expect(estados(base({ status: "em_analise", data_abertura: ONTEM }))).toEqual([
      ["Publicação no PNCP", "concluida"],
      ["Propostas", "concluida"],
      ["Julgamento", "atual"],
      ["Homologação", "futura"],
      ["Contrato", "futura"],
    ]);
  });

  it("homologada: tudo concluído até a homologação; contrato ainda sem dado", () => {
    const e = etapas(base({ status: "homologada", data_abertura: ONTEM, data_homologacao: AGORA }), AGORA);
    expect(e.map((x) => x.estado)).toEqual(["concluida", "concluida", "concluida", "concluida", "futura"]);
    expect(e[3].data).toBe(AGORA);
  });

  it("cada etapa carrega a data que o banco tem, e nenhuma inventada", () => {
    const e = etapas(base({ status: "em_analise", data_abertura: ONTEM }), AGORA);
    expect(e.map((x) => x.data)).toEqual([MES_PASSADO, ONTEM, null, null, null]);
  });

  it("encerrada: o que já passou fica concluído e o resto vira interrompido", () => {
    expect(estados(base({ status: "encerrada", data_abertura: ONTEM }))).toEqual([
      ["Publicação no PNCP", "concluida"],
      ["Propostas", "concluida"],
      ["Julgamento", "interrompida"],
      ["Homologação", "interrompida"],
      ["Contrato", "interrompida"],
    ]);
  });

  it("suspensa antes do fim do prazo: nada fica em curso", () => {
    expect(estados(base({ status: "suspensa" }))).toEqual([
      ["Publicação no PNCP", "concluida"],
      ["Propostas", "interrompida"],
      ["Julgamento", "interrompida"],
      ["Homologação", "interrompida"],
      ["Contrato", "interrompida"],
    ]);
  });

  it("sem data de abertura, a etapa de propostas segue o status", () => {
    expect(estados(base({ status: "em_analise", data_abertura: null }))[1]).toEqual([
      "Propostas",
      "concluida",
    ]);
  });
});
