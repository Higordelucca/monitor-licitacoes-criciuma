/* Formatação de tela. O banco guarda dado cru — CNPJ só com dígitos, dinheiro
   como numeric, data como timestamptz — e a máscara mora aqui.

   Toda data é renderizada no fuso de Brasília, explicitamente. O servidor do
   site roda em UTC (Vercel): sem o timeZone fixo, uma abertura às 21h de Criciúma
   apareceria no dia seguinte. */

const FUSO = "America/Sao_Paulo";

/* `numeric` do Postgres chega como string no driver pg, de propósito: um
   numeric(15,2) não cabe em double sem perder centavo. Só convertemos na
   borda da tela, onde a perda não volta para o banco. */
type Numerico = string | number | null | undefined;

function paraNumero(valor: Numerico): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function moeda(valor: Numerico): string {
  const n = paraNumero(valor);
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Versão curta para card de KPI: "R$ 49,2 mi" em vez de doze dígitos. */
export function moedaCurta(valor: Numerico): string {
  const n = paraNumero(valor);
  if (n === null) return "—";
  const escalas: [number, string][] = [
    [1e9, "bi"],
    [1e6, "mi"],
    [1e3, "mil"],
  ];
  for (const [divisor, sufixo] of escalas) {
    if (n >= divisor) {
      const reduzido = (n / divisor).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      });
      return `R$ ${reduzido} ${sufixo}`;
    }
  }
  return moeda(n);
}

export function inteiro(valor: Numerico): string {
  const n = paraNumero(valor);
  return n === null ? "—" : n.toLocaleString("pt-BR");
}

export function dataCurta(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function dataHora(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function cnpj(digitos: string | null | undefined): string {
  const d = (digitos ?? "").replace(/\D/g, "");
  if (d.length !== 14) return digitos ?? "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** "há 12 min", "há 3 h", "há 2 dias" — para o indicador de sincronização. */
export function haQuantoTempo(
  valor: Date | string | null | undefined,
  agora: Date = new Date(),
): string {
  if (!valor) return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";

  const segundos = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 1000));
  if (segundos < 60) return "há instantes";

  const faixas: [number, string, string][] = [
    [60, "min", "min"],
    [3600, "h", "h"],
    [86400, "dia", "dias"],
  ];
  let escolhida = faixas[0];
  for (const faixa of faixas) if (segundos >= faixa[0]) escolhida = faixa;

  const n = Math.floor(segundos / escolhida[0]);
  return `há ${n} ${n === 1 ? escolhida[1] : escolhida[2]}`;
}

/** O PNCP não devolve o número do edital na busca, só o sequencial e o ano. */
export function numeroLicitacao(
  processo: string | null | undefined,
  ano: number | null | undefined,
): string {
  if (!processo) return "—";
  return ano ? `${processo}/${ano}` : processo;
}

/** Dia e mês separados, para o bloco de data de "Próximas aberturas". */
export function diaEMes(valor: Date | string | null | undefined): { dia: string; mes: string } {
  if (!valor) return { dia: "—", mes: "" };
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return { dia: "—", mes: "" };
  return {
    dia: d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit" }),
    mes: d.toLocaleDateString("pt-BR", { timeZone: FUSO, month: "short" }).replace(".", ""),
  };
}

/** Parte dos documentos do PNCP tem como título um hash de 32 caracteres, que
    não diz nada a quem lê. Nesses casos vale mais o tipo do documento. */
export function tituloDocumento(titulo: string | null | undefined, tipo: string | null | undefined): string {
  const t = titulo?.trim();
  if (t && !/^[0-9a-f]{32}$/i.test(t)) return t;
  return tipo?.trim() || "Documento";
}

/** Coluna `date` do Postgres ("2017-05-26") para Date. Meio-dia de Brasília
    em vez da meia-noite do fuso do servidor, que na Vercel (UTC) é 21h do
    dia anterior em Brasília — toda data sairia um dia antes. Registrado como
    parser do pg em lib/db.ts. */
export function lerDia(texto: string): Date {
  return new Date(`${texto}T12:00:00-03:00`);
}

/** Dia do calendário em Brasília, "aaaa-mm-dd", para comparar datas. */
export function diaEmBrasilia(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}
