/* Nome de usuário do login. Mesma regra do CHECK usuarios_login_formato
   (db/migrations/005) e de scripts/usuario.mjs: 3 a 40 caracteres entre
   letras sem acento, números, ponto, hífen e sublinhado, em minúsculas. */
export function normalizarLogin(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const login = bruto.trim().toLowerCase();
  return /^[a-z0-9._-]{3,40}$/.test(login) ? login : null;
}
