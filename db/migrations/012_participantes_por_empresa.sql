-- `participantes` era gravado item a item, e o upsert por (licitação, CNPJ)
-- deixava valer o último item lido. Em 2026-09-30 isso dava 604 vencedoras
-- com o valor de um item só e 40 empresas que venceram algum item gravadas
-- como habilitada. Além disso a ordem nula (fora do registro de preços)
-- virava habilitada, o que deixava 28 licitações homologadas sem vencedora.
--
-- O collector agora agrupa por empresa (mapeamento.participantes). Aqui se
-- recalcula o que já está gravado a partir de `resultados_item`, que guarda
-- o dado por item e já usava a regra certa: vence a ordem 1 ou nula.
--
-- Os avisos de "empresa venceu" ficam desligados durante a correção: são
-- vitórias antigas, não novidade para quem segue a empresa.

alter table participantes disable trigger participantes_alerta_update;

with por_empresa as (
  select i.licitacao_id,
         r.cnpj,
         bool_or(coalesce(r.ordem, 1) = 1) as venceu,
         sum(r.valor_total_homologado) filter (where coalesce(r.ordem, 1) = 1) as soma_vencida,
         sum(r.valor_total_homologado) as soma_total
    from resultados_item r
    join itens i on i.id = r.item_id
   where r.cnpj is not null
   group by i.licitacao_id, r.cnpj
)
update participantes p
   set situacao       = case when e.venceu then 'vencedora' else 'habilitada' end,
       valor_proposta = case when e.venceu then e.soma_vencida else e.soma_total end
  from por_empresa e
 where e.licitacao_id = p.licitacao_id
   and e.cnpj = p.cnpj;

alter table participantes enable trigger participantes_alerta_update;
