// Aplica os .sql de db/migrations/ em ordem alfabética, cada um dentro de
// uma transação, e registra o que já rodou em schema_migrations. Rodar de
// novo não repete nada.
//
//   node db/migrate.mjs           aplica o que falta
//   node db/migrate.mjs --status  só lista, não aplica

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, "migrations");

function carregarEnv() {
  if (process.env.DATABASE_URL) return;
  const env = join(AQUI, "..", "web", ".env.local");
  for (const linha of readFileSync(env, "utf8").split("\n")) {
    const par = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (par) process.env[par[1]] ??= par[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arquivos = () =>
  readdirSync(PASTA)
    .filter((n) => n.endsWith(".sql"))
    .sort();

async function main() {
  carregarEnv();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida. Crie web/.env.local a partir de web/.env.example.");
    process.exit(1);
  }

  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  await cliente.query(`
    create table if not exists schema_migrations (
      nome       text primary key,
      aplicada_em timestamptz not null default now()
    )
  `);

  const { rows } = await cliente.query("select nome from schema_migrations");
  const aplicadas = new Set(rows.map((r) => r.nome));
  const pendentes = arquivos().filter((n) => !aplicadas.has(n));

  if (process.argv.includes("--status")) {
    for (const nome of arquivos()) {
      console.log(`${aplicadas.has(nome) ? "aplicada " : "pendente "} ${nome}`);
    }
    await cliente.end();
    return;
  }

  if (pendentes.length === 0) {
    console.log("Nada a aplicar.");
    await cliente.end();
    return;
  }

  for (const nome of pendentes) {
    process.stdout.write(`aplicando ${nome} ... `);
    try {
      await cliente.query("begin");
      await cliente.query(readFileSync(join(PASTA, nome), "utf8"));
      await cliente.query("insert into schema_migrations (nome) values ($1)", [nome]);
      await cliente.query("commit");
      console.log("ok");
    } catch (erro) {
      await cliente.query("rollback");
      // A mensagem do pg não carrega a connection string, mas o objeto de
      // erro completo pode carregar. Imprime só o que interessa.
      console.log("FALHOU");
      console.error(`  ${erro.message}`);
      if (erro.position) console.error(`  posição ${erro.position}`);
      await cliente.end();
      process.exit(1);
    }
  }

  await cliente.end();
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
