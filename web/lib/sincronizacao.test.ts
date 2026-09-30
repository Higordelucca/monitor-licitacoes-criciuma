import { describe, expect, it } from "vitest";
import { resumoSync, type FonteSync } from "./sincronizacao";

const AGORA = new Date("2026-09-30T13:00:00-03:00");
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000);

const fonte = (f: Partial<FonteSync>): FonteSync => ({
  fonte: "PNCP · Município de Criciúma",
  ultimo_status: "ok",
  ultimo_inicio: ha(12),
  ultimo_ok: ha(10),
  ...f,
});

describe("resumo da sincronização no Header", () => {
  it("tudo em dia mostra o último sucesso", () => {
    expect(resumoSync([fonte({})], AGORA)).toEqual({ situacao: "ok", sincronizadoEm: ha(10) });
  });

  it("rodada em curso é sincronizando", () => {
    const r = resumoSync([fonte({ ultimo_status: "rodando", ultimo_inicio: ha(5) })], AGORA);
    expect(r.situacao).toBe("rodando");
  });

  it("rodando há mais que o limite do job é rodada morta, e conta como falha", () => {
    // Em 2026-09-30 o job cancelado deixou "rodando" e o Header dizia
    // "Sincronizando agora" sem nada rodar. O job mais longo tem 180 min.
    const r = resumoSync([fonte({ ultimo_status: "rodando", ultimo_inicio: ha(181) })], AGORA);
    expect(r.situacao).toBe("falhou");
  });

  it("última tentativa com erro é falha, mas a hora continua a do último sucesso", () => {
    // Antes o Header mostrava "Sincronizado há 2 min" com a hora do erro.
    const r = resumoSync([fonte({ ultimo_status: "erro", ultimo_inicio: ha(2), ultimo_ok: ha(300) })], AGORA);
    expect(r).toEqual({ situacao: "falhou", sincronizadoEm: ha(300) });
  });

  it("falha num órgão aparece mesmo com os outros em dia", () => {
    // Com o PNCP fora do ar a rodada para no Município e os demais nem
    // começam: a última linha deles continua ok.
    const r = resumoSync(
      [fonte({ ultimo_status: "erro", ultimo_ok: ha(200) }), fonte({ fonte: "PNCP · CriciúmaPrev" })],
      AGORA,
    );
    expect(r.situacao).toBe("falhou");
  });

  it("a hora é a do órgão mais atrasado", () => {
    const r = resumoSync([fonte({ ultimo_ok: ha(10) }), fonte({ fonte: "PNCP · CriciúmaPrev", ultimo_ok: ha(90) })], AGORA);
    expect(r.sincronizadoEm).toEqual(ha(90));
  });

  it("sem sucesso há mais de 2 h é atrasado, mesmo sem erro", () => {
    // O GitHub deixa de disparar o cron por horas (6 rodadas em 29/09).
    const r = resumoSync([fonte({ ultimo_inicio: ha(130), ultimo_ok: ha(121) })], AGORA);
    expect(r.situacao).toBe("atrasado");
  });

  it("sem linha nenhuma não afirma nada", () => {
    expect(resumoSync([], AGORA)).toEqual({ situacao: "falhou", sincronizadoEm: null });
  });
});
