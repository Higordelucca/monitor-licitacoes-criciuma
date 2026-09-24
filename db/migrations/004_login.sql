-- Fase 5: login próprio, só convidados (ver CLAUDE.md, "Decisões das fases 5 e 6").
--
-- As contas são criadas pelo admin com web/scripts/usuario.mjs, que grava uma
-- senha temporária; por isso trocar_senha nasce verdadeiro.
--
-- O bloqueio por tentativas fica no banco porque o site roda em funções do
-- Netlify, que não compartilham memória entre requisições.

alter table usuarios
  add column ativo         boolean     not null default true,
  add column trocar_senha  boolean     not null default true,
  add column falhas_login  smallint    not null default 0,
  add column bloqueado_ate timestamptz;
