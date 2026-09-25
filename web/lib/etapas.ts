import type { Status } from "../components/Pilula";

/* Linha do tempo do Detalhe (PDF 3.2, item 8).

   O PDF espera etapas; os `eventos` do banco são o log de manutenção do PNCP
   ("Inclusão: Documento de Contratação"), que não diz em que etapa o processo
   está. As etapas saem, então, do status e das três datas que temos. Etapa
   sem data no banco fica sem data na tela — nenhuma é estimada.

   O contrato fica concluído quando há contrato da licitação no banco, com a
   data de assinatura do mais antigo.

   A primeira etapa é "Publicação no PNCP", não "do edital": em 70 licitações
   a data de publicação no PNCP é posterior à abertura, porque o processo foi
   lançado no portal depois de correr. */

export type EstadoEtapa = "concluida" | "atual" | "futura" | "interrompida";

export type Etapa = { nome: string; data: Date | null; estado: EstadoEtapa };

export type DadosEtapas = {
  status: Status;
  data_publicacao: Date | null;
  data_abertura: Date | null;
  data_homologacao: Date | null;
  /** Assinatura do primeiro contrato da licitação, se houver. */
  data_contrato: Date | null;
};

const NOMES = ["Publicação no PNCP", "Propostas", "Julgamento", "Homologação", "Contrato"];

/* Índice da etapa em curso para cada status que segue o fluxo normal. A
   homologada não tem etapa em curso conhecida: o contrato é a próxima, mas
   sem dado dele não dá para dizer que está acontecendo. */
const ATUAL: Partial<Record<Status, number>> = { aberta: 1, em_analise: 2, homologada: 4 };

export function etapas(d: DadosEtapas, agora: Date = new Date()): Etapa[] {
  const datas = [d.data_publicacao, d.data_abertura, null, d.data_homologacao, d.data_contrato];

  // Com contrato assinado, o processo chegou ao fim.
  const atual = d.status === "homologada" && d.data_contrato ? NOMES.length : ATUAL[d.status];
  if (atual !== undefined) {
    return NOMES.map((nome, i) => ({
      nome,
      data: datas[i],
      estado: i < atual ? "concluida" : i === atual && d.status !== "homologada" ? "atual" : "futura",
    }));
  }

  // Suspensa ou encerrada: só dá para afirmar o que as datas mostram que já
  // passou. Daí em diante o processo parou.
  const prazoPassou = d.data_abertura !== null && d.data_abertura <= agora;
  const concluidas = prazoPassou ? 2 : 1;
  return NOMES.map((nome, i) => ({
    nome,
    data: datas[i],
    estado: i < concluidas ? "concluida" : "interrompida",
  }));
}
