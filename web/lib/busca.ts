/* Busca global do Header (PDF 3.1, item 1.3): "se o texto for um CNPJ, abre a
   ficha da empresa". Aqui se decide o que o texto digitado é.

   Só conta como CNPJ o texto feito de dígitos e dos caracteres da máscara, e
   cujo dígito verificador confere. "Pregão 2024" tem dígitos e não é CNPJ;
   14 dígitos com verificador errado são provavelmente erro de digitação, e
   caem na busca por texto em vez de levar a uma ficha que não existe.

   Só CNPJ numérico. O CNPJ alfanumérico que a Receita começou a emitir em
   2026 também não passa no CHECK de empresas.cnpj — os dois mudam juntos. */

export type Busca =
  | { tipo: "vazia" }
  | { tipo: "cnpj"; cnpj: string }
  | { tipo: "texto"; texto: string };

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, ...PESOS_1];

function digitoVerificador(digitos: number[], pesos: number[]): number {
  const resto = digitos.reduce((soma, d, i) => soma + d * pesos[i], 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const d = cnpj.split("").map(Number);
  return (
    digitoVerificador(d.slice(0, 12), PESOS_1) === d[12] &&
    digitoVerificador(d.slice(0, 13), PESOS_2) === d[13]
  );
}

export function interpretarBusca(bruto: string | string[] | undefined): Busca {
  const texto = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim();
  if (!texto) return { tipo: "vazia" };

  if (/^[\d.\/\-\s]+$/.test(texto)) {
    const digitos = texto.replace(/\D/g, "");
    if (cnpjValido(digitos)) return { tipo: "cnpj", cnpj: digitos };
  }
  return { tipo: "texto", texto: texto.slice(0, 200) };
}
