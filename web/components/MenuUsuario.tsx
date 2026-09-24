import Link from "next/link";
import { sair } from "@/app/(app)/acoes";

/* Menu do usuário (PDF 1.4): iniciais, trocar senha e sair. <details> abre e
   fecha sem JavaScript; "Sair" é um formulário que chama a Server Action. */

function iniciais(login: string): string {
  const partes = login.split(/[._-]+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : login.slice(0, 2);
  return letras.toUpperCase();
}

export function MenuUsuario({ login }: { login: string }) {
  return (
    <details className="relative">
      <summary
        aria-label={`Conta de ${login}`}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-pilula bg-primaria-clara text-legenda font-bold text-primaria hover:bg-primaria hover:text-superficie [&::-webkit-details-marker]:hidden"
      >
        {iniciais(login)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-card border border-borda bg-superficie p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-legenda text-texto-suave">{login}</p>
        <Link href="/conta/senha" className="block rounded-controle px-3 py-2 text-texto-2 hover:bg-borda-leve">
          Trocar senha
        </Link>
        <form action={sair}>
          <button type="submit" className="w-full rounded-controle px-3 py-2 text-left text-texto-2 hover:bg-borda-leve">
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
