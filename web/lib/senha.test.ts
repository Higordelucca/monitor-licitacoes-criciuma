import { describe, expect, it } from "vitest";
import {
  aposFalha,
  bloqueado,
  conferirSenha,
  gerarSenhaTemporaria,
  hashSenha,
  MAX_FALHAS,
  MINUTOS_BLOQUEIO,
  senhaAceitavel,
} from "./senha";

describe("hash de senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const hash = await hashSenha("correta horse battery");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await conferirSenha(hash, "correta horse battery")).toBe(true);
    expect(await conferirSenha(hash, "errada")).toBe(false);
  });

  it("hash malformado é senha errada, não exceção", async () => {
    expect(await conferirSenha("não-é-hash", "qualquer")).toBe(false);
  });
});

describe("senha temporária", () => {
  it("tem 16 caracteres sem os que se confundem", () => {
    const s = gerarSenhaTemporaria();
    expect(s).toHaveLength(16);
    expect(s).not.toMatch(/[0O1lI]/);
  });

  it("não repete", () => {
    expect(gerarSenhaTemporaria()).not.toBe(gerarSenhaTemporaria());
  });
});

describe("senha nova", () => {
  it("sem mínimo na fase de testes, mas não vazia", () => {
    expect(senhaAceitavel("")).toBe(false);
    expect(senhaAceitavel("1")).toBe(true);
    expect(senhaAceitavel("curta")).toBe(true);
  });

  it("recusa senha longa demais, que só serve para gastar CPU no hash", () => {
    expect(senhaAceitavel("a".repeat(201))).toBe(false);
  });
});

describe("bloqueio por tentativas", () => {
  const agora = new Date("2026-09-23T12:00:00Z");

  it("conta a falha sem bloquear até o limite", () => {
    expect(aposFalha(0, agora)).toEqual({ falhas: 1, bloqueadoAte: null });
    expect(aposFalha(MAX_FALHAS - 2, agora)).toEqual({ falhas: MAX_FALHAS - 1, bloqueadoAte: null });
  });

  it("na quinta falha bloqueia por 15 minutos e zera o contador", () => {
    const r = aposFalha(MAX_FALHAS - 1, agora);
    expect(r.falhas).toBe(0);
    expect(r.bloqueadoAte?.getTime()).toBe(agora.getTime() + MINUTOS_BLOQUEIO * 60_000);
  });

  it("bloqueado só enquanto a data não passou", () => {
    const ate = new Date(agora.getTime() + 60_000);
    expect(bloqueado(ate, agora)).toBe(true);
    expect(bloqueado(ate, new Date(ate.getTime() + 1))).toBe(false);
    expect(bloqueado(null, agora)).toBe(false);
  });
});
