-- O acesso é por nome de usuário e senha, não por e-mail (decisão do Higor em
-- 2026-09-23: "não vamos mexer com e-mail agora"). A tabela estava vazia quando
-- esta migration foi escrita.
--
-- O login é gravado já em minúsculas, então basta um índice único simples; o
-- CHECK impede espaço, acento e maiúscula, que confundiriam quem digita.

drop index usuarios_email_idx;

alter table usuarios rename column email to login;

alter table usuarios
  add constraint usuarios_login_formato check (login ~ '^[a-z0-9._-]{3,40}$'),
  add constraint usuarios_login_unico unique (login);
