import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

/* Senha: hash argon2id, senha temporária do script de usuários e a regra de
   bloqueio por tentativas. O bloqueio é função pura; quem grava no banco é a
   action de login. */

export const MAX_FALHAS = 5;
export const MINUTOS_BLOQUEIO = 15;

export function hashSenha(senha: string): Promise<string> {
  // Os padrões da biblioteca já são argon2id com parâmetros da OWASP.
  return hash(senha);
}

export async function conferirSenha(hashGravado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashGravado, senha);
  } catch {
    return false;
  }
}

/* Hash de uma senha qualquer, para conferir quando o e-mail não existe. Sem
   ele, "e-mail inexistente" responde mais rápido que "senha errada", e o tempo
   de resposta diria quais e-mails têm conta. */
let hashFalso: Promise<string> | undefined;
export function hashDeFachada(): Promise<string> {
  hashFalso ??= hash("senha-de-fachada-que-ninguem-usa");
  return hashFalso;
}

/* Sem mínimo por enquanto, a pedido do Higor: é fase de testes. Antes de
   abrir o site para outras pessoas, voltar a exigir pelo menos 10 caracteres
   (pendência registrada no CLAUDE.md). O máximo fica: acima de 200 não há
   ganho, só CPU gasta no hash. */
export const MIN_SENHA = 1;

export function senhaAceitavel(senha: string): boolean {
  return senha.length >= MIN_SENHA && senha.length <= 200;
}

// Sem 0/O, 1/l/I: a senha é ditada ou copiada do terminal para a pessoa.
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarSenhaTemporaria(): string {
  let s = "";
  for (let i = 0; i < 16; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export function aposFalha(falhas: number, agora: Date): { falhas: number; bloqueadoAte: Date | null } {
  const total = falhas + 1;
  if (total < MAX_FALHAS) return { falhas: total, bloqueadoAte: null };
  return { falhas: 0, bloqueadoAte: new Date(agora.getTime() + MINUTOS_BLOQUEIO * 60_000) };
}

export function bloqueado(ate: Date | null, agora: Date): boolean {
  return ate !== null && ate > agora;
}
