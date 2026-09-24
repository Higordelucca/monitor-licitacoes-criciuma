import { describe, expect, it } from "vitest";
import { hrefCom, lerFiltros, montarConsulta, POR_PAGINA } from "./filtros";

describe("lerFiltros", () => {
  it("sem parâmetro devolve o padrão: publicação mais recente primeiro, página 1", () => {
    expect(lerFiltros({})).toEqual({ ordem: "publicacao", dir: "desc", pagina: 1 });
  });

  it("aceita status do CHECK e descarta o resto", () => {
    expect(lerFiltros({ status: "homologada" }).status).toBe("homologada");
    expect(lerFiltros({ status: "Homologada" }).status).toBeUndefined();
    expect(lerFiltros({ status: "'; drop table licitacoes" }).status).toBeUndefined();
  });

  it("só aceita órgão que está entre os sete coletados", () => {
    expect(lerFiltros({ orgao: "82916818000113" }).orgao).toBe("82916818000113");
    expect(lerFiltros({ orgao: "00394452000103" }).orgao).toBeUndefined();
    expect(lerFiltros({ orgao: "82.916.818/0001-13" }).orgao).toBeUndefined();
  });

  it("modalidade é texto livre, aparado e limitado", () => {
    expect(lerFiltros({ modalidade: "  Dispensa " }).modalidade).toBe("Dispensa");
    expect(lerFiltros({ modalidade: "" }).modalidade).toBeUndefined();
    expect(lerFiltros({ modalidade: "x".repeat(101) }).modalidade).toBeUndefined();
  });

  it("datas só no formato AAAA-MM-DD e que existam no calendário", () => {
    expect(lerFiltros({ de: "2026-01-31" }).de).toBe("2026-01-31");
    expect(lerFiltros({ de: "2026-02-30" }).de).toBeUndefined();
    expect(lerFiltros({ ate: "31/01/2026" }).ate).toBeUndefined();
  });

  it("busca vazia é ignorada e busca longa é cortada em 200 caracteres", () => {
    expect(lerFiltros({ q: "   " }).q).toBeUndefined();
    expect(lerFiltros({ q: " merenda escolar " }).q).toBe("merenda escolar");
    expect(lerFiltros({ q: "a".repeat(300) }).q).toHaveLength(200);
  });

  it("página inválida volta para 1", () => {
    expect(lerFiltros({ pagina: "3" }).pagina).toBe(3);
    expect(lerFiltros({ pagina: "0" }).pagina).toBe(1);
    expect(lerFiltros({ pagina: "-2" }).pagina).toBe(1);
    expect(lerFiltros({ pagina: "abc" }).pagina).toBe(1);
    expect(lerFiltros({ pagina: "2.5" }).pagina).toBe(1);
  });

  it("ordem desconhecida volta ao padrão, e direção também", () => {
    expect(lerFiltros({ ordem: "valor", dir: "asc" })).toMatchObject({ ordem: "valor", dir: "asc" });
    expect(lerFiltros({ ordem: "id_pncp; --" }).ordem).toBe("publicacao");
    expect(lerFiltros({ dir: "sideways" }).dir).toBe("desc");
  });

  it("parâmetro repetido na URL: vale o primeiro", () => {
    expect(lerFiltros({ status: ["aberta", "suspensa"] }).status).toBe("aberta");
  });
});

describe("montarConsulta", () => {
  it("sem filtro não tem where e pagina a partir do zero", () => {
    const c = montarConsulta(lerFiltros({}));
    expect(c.where).toBe("");
    expect(c.valores).toEqual([]);
    expect(c.orderBy).toBe("data_publicacao desc nulls last, id desc");
    expect(c.limit).toBe(POR_PAGINA);
    expect(c.offset).toBe(0);
  });

  it("cada filtro vira um parâmetro numerado, nunca texto colado no SQL", () => {
    const c = montarConsulta(
      lerFiltros({ status: "aberta", orgao: "82916818000113", q: "merenda", pagina: "3" }),
    );
    expect(c.where).toBe(
      "where status = $1 and left(id_pncp, 14) = $2 and to_tsvector('portuguese', objeto) @@ plainto_tsquery('portuguese', $3)",
    );
    expect(c.valores).toEqual(["aberta", "82916818000113", "merenda"]);
    expect(c.offset).toBe(2 * POR_PAGINA);
  });

  it("período usa o dia inteiro no fuso de Brasília", () => {
    const c = montarConsulta(lerFiltros({ de: "2026-01-01", ate: "2026-01-31" }));
    expect(c.where).toBe(
      "where data_publicacao >= ($1::date)::timestamp at time zone 'America/Sao_Paulo'" +
        " and data_publicacao < ($2::date + 1)::timestamp at time zone 'America/Sao_Paulo'",
    );
    expect(c.valores).toEqual(["2026-01-01", "2026-01-31"]);
  });

  it("a ordenação sai de um mapa fixo e desempata pelo id", () => {
    expect(montarConsulta(lerFiltros({ ordem: "valor", dir: "asc" })).orderBy).toBe(
      "valor_estimado asc nulls last, id desc",
    );
  });
});

describe("hrefCom", () => {
  it("mantém os filtros e troca só o que foi pedido", () => {
    const f = lerFiltros({ status: "aberta", pagina: "2" });
    expect(hrefCom(f, { pagina: 3 })).toBe("/?status=aberta&pagina=3");
  });

  it("omite o que está no valor padrão, para a URL ficar curta", () => {
    const f = lerFiltros({ status: "aberta", pagina: "4" });
    expect(hrefCom(f, { pagina: 1 })).toBe("/?status=aberta");
    expect(hrefCom(lerFiltros({}), {})).toBe("/");
  });

  it("mudar a ordenação volta para a página 1", () => {
    const f = lerFiltros({ pagina: "5" });
    expect(hrefCom(f, { ordem: "valor", dir: "asc" })).toBe("/?ordem=valor&dir=asc");
  });
});
