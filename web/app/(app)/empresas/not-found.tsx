import Link from "next/link";

/* A empresa só existe no banco se apareceu num resultado do PNCP. A consulta
   de CNPJ que buscaria e gravaria qualquer empresa é a fase 3. */

export default function EmpresaNaoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-12 sm:px-10">
      <h1 className="text-titulo-detalhe font-bold text-texto">Empresa não encontrada</h1>
      <p className="mt-3 text-texto-2">
        Este CNPJ não aparece em nenhum resultado de licitação de Criciúma publicado no PNCP. A
        consulta de qualquer CNPJ na Receita Federal ainda não está disponível no monitor.
      </p>
      <Link href="/empresas" className="mt-6 inline-block font-semibold text-primaria hover:text-primaria-hover">
        ← Buscar outra empresa
      </Link>
    </main>
  );
}
