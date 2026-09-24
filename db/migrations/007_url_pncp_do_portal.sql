-- O link "Abrir no PNCP" dava 404: o collector gravava o item_url da API de
-- busca (/compras/{cnpj}/{ano}/{seq}), que não é página do portal. A rota da
-- página, conferida no código do próprio portal em 2026-09-23, é
-- /app/editais/{cnpj}/{ano}/{seq}. O collector já grava o formato novo
-- (mapeamento.url_pncp); aqui se corrige o que foi gravado antes.

update licitacoes
   set url_pncp = 'https://pncp.gov.br/app/editais/' || substr(url_pncp, length('https://pncp.gov.br/compras/') + 1)
 where url_pncp like 'https://pncp.gov.br/compras/%';
