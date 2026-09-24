-- Fase 3: cadastro da empresa pela BrasilAPI e sanções pelos arquivos diários
-- do Portal da Transparência (CEIS, CNEP, CEPIM). Levantado em 2026-09-24.

-- Entrada do sócio na sociedade, que o QSA da Receita informa. O CPF do sócio
-- vem mascarado e não é guardado: não serve para nada na tela.
alter table socios add column data_entrada date;

-- As sanções eram só cadastro + descrição + datas. O arquivo do Portal traz o
-- que é preciso para não acusar a empresa à toa: quem aplicou a sanção e a
-- abrangência dela. Um impedimento aplicado por outra prefeitura, "no órgão
-- sancionador", não impede a empresa de contratar com Criciúma.
alter table sancoes
  add column chave             text,
  add column categoria         text,
  add column orgao_sancionador text,
  add column abrangencia       text,
  add column processo          text;

-- `chave` identifica a sanção dentro do cadastro, para a coleta diária
-- atualizar em vez de duplicar e apagar o que saiu da lista: o código da
-- sanção no CEIS e no CNEP; CNPJ + número do convênio no CEPIM, que não tem
-- código. A tabela estava vazia quando esta migration foi escrita.
alter table sancoes alter column chave set not null;
alter table sancoes add constraint sancoes_cadastro_chave_key unique (cadastro, chave);
