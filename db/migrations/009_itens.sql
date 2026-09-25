-- Itens de cada licitação e quem ficou registrado em cada um. O collector já
-- lia /itens e /resultados para somar os valores; agora grava. Decidido em
-- 2026-09-25 (CLAUDE.md, "Itens e contratos").

-- Valor unitário é numeric(15,4), e não (15,2) como o resto do dinheiro: o
-- PNCP publica preço unitário com mais casas (combustível a R$ 5,8923 o
-- litro). Total fica em (15,2). Situação e critério são texto livre do PNCP,
-- sem CHECK: servem para mostrar, não para filtrar.
create table itens (
  id                      bigint generated always as identity primary key,
  licitacao_id            bigint not null references licitacoes (id) on delete cascade,
  numero                  integer not null,
  descricao               text,
  tipo                    text,             -- M (material) ou S (serviço)
  quantidade              numeric(15, 4),
  unidade                 text,
  valor_unitario_estimado numeric(15, 4),
  valor_total_estimado    numeric(15, 2),
  sigiloso                boolean not null default false,
  situacao                text,
  criterio_julgamento     text,
  atualizado_em           timestamptz not null default now(),
  unique (licitacao_id, numero)
);

-- Um por fornecedor registrado no item. O vencedor é o de ordem 1 ou sem
-- ordem (fora do registro de preços). Pessoa física entra sem CPF e sem
-- nome — cnpj nulo —, para o item não parecer sem vencedor.
create table resultados_item (
  id                        bigint generated always as identity primary key,
  item_id                   bigint not null references itens (id) on delete cascade,
  cnpj                      char(14) references empresas (cnpj),
  tipo_pessoa               text,
  ordem                     integer,
  quantidade_homologada     numeric(15, 4),
  valor_unitario_homologado numeric(15, 4),
  valor_total_homologado    numeric(15, 2),
  data_resultado            date,
  situacao                  text,
  check (cnpj is not null or tipo_pessoa is distinct from 'PJ')
);

create index resultados_item_item_idx on resultados_item (item_id);
create index resultados_item_cnpj_idx on resultados_item (cnpj);
