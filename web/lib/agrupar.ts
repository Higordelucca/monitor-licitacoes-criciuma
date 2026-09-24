/* Agrupa avisos por dia para a tela Alertas (PDF 4.4: "Hoje, Ontem…"). O dia
   é o de Brasília: o servidor roda em UTC, e às 23h de Criciúma já é o dia
   seguinte lá. */

const FUSO = "America/Sao_Paulo";

const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: FUSO });

export function agruparPorDia<T extends { criado_em: Date }>(
  itens: T[],
  agora: Date = new Date(),
): { rotulo: string; itens: T[] }[] {
  const hoje = dia(agora);
  const ontem = dia(new Date(agora.getTime() - 24 * 60 * 60 * 1000));

  const grupos: { rotulo: string; itens: T[] }[] = [];
  for (const item of itens) {
    const d = dia(item.criado_em);
    const rotulo = d === hoje ? "Hoje" : d === ontem ? "Ontem" : d;
    const ultimo = grupos.at(-1);
    if (ultimo?.rotulo === rotulo) ultimo.itens.push(item);
    else grupos.push({ rotulo, itens: [item] });
  }
  return grupos;
}
