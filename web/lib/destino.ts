/* Para onde mandar depois do login (?volta=). Só caminho interno: sem essa
   checagem, um link "/login?volta=https://golpe.com" usaria o site para
   redirecionar a pessoa para fora logo depois de ela digitar a senha. */
export function destinoSeguro(volta: unknown): string {
  if (typeof volta !== "string") return "/";
  // "//host" e "/\host" são tratados pelo navegador como endereço de outro site.
  if (!volta.startsWith("/") || volta.startsWith("//") || volta.startsWith("/\\")) return "/";
  if (volta === "/login" || volta.startsWith("/login?")) return "/";
  return volta;
}
