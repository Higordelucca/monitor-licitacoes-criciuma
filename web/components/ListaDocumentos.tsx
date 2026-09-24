import { dataCurta, tituloDocumento } from "@/lib/format";

/* Documentos da licitação (PDF 3.2, item 7). O ícone diz DOC, não PDF: o PNCP
   não informa o formato do arquivo. O arquivo é baixado direto do
   PNCP — o site não guarda cópia. O tamanho que o PDF pede não aparece: o
   PNCP não informa, e a coluna tamanho_bytes está vazia. */

export type Documento = {
  id: string;
  tipo: string | null;
  titulo: string;
  url: string;
  data_publicacao: Date | null;
};

export function ListaDocumentos({ documentos }: { documentos: Documento[] }) {
  if (documentos.length === 0) {
    return <p className="text-legenda text-texto-suave">Nenhum documento publicado.</p>;
  }

  return (
    <ul className="divide-y divide-borda-leve">
      {documentos.map((d) => {
        const titulo = tituloDocumento(d.titulo, d.tipo);
        return (
          <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-controle bg-primaria-clara text-[0.625rem] font-bold text-primaria"
            >
              DOC
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-legenda font-semibold text-texto">{titulo}</p>
              <p className="text-legenda text-texto-suave">
                {d.tipo && d.tipo !== titulo ? `${d.tipo} · ` : ""}
                <span className="font-mono">{dataCurta(d.data_publicacao)}</span>
              </p>
            </div>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Baixar ${titulo}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-controle border border-borda text-texto-2 hover:border-primaria hover:text-primaria"
            >
              ↓
            </a>
          </li>
        );
      })}
    </ul>
  );
}
