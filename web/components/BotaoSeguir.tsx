import { alternarSeguirEmpresa, alternarSeguirLicitacao } from "@/app/(app)/acoes";

/* Botão Seguir (PDF 3.2, item 3.4), para licitação e — pedido do Higor —
   para empresa. É um formulário com Server Action: funciona sem JavaScript.
   Clicar em "Seguindo" deixa de seguir. */

type Props =
  | { tipo: "licitacao"; id: string; seguindo: boolean }
  | { tipo: "empresa"; cnpj: string; seguindo: boolean };

export function BotaoSeguir(props: Props) {
  const acao = props.tipo === "licitacao" ? alternarSeguirLicitacao : alternarSeguirEmpresa;
  const oque = props.tipo === "licitacao" ? "licitação" : "empresa";

  return (
    <form action={acao}>
      {props.tipo === "licitacao" ? (
        <input type="hidden" name="id" value={props.id} />
      ) : (
        <input type="hidden" name="cnpj" value={props.cnpj} />
      )}
      <button
        type="submit"
        aria-pressed={props.seguindo}
        title={props.seguindo ? `Clique para deixar de seguir esta ${oque}` : undefined}
        className={`inline-flex h-botao items-center gap-2 rounded-controle px-4 font-semibold whitespace-nowrap ${
          props.seguindo
            ? "border border-primaria bg-primaria-clara text-primaria hover:bg-superficie"
            : "bg-primaria text-superficie hover:bg-primaria-hover"
        }`}
      >
        {props.seguindo ? `✓ Seguindo` : `Seguir ${oque}`}
      </button>
    </form>
  );
}
