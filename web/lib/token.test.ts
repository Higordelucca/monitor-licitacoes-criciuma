import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { criarToken, lerToken, SEGUNDOS_SESSAO } from "./token";

const SEGREDO = "x".repeat(32);
const OUTRO = "y".repeat(32);
const sessao = { id: "7", login: "ana.souza", papel: "leitor" as const, trocarSenha: false };

describe("token de sessão", () => {
  it("o que entra volta igual", async () => {
    const t = await criarToken(sessao, SEGREDO);
    expect(await lerToken(t, SEGREDO)).toEqual(sessao);
  });

  it("assinado com outro segredo é recusado", async () => {
    const t = await criarToken(sessao, OUTRO);
    expect(await lerToken(t, SEGREDO)).toBeNull();
  });

  it("adulterado é recusado", async () => {
    const t = await criarToken(sessao, SEGREDO);
    const [cab, corpo, assinatura] = t.split(".");
    const falso = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(corpo, "base64url").toString()), papel: "admin" }),
    ).toString("base64url");
    expect(await lerToken(`${cab}.${falso}.${assinatura}`, SEGREDO)).toBeNull();
  });

  it("expirado é recusado", async () => {
    const agora = new Date("2026-09-23T12:00:00Z");
    const t = await criarToken(sessao, SEGREDO, agora);
    const depois = new Date(agora.getTime() + (SEGUNDOS_SESSAO + 60) * 1000);
    expect(await lerToken(t, SEGREDO, depois)).toBeNull();
    const antes = new Date(agora.getTime() + (SEGUNDOS_SESSAO - 60) * 1000);
    expect(await lerToken(t, SEGREDO, antes)).toEqual(sessao);
  });

  it("token com algoritmo 'none' ou lixo é recusado", async () => {
    expect(await lerToken("lixo", SEGREDO)).toBeNull();
    expect(await lerToken(undefined, SEGREDO)).toBeNull();
    const semAssinatura = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: "1", papel: "admin" }),
    ).toString("base64url")}.`;
    expect(await lerToken(semAssinatura, SEGREDO)).toBeNull();
  });

  it("token válido mas com papel fora da lista é recusado", async () => {
    const t = await new SignJWT({ login: "ana", papel: "root", trocarSenha: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SEGREDO));
    expect(await lerToken(t, SEGREDO)).toBeNull();
  });

  it("segredo curto é erro de configuração, não sessão aceita", async () => {
    await expect(criarToken(sessao, "curto")).rejects.toThrow();
  });
});
