/* O indicador "Sincronizado há X" do Header, tirado do sync_log do PNCP.

   Até 2026-09-30 o Header lia só a última linha: um job cancelado deixava
   "rodando" para sempre ("Sincronizando agora" sem nada rodar), e uma rodada
   com erro aparecia como "Sincronizado há 2 min" com a hora da falha. Agora
   cada fonte (um órgão, ou os contratos de um órgão) conta pela sua última
   linha, e a hora mostrada é a do último sucesso. */

export type FonteSync = {
  fonte: string;
  ultimo_status: string;
  ultimo_inicio: Date;
  ultimo_ok: Date | null;
};

export type ResumoSync = {
  situacao: "ok" | "rodando" | "atrasado" | "falhou";
  sincronizadoEm: Date | null;
};

/** O job mais longo do workflow (completa) tem 180 min. Linha "rodando"
    mais velha que isso é de um processo que morreu sem fechar a linha. */
const RODADA_MORTA_MS = 180 * 60_000;

/** A rápida é agendada a cada 30 min; sem sucesso por 2 h, algo parou. */
const ATRASO_MS = 120 * 60_000;

export function resumoSync(fontes: FonteSync[], agora = new Date()): ResumoSync {
  const oks = fontes.map((f) => f.ultimo_ok);
  const sincronizadoEm =
    fontes.length && oks.every((d) => d) ? new Date(Math.min(...oks.map((d) => d!.getTime()))) : null;

  const viva = (f: FonteSync) => agora.getTime() - f.ultimo_inicio.getTime() <= RODADA_MORTA_MS;
  const rodando = fontes.some((f) => f.ultimo_status === "rodando" && viva(f));
  const falhou =
    !sincronizadoEm ||
    fontes.some((f) => f.ultimo_status === "erro" || (f.ultimo_status === "rodando" && !viva(f)));

  if (rodando) return { situacao: "rodando", sincronizadoEm };
  if (falhou) return { situacao: "falhou", sincronizadoEm };
  if (agora.getTime() - sincronizadoEm.getTime() > ATRASO_MS) return { situacao: "atrasado", sincronizadoEm };
  return { situacao: "ok", sincronizadoEm };
}
