/* Textos explicativos para o público. ÚNICO lugar onde eles moram: o balão ⓘ
   (components/Termo.tsx) e a página /entenda leem daqui.

   RASCUNHO: redigido pelo Claude a partir da Lei 14.133/2021 e ainda não
   revisado por alguém da área jurídica. `baseLegal` só aparece onde o artigo
   foi conferido; na dúvida, fica sem.

   Os status NÃO são termos da lei. São as pílulas deste site, derivadas em
   collector/mapeamento.py (status_licitacao), e o texto explica exatamente a
   regra usada lá, para ninguém ler "homologada" com mais certeza do que o
   dado permite. */

export type Grupo = "status" | "modalidade" | "etapa" | "campo";

export type Entrada = {
  termo: string;
  grupo: Grupo;
  /** 1–2 frases, cabe no balão. */
  curto: string;
  /** Parágrafos da página /entenda. */
  longo: string[];
  baseLegal?: string;
};

export const GRUPOS: { id: Grupo; titulo: string; intro: string }[] = [
  {
    id: "status",
    titulo: "Situação da licitação",
    intro:
      "A etiqueta colorida ao lado de cada licitação resume em que ponto ela está. " +
      "O PNCP não publica essa situação pronta: o monitor a deduz do prazo de propostas, " +
      "da existência de resultado e dos avisos de revogação, anulação ou suspensão.",
  },
  {
    id: "modalidade",
    titulo: "Tipos de contratação",
    intro:
      "A lei prevê cinco modalidades de licitação: pregão, concorrência, concurso, leilão e " +
      "diálogo competitivo. O PNCP lista na mesma coluna outras formas de contratar, como " +
      "dispensa, inexigibilidade e credenciamento. Tecnicamente elas não são modalidades, " +
      "e a explicação de cada uma diz o que ela é de fato.",
  },
  {
    id: "etapa",
    titulo: "Etapas do processo",
    intro:
      "Uma licitação segue uma ordem definida em lei. Nem toda contratação passa por todas " +
      "as etapas: a contratação direta, por exemplo, não tem disputa entre empresas.",
  },
  {
    id: "campo",
    titulo: "Outros termos",
    intro: "Palavras que aparecem nas telas do monitor.",
  },
];

export const GLOSSARIO = {
  /* ── Status ─────────────────────────────────────────────────────────── */
  aberta: {
    termo: "Aberta",
    grupo: "status",
    curto: "O prazo para as empresas enviarem propostas ainda está correndo.",
    longo: [
      "A licitação foi publicada e o prazo para receber propostas ainda não terminou. " +
        "É a fase em que empresas interessadas podem participar.",
      "O monitor marca como aberta enquanto a data final de recebimento de propostas, " +
        "informada no PNCP, estiver no futuro.",
    ],
  },
  em_analise: {
    termo: "Em análise",
    grupo: "status",
    curto:
      "O prazo de propostas terminou, mas ainda não há resultado publicado no PNCP.",
    longo: [
      "As propostas já foram recebidas e a prefeitura está julgando: compara preços, " +
        "confere os documentos das empresas e analisa eventuais recursos.",
      "O monitor marca como em análise quando o prazo de propostas passou e nenhum item " +
        "da licitação tem resultado publicado no PNCP.",
    ],
  },
  homologada: {
    termo: "Homologada",
    grupo: "status",
    curto:
      "Há resultado publicado: a prefeitura confirmou quem venceu. O passo seguinte é assinar o contrato.",
    longo: [
      "Homologar é o ato em que a autoridade responsável confirma que o processo foi " +
        "regular e aprova o resultado. Depois da homologação, a empresa vencedora é " +
        "chamada para assinar o contrato.",
      "O monitor marca como homologada quando pelo menos um item da licitação tem " +
        "resultado publicado no PNCP. Numa licitação com muitos itens, alguns podem " +
        "estar homologados e outros não.",
      "O PNCP não informa a data exata da homologação. O monitor usa a data do " +
        "resultado mais recente como aproximação.",
    ],
    baseLegal: "Lei 14.133/2021, art. 71, IV",
  },
  suspensa: {
    termo: "Suspensa",
    grupo: "status",
    curto:
      "O processo está parado temporariamente e pode ser retomado. Enquanto isso, nada avança.",
    longo: [
      "Uma licitação pode ser suspensa pela própria prefeitura, por exemplo para corrigir " +
        "o edital depois de um questionamento, ou por ordem de um tribunal de contas.",
      "A suspensão não é o fim. Quando o motivo é resolvido, o processo volta a correr, " +
        "muitas vezes com prazos novos.",
    ],
  },
  encerrada: {
    termo: "Encerrada",
    grupo: "status",
    curto: "A licitação foi revogada ou anulada e não vai gerar contrato.",
    longo: [
      "Revogar é desistir da licitação por conveniência, quando ela deixou de fazer " +
        "sentido para a administração. Anular é desfazê-la porque houve uma ilegalidade " +
        "que não tem conserto.",
      "Nos dois casos o processo termina sem contrato. Se a necessidade continuar, a " +
        "prefeitura precisa abrir uma licitação nova.",
    ],
    baseLegal: "Lei 14.133/2021, art. 71, II e III",
  },

  /* ── Modalidades e formas de contratação ────────────────────────────── */
  pregao: {
    termo: "Pregão",
    grupo: "modalidade",
    curto:
      "Disputa de preço para bens e serviços comuns. Vence quem oferece o menor preço ou o maior desconto.",
    longo: [
      "É a modalidade mais usada. Serve para comprar o que tem padrão de qualidade fácil " +
        "de descrever no edital: material de escritório, merenda, combustível, serviços " +
        "de limpeza.",
      "As empresas dão lances, e o critério é sempre o menor preço ou o maior desconto.",
    ],
    baseLegal: "Lei 14.133/2021, art. 6º, XLI",
  },
  concorrencia: {
    termo: "Concorrência",
    grupo: "modalidade",
    curto:
      "Modalidade para obras, serviços de engenharia e compras mais complexas. Pode levar em conta técnica, não só preço.",
    longo: [
      "Usada para obras, serviços de engenharia e bens e serviços especiais, aqueles que " +
        "não dá para descrever só com especificação padrão.",
      "Além do menor preço, a concorrência admite outros critérios, como técnica e preço " +
        "ou melhor técnica.",
    ],
    baseLegal: "Lei 14.133/2021, art. 6º, XXXVIII",
  },
  leilao: {
    termo: "Leilão",
    grupo: "modalidade",
    curto: "A prefeitura vende bens que não usa mais. Vence quem oferece o maior lance.",
    longo: [
      "No leilão a lógica se inverte: a prefeitura não compra, vende. São imóveis ou bens " +
        "móveis que não servem mais, como veículos antigos, ou bens apreendidos.",
    ],
    baseLegal: "Lei 14.133/2021, art. 6º, XL",
  },
  dispensa: {
    termo: "Dispensa",
    grupo: "modalidade",
    curto:
      "Contratação direta, sem licitação, nos casos que a lei permite, como compras de valor baixo ou emergências.",
    longo: [
      "Dispensa não é uma modalidade de licitação. É uma contratação direta: a lei " +
        "autoriza a prefeitura a contratar sem licitar em situações específicas.",
      "Os casos mais comuns são compras e serviços de valor baixo, dentro do limite " +
        "fixado em lei, e situações de emergência.",
      "Mesmo sem licitação, a contratação precisa ser justificada e publicada.",
    ],
    baseLegal: "Lei 14.133/2021, arts. 72 e 75",
  },
  inexigibilidade: {
    termo: "Inexigibilidade",
    grupo: "modalidade",
    curto:
      "Contratação direta quando não existe competição possível, como um fornecedor exclusivo.",
    longo: [
      "Também é contratação direta, sem licitação. A diferença para a dispensa é o motivo: " +
        "na inexigibilidade, a disputa é impossível.",
      "Exemplos: um produto que só um fornecedor vende, a apresentação de um artista " +
        "consagrado ou um serviço técnico de notória especialização.",
    ],
    baseLegal: "Lei 14.133/2021, arts. 72 e 74",
  },
  credenciamento: {
    termo: "Credenciamento",
    grupo: "modalidade",
    curto:
      "Cadastro aberto: todas as empresas que cumprem as condições podem ser contratadas, sem disputa entre elas.",
    longo: [
      "O credenciamento não escolhe um vencedor. A prefeitura publica as condições e " +
        "cadastra todos os interessados que as cumprem.",
      "É usado quando faz sentido ter vários prestadores ao mesmo tempo, por exemplo " +
        "clínicas que atendem pelo município a preço fixado.",
      "Pela lei é um procedimento auxiliar, não uma modalidade. A contratação que sai " +
        "dele é feita por inexigibilidade.",
    ],
    baseLegal: "Lei 14.133/2021, art. 6º, XLIII, e arts. 74, IV, e 79",
  },
  forma: {
    termo: "Eletrônico ou presencial",
    grupo: "modalidade",
    curto:
      "Diz se a disputa acontece pela internet ou em sessão física. A regra é ser eletrônica.",
    longo: [
      "A lei manda que a licitação seja feita preferencialmente na forma eletrônica, pela " +
        "internet. A forma presencial é exceção e precisa de justificativa.",
      "Quando é presencial, a sessão pública deve ser gravada em áudio e vídeo.",
    ],
    baseLegal: "Lei 14.133/2021, art. 17, § 2º",
  },

  /* ── Etapas ─────────────────────────────────────────────────────────── */
  etapas: {
    termo: "Etapas da licitação",
    grupo: "etapa",
    curto:
      "Preparação, publicação do edital, propostas, julgamento, habilitação, recursos e homologação.",
    longo: [
      "1. Preparação: a prefeitura define o que precisa, pesquisa preços e escreve o edital.",
      "2. Publicação do edital: o edital sai no PNCP e abre o prazo para as empresas.",
      "3. Propostas e lances: as empresas enviam preços e, no pregão, disputam com lances.",
      "4. Julgamento: a prefeitura classifica as propostas pelo critério do edital.",
      "5. Habilitação: confere se a empresa mais bem colocada tem os documentos exigidos.",
      "6. Recursos: quem discordar do resultado pode recorrer.",
      "7. Homologação: a autoridade confirma o resultado. Depois vem o contrato.",
    ],
    baseLegal: "Lei 14.133/2021, art. 17",
  },

  /* ── Outros termos ──────────────────────────────────────────────────── */
  pncp: {
    termo: "PNCP",
    grupo: "campo",
    curto:
      "Portal Nacional de Contratações Públicas: o site oficial onde os órgãos públicos publicam suas licitações e contratos.",
    longo: [
      "Desde a Lei 14.133, todo órgão público do país publica editais, resultados e " +
        "contratos no PNCP.",
      "O monitor lê os dados públicos do PNCP de forma automática, a cada 30 minutos, e " +
        "os organiza para Criciúma.",
    ],
    baseLegal: "Lei 14.133/2021, art. 174",
  },
  valor_estimado: {
    termo: "Valor estimado",
    grupo: "campo",
    curto:
      "Quanto a prefeitura calcula que vai gastar, antes da disputa. Não é o valor pago.",
    longo: [
      "É a soma do valor previsto para cada item do edital, a partir da pesquisa de preços.",
      "Quando aparece “—”, o valor não foi informado ou é sigiloso. A lei permite manter " +
        "o orçamento em sigilo até o fim da disputa, para não influenciar os lances.",
    ],
    baseLegal: "Lei 14.133/2021, art. 24",
  },
  valor_homologado: {
    termo: "Valor homologado",
    grupo: "campo",
    curto: "Quanto custou de fato, pelo preço das empresas vencedoras.",
    longo: [
      "É a soma do valor dos itens com resultado. A diferença entre o valor estimado e o " +
        "homologado mostra quanto a disputa economizou.",
    ],
  },
  criterio_julgamento: {
    termo: "Critério de julgamento",
    grupo: "campo",
    curto:
      "A regra que decide quem vence: menor preço, maior desconto, melhor técnica, técnica e preço, entre outras.",
    longo: [
      "O edital informa o critério antes da disputa. No pregão é sempre menor preço ou " +
        "maior desconto. Na concorrência pode entrar a qualidade técnica.",
    ],
    baseLegal: "Lei 14.133/2021, art. 33",
  },
  modo_disputa: {
    termo: "Modo de disputa",
    grupo: "campo",
    curto:
      "Aberto: as empresas veem os lances umas das outras e podem cobri-los. Fechado: cada uma entrega uma proposta sigilosa.",
    longo: [
      "No modo aberto, os lances são públicos durante a sessão e as empresas podem " +
        "baixar o preço para cobrir as concorrentes. No modo fechado, as propostas " +
        "ficam em sigilo até a abertura.",
      "O edital também pode combinar os dois.",
    ],
    baseLegal: "Lei 14.133/2021, art. 56",
  },
  porte: {
    termo: "Porte da empresa",
    grupo: "campo",
    curto:
      "ME é microempresa e EPP é empresa de pequeno porte, pela receita bruta anual. \"Demais\" são as maiores.",
    longo: [
      "Microempresa (ME) fatura até R$ 360 mil por ano. Empresa de pequeno porte (EPP) " +
        "fatura acima disso e até R$ 4,8 milhões.",
      "Nas licitações, ME e EPP têm tratamento diferenciado: em caso de empate, por " +
        "exemplo, têm preferência na contratação.",
      "O porte vem do PNCP, informado no resultado da licitação.",
    ],
    baseLegal: "Lei Complementar 123/2006, arts. 3º e 44",
  },
  vencedora: {
    termo: "Vencedora",
    grupo: "campo",
    curto: "Empresa que ganhou pelo menos um item da licitação.",
    longo: [
      "Uma licitação pode ser dividida em itens ou lotes, e cada um tem seu vencedor. " +
        "Por isso uma mesma licitação pode ter várias empresas vencedoras.",
    ],
  },
  habilitada: {
    termo: "Habilitada",
    grupo: "campo",
    curto:
      "No monitor, é a empresa classificada logo atrás da vencedora num registro de preços. Pode ser chamada se a vencedora não fornecer.",
    longo: [
      "No registro de preços, a prefeitura não compra tudo de uma vez: registra os preços " +
        "e compra conforme precisa, durante a validade da ata. Além da vencedora, outras " +
        "empresas podem ficar registradas em ordem de classificação.",
      "O PNCP informa essa ordem. O monitor chama de habilitada a empresa que não ficou " +
        "em primeiro lugar. Na maioria desses casos o PNCP não informa valor, e a tela " +
        "mostra “—”.",
    ],
  },
} satisfies Record<string, Entrada>;

export type ChaveGlossario = keyof typeof GLOSSARIO;

/* De licitacoes.modalidade (texto do PNCP) para a entrada do glossário. A
   forma — "Eletrônico" ou "Presencial" — fica no nome e tem entrada própria. */
const POR_MODALIDADE: [prefixo: string, chave: ChaveGlossario][] = [
  ["Pregão", "pregao"],
  ["Concorrência", "concorrencia"],
  ["Leilão", "leilao"],
  ["Dispensa", "dispensa"],
  ["Inexigibilidade", "inexigibilidade"],
  ["Credenciamento", "credenciamento"],
];

export function chaveModalidade(nome: string | null | undefined): ChaveGlossario | undefined {
  if (!nome) return undefined;
  return POR_MODALIDADE.find(([prefixo]) => nome.startsWith(prefixo))?.[1];
}
