-- Monitor de Licitações · Criciúma — esquema base.
--
-- Convenções:
--   CNPJ é char(14), só dígitos. A máscara 00.000.000/0000-00 é formatação
--   de tela e fica em lib/format.ts, nunca no banco.
--   Dinheiro é numeric(15,2), nunca float.
--   Data e hora são timestamptz — o PNCP devolve horário de Brasília e o
--   Neon roda em UTC.
--   Status e situação são texto com CHECK, não enum: os valores vêm do PNCP
--   e aparecem novos de tempos em tempos. Alterar um CHECK é uma migration
--   trivial; alterar um enum, não.

-- Licitações --------------------------------------------------------------

create table licitacoes (
  id                  bigint generated always as identity primary key,
  -- numero_controle_pncp, ex.: '82916818000113-1-000194/2026'
  id_pncp             text        not null unique,
  numero              text,
  ano                 smallint,
  modalidade          text,
  objeto              text        not null,
  secretaria          text,
  processo            text,
  criterio_julgamento text,
  modo_disputa        text,
  data_publicacao     timestamptz,
  data_abertura       timestamptz,
  -- Não está no modelo do PDF, mas sem ela o KPI 'homologadas no mês
  -- corrente' não tem como ser calculado.
  data_homologacao    timestamptz,
  valor_estimado      numeric(15, 2),
  valor_homologado    numeric(15, 2),
  status              text        not null default 'aberta'
    check (status in ('aberta', 'em_analise', 'homologada', 'suspensa', 'encerrada')),
  url_pncp            text,
  atualizado_em       timestamptz not null default now()
);

create index licitacoes_status_idx        on licitacoes (status);
create index licitacoes_data_abertura_idx on licitacoes (data_abertura);
create index licitacoes_atualizado_idx    on licitacoes (atualizado_em desc);
-- Busca global por objeto (componente 1.3 do wireframe).
create index licitacoes_objeto_busca_idx
  on licitacoes using gin (to_tsvector('portuguese', objeto));

-- Empresas ----------------------------------------------------------------

create table empresas (
  cnpj               char(14) primary key check (cnpj ~ '^[0-9]{14}$'),
  razao_social       text not null,
  nome_fantasia      text,
  porte              text,
  situacao_cadastral text,
  data_abertura      date,
  cnae_principal     text,
  municipio          text,
  uf                 char(2),
  capital_social     numeric(15, 2),
  -- Nulo enquanto a empresa é só um esqueleto vindo da lista de
  -- participantes; preenchido quando a API de CNPJ responde.
  atualizado_em      timestamptz
);

create index empresas_razao_social_idx on empresas (lower(razao_social));

-- Participantes -----------------------------------------------------------
-- O collector precisa inserir a empresa antes do participante, nem que seja
-- só cnpj + razao_social. O enriquecimento vem depois, na fase 3.

create table participantes (
  id             bigint generated always as identity primary key,
  licitacao_id   bigint   not null references licitacoes (id) on delete cascade,
  cnpj           char(14) not null references empresas (cnpj),
  valor_proposta numeric(15, 2),
  situacao       text
    check (situacao in ('vencedora', 'habilitada', 'em_analise', 'inabilitada')),
  unique (licitacao_id, cnpj)
);

create index participantes_cnpj_idx on participantes (cnpj);

-- Documentos --------------------------------------------------------------

create table documentos (
  id              bigint generated always as identity primary key,
  licitacao_id    bigint not null references licitacoes (id) on delete cascade,
  tipo            text,
  titulo          text   not null,
  url             text   not null,
  tamanho_bytes   bigint,
  data_publicacao timestamptz,
  -- A URL do PNCP é o que identifica o arquivo entre duas coletas.
  unique (licitacao_id, url)
);

create index documentos_licitacao_idx on documentos (licitacao_id);

-- Eventos -----------------------------------------------------------------
-- Alimenta a linha do tempo (bloco 8 do detalhe) e o feed do painel.

create table eventos (
  id           bigint generated always as identity primary key,
  licitacao_id bigint      not null references licitacoes (id) on delete cascade,
  tipo         text        not null,
  descricao    text,
  data         timestamptz not null default now(),
  fonte        text
);

create index eventos_licitacao_idx on eventos (licitacao_id, data desc);
create index eventos_feed_idx      on eventos (data desc);

-- Contratos ---------------------------------------------------------------
-- licitacao_id aceita nulo: contrato antigo pode vir do Portal da
-- Transparência sem licitação correspondente no PNCP.

create table contratos (
  id              bigint generated always as identity primary key,
  licitacao_id    bigint   references licitacoes (id) on delete set null,
  cnpj            char(14) not null references empresas (cnpj),
  numero          text,
  objeto          text,
  valor           numeric(15, 2),
  vigencia_inicio date,
  vigencia_fim    date
);

create index contratos_cnpj_idx     on contratos (cnpj);
create index contratos_vigencia_idx on contratos (vigencia_fim);

-- Sócios (QSA) ------------------------------------------------------------

create table socios (
  id          bigint generated always as identity primary key,
  cnpj        char(14) not null references empresas (cnpj) on delete cascade,
  nome        text     not null,
  qualificacao text,
  unique (cnpj, nome, qualificacao)
);

-- Sanções -----------------------------------------------------------------

create table sancoes (
  id           bigint generated always as identity primary key,
  cnpj         char(14)    not null references empresas (cnpj) on delete cascade,
  cadastro     text        not null check (cadastro in ('CEIS', 'CNEP', 'CEPIM')),
  descricao    text,
  data_inicio  date,
  data_fim     date,
  verificado_em timestamptz not null default now()
);

create index sancoes_cnpj_idx on sancoes (cnpj);

-- Usuários ----------------------------------------------------------------
-- Substitui auth.users do Supabase. Senha com hash argon2 (fase 5).

create table usuarios (
  id         bigint generated always as identity primary key,
  email      text        not null,
  senha_hash text        not null,
  papel      text        not null default 'leitor' check (papel in ('admin', 'leitor')),
  criado_em  timestamptz not null default now()
);

-- Login não diferencia maiúscula de minúscula.
create unique index usuarios_email_idx on usuarios (lower(email));

-- Seguir, preferências e alertas ------------------------------------------

create table seguindo (
  user_id      bigint      not null references usuarios (id) on delete cascade,
  licitacao_id bigint      not null references licitacoes (id) on delete cascade,
  criado_em    timestamptz not null default now(),
  primary key (user_id, licitacao_id)
);

create index seguindo_licitacao_idx on seguindo (licitacao_id);

create table preferencias_alerta (
  user_id bigint  not null references usuarios (id) on delete cascade,
  tipo    text    not null
    check (tipo in ('nova_licitacao', 'documento_novo', 'mudanca_status', 'empresa_sancionada')),
  ativo   boolean not null default true,
  primary key (user_id, tipo)
);

create table alertas (
  id           bigint      generated always as identity primary key,
  user_id      bigint      not null references usuarios (id) on delete cascade,
  licitacao_id bigint      references licitacoes (id) on delete cascade,
  tipo         text        not null,
  titulo       text        not null,
  texto        text,
  lido         boolean     not null default false,
  criado_em    timestamptz not null default now()
);

create index alertas_usuario_idx    on alertas (user_id, criado_em desc);
-- Ponto vermelho no sino: conta só os não lidos.
create index alertas_nao_lidos_idx  on alertas (user_id) where not lido;

-- Log de sincronização ----------------------------------------------------
-- Alimenta o indicador 'Sincronizado há X min' e o card 'Fontes de dados'.

create table sync_log (
  id              bigint      generated always as identity primary key,
  fonte           text        not null,
  iniciado_em     timestamptz not null default now(),
  finalizado_em   timestamptz,
  status          text        not null default 'rodando'
    check (status in ('rodando', 'ok', 'erro', 'parcial')),
  registros_novos integer     not null default 0,
  erro            text
);

create index sync_log_fonte_idx on sync_log (fonte, iniciado_em desc);
