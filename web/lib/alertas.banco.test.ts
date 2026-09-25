import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/* Triggers de aviso (db/migrations/006 e 010), testados contra o Neon de verdade.
   Tudo roda numa transação que termina em rollback: nada fica no banco.

   Não entra no `npm test` comum, que roda sem rede. Rodar com:
     npm run test:banco */

const ATIVO = process.env.TESTE_BANCO === "1";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const linha = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  return linha?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

describe.skipIf(!ATIVO)("triggers de aviso", () => {
  const db = new pg.Client({ connectionString: ATIVO ? databaseUrl() : undefined });
  let usuario: string;
  let licitacao: { id: string; status: string };
  let n = 0;

  const q = async <T = Record<string, unknown>>(sql: string, v: unknown[] = []) =>
    (await db.query(sql, v)).rows as T[];
  const avisos = (tipo: string) =>
    q<{ quantidade: number; texto: string; lido: boolean }>(
      "select quantidade, texto, lido from alertas where user_id = $1 and tipo = $2 order by id",
      [usuario, tipo],
    );
  const documento = (titulo: string) =>
    q("insert into documentos (licitacao_id, titulo, url) values ($1, $2, $3)", [
      licitacao.id,
      titulo,
      `teste://doc/${++n}`,
    ]);

  beforeAll(() => db.connect());
  afterAll(() => db.end());

  beforeEach(async () => {
    await q("rollback");
    await q("begin");
    [{ id: usuario }] = await q<{ id: string }>(
      "insert into usuarios (login, senha_hash) values ('teste.trigger', 'x') returning id",
    );
    // Uma licitação do Município, que já terminou de coletar: o collector não
    // disputa a trava da linha com o teste.
    [licitacao] = await q<{ id: string; status: string }>(
      "select id, status from licitacoes where id_pncp like '82916818000113%' order by id limit 1",
    );
  });

  afterAll(async () => {
    await q("rollback");
  });

  it("documento novo em licitação seguida gera aviso; repetido acumula até ser lido", async () => {
    await q("insert into seguindo (user_id, licitacao_id) values ($1, $2)", [usuario, licitacao.id]);

    await documento("Edital retificado");
    expect(await avisos("documento_novo")).toEqual([{ quantidade: 1, texto: "Edital retificado", lido: false }]);

    await documento("5f7696e2c8a9491a840402aa5df14e96");
    expect(await avisos("documento_novo")).toEqual([{ quantidade: 2, texto: "Documento", lido: false }]);

    await q("update alertas set lido = true where user_id = $1", [usuario]);
    await documento("Ata da sessão");
    const depois = await avisos("documento_novo");
    expect(depois).toHaveLength(2);
    expect(depois[1]).toEqual({ quantidade: 1, texto: "Ata da sessão", lido: false });
  });

  it("documento em licitação que ninguém segue não gera aviso", async () => {
    await documento("Edital");
    expect(await avisos("documento_novo")).toEqual([]);
  });

  it("mudança de status gera aviso com de → para; reescrever o mesmo status não", async () => {
    await q("insert into seguindo (user_id, licitacao_id) values ($1, $2)", [usuario, licitacao.id]);
    const outro = licitacao.status === "suspensa" ? "encerrada" : "suspensa";

    await q("update licitacoes set status = status where id = $1", [licitacao.id]);
    expect(await avisos("mudanca_status")).toEqual([]);

    await q("update licitacoes set status = $2 where id = $1", [licitacao.id, outro]);
    const [aviso] = await avisos("mudanca_status");
    expect(aviso.texto).toMatch(/ → (Suspensa|Encerrada)$/);
    expect(aviso.quantidade).toBe(1);
  });

  it("empresa seguida que vira vencedora gera aviso; habilitada não", async () => {
    // Duas empresas reais que não participaram desta licitação.
    const [a, b] = await q<{ cnpj: string }>(
      `select cnpj from empresas e
        where not exists (select 1 from participantes p where p.cnpj = e.cnpj and p.licitacao_id = $1)
        order by cnpj limit 2`,
      [licitacao.id],
    );
    await q("insert into seguindo_empresas (user_id, cnpj) values ($1, $2), ($1, $3)", [usuario, a.cnpj, b.cnpj]);

    await q("insert into participantes (licitacao_id, cnpj, situacao) values ($1, $2, 'vencedora')", [
      licitacao.id,
      a.cnpj,
    ]);
    expect(await avisos("empresa_venceu")).toHaveLength(1);

    await q("insert into participantes (licitacao_id, cnpj, situacao) values ($1, $2, 'habilitada')", [
      licitacao.id,
      b.cnpj,
    ]);
    expect(await avisos("empresa_venceu")).toHaveLength(1);

    await q("update participantes set situacao = 'vencedora' where licitacao_id = $1 and cnpj = $2", [
      licitacao.id,
      b.cnpj,
    ]);
    expect(await avisos("empresa_venceu")).toHaveLength(2);

    // O upsert do collector reescreve a mesma situação: não pode avisar de novo.
    await q("update participantes set situacao = 'vencedora' where licitacao_id = $1", [licitacao.id]);
    expect(await avisos("empresa_venceu")).toHaveLength(2);
  });

  describe("contrato assinado", () => {
    let empresa: string;
    const contrato = (publicado: string, licitacaoId: string | null = licitacao.id) =>
      q(
        `insert into contratos (id_pncp, licitacao_id, cnpj, numero, objeto, data_publicacao)
         values ($1, $2, $3, '211/2023', 'Objeto do contrato', $4)`,
        [`teste-contrato-${++n}`, licitacaoId, empresa, publicado],
      );

    beforeEach(async () => {
      [{ cnpj: empresa }] = await q<{ cnpj: string }>("select cnpj from empresas order by cnpj limit 1");
    });

    it("avisa quem segue a licitação", async () => {
      await q("insert into seguindo (user_id, licitacao_id) values ($1, $2)", [usuario, licitacao.id]);
      await contrato(new Date().toISOString());
      const [aviso] = await avisos("contrato");
      expect(aviso).toMatchObject({ quantidade: 1, texto: "Objeto do contrato" });
    });

    it("avisa quem segue a empresa, mesmo sem licitação no banco", async () => {
      await q("insert into seguindo_empresas (user_id, cnpj) values ($1, $2)", [usuario, empresa]);
      await contrato(new Date().toISOString(), null);
      expect(await avisos("contrato")).toHaveLength(1);
    });

    it("quem segue a licitação e a empresa recebe um aviso só", async () => {
      await q("insert into seguindo (user_id, licitacao_id) values ($1, $2)", [usuario, licitacao.id]);
      await q("insert into seguindo_empresas (user_id, cnpj) values ($1, $2)", [usuario, empresa]);
      await contrato(new Date().toISOString());
      expect(await avisos("contrato")).toHaveLength(1);
    });

    it("contrato publicado há mais de 7 dias não avisa: é a primeira carga", async () => {
      await q("insert into seguindo (user_id, licitacao_id) values ($1, $2)", [usuario, licitacao.id]);
      await contrato("2023-10-11");
      expect(await avisos("contrato")).toEqual([]);
    });
  });
});
