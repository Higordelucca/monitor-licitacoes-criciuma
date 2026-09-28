-- A abertura é a sessão pública, no fim do prazo de propostas. Até
-- 2026-09-28 o collector gravava em data_abertura o início desse prazo
-- (data_inicio_vigencia da busca do PNCP), e o Painel mostrava como abertura
-- uma data já passada com as propostas ainda correndo.
--
-- O início ganha coluna própria. O valor que estava em data_abertura é
-- justamente ele, então é copiado para cá. data_abertura fica como está até a
-- próxima rodada da coleta, que grava o fim do prazo nas 1.018 licitações.

alter table licitacoes add column data_inicio_propostas timestamptz;

update licitacoes set data_inicio_propostas = data_abertura;
