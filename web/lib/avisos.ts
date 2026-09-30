import { diaEmBrasilia } from "./format";

/* Avisos temporários na faixa abaixo do Header — ÚNICO lugar com eles. Cada
   um tem data de início e de fim (dias de Brasília, inclusive) e some sozinho
   depois do fim, sem precisar de deploy. */

export type Aviso = {
  chave: string;
  inicio: string; // aaaa-mm-dd
  fim: string; // aaaa-mm-dd
  texto: string;
  fonte: { rotulo: string; url: string };
};

const AVISOS: Aviso[] = [
  {
    // O aviso do PNCP ("Durante o defeso eleitoral, alguns links desta página
    // poderão estar restritos", em gov.br/pncp, conferido em 2026-09-30) não
    // traz datas. Início: 4/7/2026, três meses antes da eleição, confirmado
    // pela Casa Civil. Fim: 25/10/2026, o 2º turno (último domingo de
    // outubro, art. 77 da Constituição). Não se afirma que o defeso cause
    // falha da coleta: as quedas do PNCP não têm causa conhecida.
    chave: "defeso_eleitoral",
    inicio: "2026-07-04",
    fim: "2026-10-25",
    texto:
      "Período eleitoral (4/7 a 25/10/2026): o PNCP avisa que alguns links do portal podem estar " +
      "restritos durante o defeso eleitoral. Se um link “Abrir no PNCP” não abrir ou a coleta " +
      "atrasar, pode ser isso. Os dados já coletados continuam aqui.",
    fonte: { rotulo: "Aviso do PNCP", url: "https://www.gov.br/pncp/pt-br" },
  },
];

export function avisosVigentes(agora = new Date()): Aviso[] {
  const hoje = diaEmBrasilia(agora);
  return AVISOS.filter((a) => a.inicio <= hoje && hoje <= a.fim);
}
