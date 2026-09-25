-- Contratos do PNCP e o aviso "contrato assinado". Decidido em 2026-09-25
-- (CLAUDE.md, "Itens e contratos"). A tabela existia desde a 001 e nunca
-- recebeu linha: as colunas mudam sem migrar dado.

alter table contratos rename column valor to valor_global;

alter table contratos
  add column id_pncp         text,
  add column tipo            text,        -- "Contrato (termo inicial)", "Empenho"...
  add column data_assinatura date,
  add column data_publicacao timestamptz,
  add column valor_inicial   numeric(15, 2),
  add column url_pncp        text,
  add column url_documento   text,
  add column atualizado_em   timestamptz not null default now();

-- Chave do upsert: o numeroControlePNCP do contrato.
alter table contratos alter column id_pncp set not null;
alter table contratos add constraint contratos_id_pncp_key unique (id_pncp);

create index contratos_licitacao_idx on contratos (licitacao_id);

-- 4. Contrato assinado numa licitação seguida ou com uma empresa seguida.
alter table alertas drop constraint alertas_tipo;
alter table alertas add constraint alertas_tipo
  check (tipo in ('documento_novo', 'mudanca_status', 'empresa_venceu', 'contrato'));

-- Só contrato publicado no PNCP nos últimos 7 dias avisa. A primeira carga
-- traz uns 300 contratos antigos de uma vez, e nenhum deles é novidade. Quem
-- segue a licitação e a empresa recebe um aviso só (o distinct).
create function alerta_contrato() returns trigger
language plpgsql as $$
begin
  if new.data_publicacao is null or new.data_publicacao < now() - interval '7 days' then
    return null;
  end if;
  insert into alertas (user_id, tipo, licitacao_id, cnpj, titulo, texto)
  select distinct s.user_id, 'contrato', new.licitacao_id, new.cnpj,
         'Contrato ' || coalesce(new.numero || ' ', '') || 'assinado com ' || e.razao_social,
         left(new.objeto, 200)
    from (
      select user_id from seguindo where licitacao_id = new.licitacao_id
      union
      select user_id from seguindo_empresas where cnpj = new.cnpj
    ) s
    join empresas e on e.cnpj = new.cnpj
  on conflict (user_id, tipo, coalesce(licitacao_id, 0), coalesce(cnpj, '')) where not lido
  do update set quantidade = alertas.quantidade + 1,
                titulo     = excluded.titulo,
                texto      = excluded.texto,
                criado_em  = now();
  return null;
end
$$;

create trigger contratos_alerta
  after insert on contratos
  for each row execute function alerta_contrato();
