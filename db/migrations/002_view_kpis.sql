-- Os quatro cards de indicadores do painel (blocos 5.1 a 5.4 do wireframe)
-- e os dois do topo da tela mobile.
--
-- View comum, não materializada: são quatro agregados sobre uma tabela que
-- deve ficar na casa dos milhares de linhas. Se um dia pesar, vira
-- materialized view com refresh ao fim de cada coleta.

create view vw_kpis_painel as
select
  count(*) filter (where status = 'aberta')                     as abertas,
  count(*) filter (where status = 'em_analise')                 as em_analise,
  count(*) filter (
    where date_trunc('month', data_homologacao) = date_trunc('month', now())
  )                                                             as homologadas_mes,
  coalesce(sum(valor_estimado) filter (where status = 'aberta'), 0) as valor_aberto
from licitacoes;
