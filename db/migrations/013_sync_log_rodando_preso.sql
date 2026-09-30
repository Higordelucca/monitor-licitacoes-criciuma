-- Jobs cancelados pelo Actions (tempo esgotado com o PNCP lento) deixaram
-- linhas em "rodando" que nunca fecham: 6 em 2026-09-30, e o Header mostrava
-- "Sincronizando agora" sem nada rodar. O collector agora fecha a linha ao
-- receber o sinal de cancelamento (db.interromper); aqui se fecham as que já
-- ficaram. Aplicar sem coleta em curso: toda linha "rodando" é tratada como
-- morta.

update sync_log
   set status = 'erro',
       finalizado_em = coalesce(finalizado_em, now()),
       erro = 'rodada interrompida: job cancelado ou tempo esgotado'
 where status = 'rodando';
