/* Os sete órgãos que o collector coleta, pelo CNPJ. A lista é a mesma de
   ORGAOS em collector/config.py, onde está registrado por que cada vizinho
   ficou de fora — mudar lá exige mudar aqui.

   O órgão de uma licitação sai do prefixo do id_pncp (os 14 primeiros
   dígitos). A coluna `secretaria` não serve para isso: é a unidade
   compradora, e a mesma Prefeitura aparece grafada de três jeitos. */

export const ORGAOS: Record<string, string> = {
  "82916818000113": "Município de Criciúma",
  "08435209000190": "Fundo Municipal de Saúde",
  "05140677000149": "CriciúmaPrev",
  "00074312000140": "Fundação Cultural",
  "83728949000130": "Câmara Municipal",
  "11786437000119": "Fundo de Assistência Social",
  "86951555000134": "Fundação de Esportes",
};

export function nomeOrgao(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  return ORGAOS[cnpj] ?? cnpj;
}
