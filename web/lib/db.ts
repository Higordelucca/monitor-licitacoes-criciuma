import { Pool, types } from "pg";
import { lerDia } from "./format";

/* Acesso ao Neon. Só roda no servidor: a connection string nunca é exposta
   ao cliente, e por isso não existe RLS no banco (ver CLAUDE.md).

   O pool é guardado em globalThis porque o hot reload do dev recarrega este
   módulo a cada alteração. Sem isso, cada salvamento abriria um pool novo e
   o Neon derrubaria a conexão por excesso. */

// Coluna date chega como Date ao meio-dia de Brasília; ver lerDia.
types.setTypeParser(types.builtins.DATE, lerDia);

const global_ = globalThis as unknown as { poolNeon?: Pool };

export const pool =
  global_.poolNeon ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // O free tier do Neon é apertado; leitura de página não precisa de mais.
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") global_.poolNeon = pool;

export async function consultar<T>(sql: string, valores: unknown[] = []) {
  const { rows } = await pool.query(sql, valores);
  return rows as T[];
}
