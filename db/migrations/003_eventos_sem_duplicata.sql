-- O collector relê o histórico inteiro de cada licitação a cada ciclo. Sem
-- uma chave natural, os mesmos eventos entrariam de novo a cada 30 minutos.
--
-- A chave é a licitação, o instante, o tipo e a descrição. Descrição aceita
-- nulo, e nulo não colide com nulo em UNIQUE, por isso um índice com
-- coalesce em vez de uma constraint comum.

create unique index eventos_sem_duplicata_idx
  on eventos (licitacao_id, data, tipo, coalesce(descricao, ''));
