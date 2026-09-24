// Contas do monitor. O site é fechado e não tem cadastro: quem cria, redefine
// e desativa contas é o admin, por aqui (ver CLAUDE.md, "Decisões das fases 5 e 6").
//
//   npm run usuario -- criar ana.souza [--admin]
//   npm run usuario -- redefinir ana.souza
//   npm run usuario -- desativar ana.souza
//   npm run usuario -- listar
//
// O login segue a regra do CHECK usuarios_login_formato e de lib/login.ts:
// 3 a 40 caracteres entre a-z, 0-9, ponto, hífen e sublinhado.
//
// criar e redefinir geram uma senha temporária e a mostram uma única vez. A
// pessoa é obrigada a trocá-la no primeiro login.

import { hash } from "@node-rs/argon2";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const AQUI = dirname(fileURLToPath(import.meta.url));

function carregarEnv() {
  if (process.env.DATABASE_URL) return;
  for (const linha of readFileSync(join(AQUI, "..", ".env.local"), "utf8").split("\n")) {
    const par = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (par) process.env[par[1]] ??= par[2].trim().replace(/^["']|["']$/g, "");
  }
}

// Mesmo alfabeto de lib/senha.ts: sem 0/O e 1/l/I, que se confundem ao ditar.
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const senhaTemporaria = () => Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

async function main() {
  const [comando, loginBruto, ...resto] = process.argv.slice(2);
  const login = loginBruto?.trim().toLowerCase();
  if (!comando) sair("uso: npm run usuario -- criar|redefinir|desativar|listar [login] [--admin]");
  if (comando !== "listar" && !/^[a-z0-9._-]{3,40}$/.test(login ?? ""))
    sair("login inválido: use 3 a 40 caracteres entre a-z, 0-9, ponto, hífen e sublinhado");

  carregarEnv();
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    if (comando === "listar") {
      const { rows } = await cliente.query(
        "select login, papel, ativo, trocar_senha, criado_em from usuarios order by criado_em",
      );
      console.table(rows);
    } else if (comando === "criar") {
      const papel = resto.includes("--admin") ? "admin" : "leitor";
      const senha = senhaTemporaria();
      const { rowCount } = await cliente.query(
        `insert into usuarios (login, senha_hash, papel) values ($1, $2, $3)
         on conflict (login) do nothing`,
        [login, await hash(senha), papel],
      );
      if (!rowCount) sair(`já existe o usuário ${login}; use redefinir`);
      console.log(`usuário criado: ${login} (${papel})\nsenha temporária: ${senha}`);
    } else if (comando === "redefinir") {
      const senha = senhaTemporaria();
      const { rowCount } = await cliente.query(
        `update usuarios
            set senha_hash = $2, trocar_senha = true, ativo = true, falhas_login = 0, bloqueado_ate = null
          where login = $1`,
        [login, await hash(senha)],
      );
      if (!rowCount) sair(`não existe o usuário ${login}`);
      console.log(`senha redefinida: ${login}\nsenha temporária: ${senha}`);
    } else if (comando === "desativar") {
      const { rowCount } = await cliente.query("update usuarios set ativo = false where login = $1", [login]);
      if (!rowCount) sair(`não existe o usuário ${login}`);
      console.log(`usuário desativado: ${login}`);
    } else {
      sair(`comando desconhecido: ${comando}`);
    }
  } finally {
    await cliente.end();
  }
}

main().catch((e) => sair(e.message));
