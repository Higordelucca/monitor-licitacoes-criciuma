-- Fase 6: seguir licitação ou empresa e receber aviso de novidade (ver
-- CLAUDE.md, "Decisões das fases 5 e 6").
--
-- Os avisos nascem aqui, em triggers, e não no collector: qualquer um que
-- escreva no banco (collector, enriquecimento da fase 3, script manual) gera
-- aviso do mesmo jeito. A tabela `alertas` é a fonte única — o sino do site
-- lê dela hoje, e o app que vier depois lê dela também.
--
-- Três gatilhos, e só esses: documento novo, mudança de status, empresa
-- seguida venceu. O log de `eventos` não gera aviso — é ruído de manutenção.

create table seguindo_empresas (
  user_id   bigint      not null references usuarios (id) on delete cascade,
  cnpj      char(14)    not null references empresas (cnpj) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (user_id, cnpj)
);
create index seguindo_empresas_cnpj_idx on seguindo_empresas (cnpj);

alter table alertas
  add column cnpj       char(14) references empresas (cnpj) on delete cascade,
  add column quantidade integer  not null default 1,
  add constraint alertas_tipo check (tipo in ('documento_novo', 'mudanca_status', 'empresa_venceu'));

-- Sem avalanche: enquanto a pessoa não leu, novidade do mesmo tipo sobre o
-- mesmo alvo soma na quantidade em vez de virar outro aviso. Uma coleta que
-- traz 40 documentos de uma licitação vira "40 documentos novos", não 40 avisos.
create unique index alertas_acumula_idx
  on alertas (user_id, tipo, coalesce(licitacao_id, 0), coalesce(cnpj, ''))
  where not lido;

-- Número como a tela mostra: processo/ano (licitacoes.numero é sempre nulo).
create function numero_licitacao(processo text, ano smallint) returns text
language sql immutable as $$
  select coalesce(processo || '/' || ano, processo, 'sem número')
$$;

create function rotulo_status(status text) returns text
language sql immutable as $$
  select case status
    when 'aberta'     then 'Aberta'
    when 'em_analise' then 'Em análise'
    when 'homologada' then 'Homologada'
    when 'suspensa'   then 'Suspensa'
    when 'encerrada'  then 'Encerrada'
    else status
  end
$$;

-- 1. Documento novo numa licitação seguida.
-- O collector grava documentos com `on conflict do nothing`: documento que já
-- existia não é inserido de novo e não dispara nada.
create function alerta_documento_novo() returns trigger
language plpgsql as $$
begin
  insert into alertas (user_id, tipo, licitacao_id, titulo, texto)
  select s.user_id, 'documento_novo', new.licitacao_id,
         'Documento novo em ' || numero_licitacao(l.processo, l.ano),
         -- Parte dos títulos do PNCP é um hash; aí o tipo diz mais.
         case when new.titulo ~ '^[0-9a-f]{32}$' then coalesce(new.tipo, 'Documento') else new.titulo end
    from seguindo s
    join licitacoes l on l.id = s.licitacao_id
   where s.licitacao_id = new.licitacao_id
  on conflict (user_id, tipo, coalesce(licitacao_id, 0), coalesce(cnpj, '')) where not lido
  do update set quantidade = alertas.quantidade + 1,
                texto      = excluded.texto,
                criado_em  = now();
  return null;
end
$$;

create trigger documentos_alerta
  after insert on documentos
  for each row execute function alerta_documento_novo();

-- 2. Mudança de status numa licitação seguida.
-- O upsert do collector reescreve o status a cada rodada; o WHEN deixa passar
-- só a mudança de fato.
create function alerta_mudanca_status() returns trigger
language plpgsql as $$
begin
  insert into alertas (user_id, tipo, licitacao_id, titulo, texto)
  select s.user_id, 'mudanca_status', new.id,
         'Status mudou em ' || numero_licitacao(new.processo, new.ano),
         rotulo_status(old.status) || ' → ' || rotulo_status(new.status)
    from seguindo s
   where s.licitacao_id = new.id
  on conflict (user_id, tipo, coalesce(licitacao_id, 0), coalesce(cnpj, '')) where not lido
  do update set quantidade = alertas.quantidade + 1,
                -- Duas mudanças antes da leitura: vale a de agora.
                texto      = excluded.texto,
                criado_em  = now();
  return null;
end
$$;

create trigger licitacoes_alerta_status
  after update of status on licitacoes
  for each row
  when (old.status is distinct from new.status)
  execute function alerta_mudanca_status();

-- 3. Empresa seguida virou vencedora em alguma licitação.
create function alerta_empresa_venceu() returns trigger
language plpgsql as $$
begin
  insert into alertas (user_id, tipo, licitacao_id, cnpj, titulo, texto)
  select s.user_id, 'empresa_venceu', new.licitacao_id, new.cnpj,
         e.razao_social || ' venceu em ' || numero_licitacao(l.processo, l.ano),
         left(l.objeto, 200)
    from seguindo_empresas s
    join empresas e on e.cnpj = s.cnpj
    join licitacoes l on l.id = new.licitacao_id
   where s.cnpj = new.cnpj
  on conflict (user_id, tipo, coalesce(licitacao_id, 0), coalesce(cnpj, '')) where not lido
  do nothing;
  return null;
end
$$;

create trigger participantes_alerta_insert
  after insert on participantes
  for each row
  when (new.situacao = 'vencedora')
  execute function alerta_empresa_venceu();

-- O upsert de participantes também reescreve a situação a cada rodada.
create trigger participantes_alerta_update
  after update of situacao on participantes
  for each row
  when (new.situacao = 'vencedora' and old.situacao is distinct from new.situacao)
  execute function alerta_empresa_venceu();
