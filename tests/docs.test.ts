import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openapi } from "../src/docs/openapi.js";
import { gerarColecao } from "../src/docs/postman.js";
import { api } from "./helpers.js";

// Estes testes garantem que a documentação (Swagger/Postman) nunca fica diferente da API de verdade.

const METODOS = ["get", "post", "put", "patch", "delete"];
const lerArquivo = (caminho: string) => readFileSync(caminho, "utf-8");

// Lê o código-fonte das rotas e descobre quais endpoints existem de verdade.
// (Aceita aspas simples, duplas ou crase e quebras de linha, porque o Prettier pode reformatar o código.)
function rotasDoCodigo(): Set<string> {
  const app = lerArquivo("src/app.ts");
  const arquivos = readdirSync("src/routes").filter((f) => f.endsWith(".ts"));

  // 1) nome do roteador -> arquivo
  const aberto = new Map<string, string>(); // nome do roteador -> conteúdo do arquivo
  for (const arq of arquivos) {
    const conteudo = lerArquivo(`src/routes/${arq}`);
    for (const m of conteudo.matchAll(
      /export\s+const\s+(\w+)\s*=\s*Router\(\)/g,
    ))
      aberto.set(m[1], conteudo);
  }

  // 2) onde cada roteador é montado em app.ts (ex.: app.use('/api/posts', postsRouter))
  const prefixos = new Map<string, string[]>();
  for (const m of app.matchAll(
    /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g,
  )) {
    if (!aberto.has(m[2])) continue; // ignora middlewares como o apiLimiter
    prefixos.set(m[2], [...(prefixos.get(m[2]) ?? []), m[1]]);
  }

  const rotas = new Set<string>();
  const adicionar = (metodo: string, caminho: string) => {
    const final = caminho === "" ? "/" : caminho;
    rotas.add(`${metodo.toUpperCase()} ${final.replace(/:(\w+)/g, "{$1}")}`);
  };

  // 3) cada rota declarada nos roteadores
  for (const [nome, conteudo] of aberto) {
    const regex = new RegExp(
      `${nome}\\.(get|post|put|patch|delete)\\(\\s*['"\`]([^'"\`]+)['"\`]`,
      "g",
    );
    for (const m of conteudo.matchAll(regex)) {
      for (const prefixo of prefixos.get(nome) ?? [])
        adicionar(m[1], prefixo + (m[2] === "/" ? "" : m[2]));
    }
  }

  // 4) rotas declaradas direto em app.ts (/ e /api/health)
  for (const m of app.matchAll(
    /\bapp\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g,
  ))
    adicionar(m[1], m[2]);

  return rotas;
}

function rotasDocumentadas(): Set<string> {
  const rotas = new Set<string>();
  for (const [caminho, itens] of Object.entries<Record<string, unknown>>(
    openapi.paths,
  )) {
    for (const metodo of METODOS)
      if (itens[metodo]) rotas.add(`${metodo.toUpperCase()} ${caminho}`);
  }
  return rotas;
}

describe("documentação x rotas reais", () => {
  it("encontra as rotas no código (confere que o leitor de rotas funciona)", () => {
    const rotas = rotasDoCodigo();
    expect(rotas.size).toBeGreaterThanOrEqual(25);
    expect(rotas).toContain("POST /api/auth/login");
    expect(rotas).toContain("POST /api/posts/{id}/like");
    expect(rotas).toContain("GET /api/health");
  });

  it("toda rota que existe no código está documentada", () => {
    const faltando = [...rotasDoCodigo()].filter(
      (r) => !rotasDocumentadas().has(r),
    );
    expect(
      faltando,
      `Rotas sem documentação em src/docs/openapi.ts: ${faltando.join(", ")}`,
    ).toEqual([]);
  });

  it("toda rota documentada existe no código", () => {
    const sobrando = [...rotasDocumentadas()].filter(
      (r) => !rotasDoCodigo().has(r),
    );
    expect(
      sobrando,
      `Rotas documentadas que não existem: ${sobrando.join(", ")}`,
    ).toEqual([]);
  });
});

describe("qualidade da especificação OpenAPI", () => {
  const operacoes = Object.entries<Record<string, any>>(openapi.paths).flatMap(
    (
      [caminho, itens], // eslint-disable-line @typescript-eslint/no-explicit-any
    ) =>
      METODOS.filter((m) => itens[m]).map((m) => ({
        rota: `${m.toUpperCase()} ${caminho}`,
        op: itens[m],
      })),
  );

  it("toda operação tem operationId único, resumo, tag e respostas", () => {
    const ids = operacoes.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = openapi.tags.map((t: { name: string }) => t.name);
    for (const { rota, op } of operacoes) {
      expect(op.operationId, rota).toBeTruthy();
      expect(op.summary, rota).toBeTruthy();
      expect(tags, rota).toContain(op.tags[0]);
      expect(Object.keys(op.responses).length, rota).toBeGreaterThan(0);
    }
  });

  it("toda rota protegida documenta o erro 401 e declara o cadeado (bearerAuth)", () => {
    for (const { rota, op } of operacoes.filter((o) => o.op.security)) {
      expect(op.responses[401], rota).toBeTruthy();
      expect(op.security, rota).toEqual([{ bearerAuth: [] }]);
    }
  });

  it("toda rota com id na URL documenta o parâmetro", () => {
    for (const { rota, op } of operacoes.filter((o) =>
      o.rota.includes("{id}"),
    )) {
      expect(
        op.parameters.some(
          (p: { name: string; in: string }) =>
            p.name === "id" && p.in === "path",
        ),
        rota,
      ).toBe(true);
    }
  });

  it("todas as referências ($ref) apontam para algo que existe", () => {
    const texto = JSON.stringify(openapi);
    const refs = [...texto.matchAll(/"\$ref":"#\/components\/(\w+)\/(\w+)"/g)];
    expect(refs.length).toBeGreaterThan(20);
    for (const [, tipo, nome] of refs)
      expect(openapi.components[tipo][nome], `${tipo}/${nome}`).toBeTruthy();
  });
});

describe("arquivos gerados em docs/", () => {
  // Se este teste falhar, a documentação mudou e os arquivos estão velhos: rode "npm run docs:gerar".
  it("docs/openapi.json está atualizado (npm run docs:gerar)", () => {
    expect(JSON.parse(lerArquivo("docs/openapi.json"))).toEqual(
      JSON.parse(JSON.stringify(openapi)),
    );
  });

  it("docs/ecomedia.postman_collection.json está atualizado (npm run docs:gerar)", () => {
    expect(
      JSON.parse(lerArquivo("docs/ecomedia.postman_collection.json")),
    ).toEqual(JSON.parse(JSON.stringify(gerarColecao())));
  });

  it("a coleção do Postman cobre todas as rotas documentadas", () => {
    // gerarColecao() já lança um erro se alguma rota do OpenAPI ficar sem passo na coleção
    const colecao = gerarColecao();
    const requisicoes = colecao.item.flatMap(
      (pasta: { item: unknown[] }) => pasta.item,
    );
    expect(requisicoes.length).toBeGreaterThanOrEqual(rotasDocumentadas().size);
  });
});

describe("variáveis de ambiente e .env.example", () => {
  it("toda variável de ambiente usada no código está no .env.example", () => {
    const usadas = new Set<string>();
    const pastas = [
      "src",
      "src/db",
      "src/middleware",
      "src/routes",
      "src/utils",
      "src/docs",
    ];
    for (const pasta of pastas) {
      for (const arq of readdirSync(pasta).filter((f) => f.endsWith(".ts"))) {
        for (const m of lerArquivo(`${pasta}/${arq}`).matchAll(
          /process\.env\.([A-Z_]+)/g,
        ))
          usadas.add(m[1]);
      }
    }
    usadas.delete("NODE_ENV"); // definida pelo próprio Node, não pela pessoa
    expect(usadas.size).toBeGreaterThanOrEqual(8);
    const exemplo = lerArquivo(".env.example");
    for (const nome of usadas) {
      expect(exemplo, `${nome} falta no .env.example`).toContain(nome);
    }
  });

  it("o .env.example não traz um JWT_SECRET utilizável (a API tem que se recusar a subir até a pessoa trocar)", () => {
    const linha = lerArquivo(".env.example")
      .split("\n")
      .find((l) => l.startsWith("JWT_SECRET="))!;
    expect(linha.replace("JWT_SECRET=", "").trim().length).toBeLessThan(32);
  });
});

describe("páginas de documentação servidas pela API", () => {
  it("GET /api-docs.json devolve a especificação OpenAPI", async () => {
    const r = await api().get("/api-docs.json");
    expect(r.status).toBe(200);
    expect(r.body.openapi).toMatch(/^3\./);
    expect(r.body.info.title).toBe("API EcoMedia");
    expect(Object.keys(r.body.paths).length).toBeGreaterThan(15);
  });

  it("GET /api-docs/ devolve a página do Swagger em português", async () => {
    const r = await api().get("/api-docs/");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.text).toContain("API EcoMedia — Documentação");
    expect(r.text).toContain("/api-docs/traducao-pt-br.js");
  });

  it("o script de tradução é servido como JavaScript e traduz os botões principais", async () => {
    const r = await api().get("/api-docs/traducao-pt-br.js");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("javascript");
    expect(r.text).toContain("'Authorize': 'Autorizar'");
    expect(r.text).toContain("'Try it out': 'Testar'");
    expect(r.text).toContain("'Execute': 'Executar'");
    // O script roda no navegador: precisa ser JavaScript válido
    expect(() => new Function(r.text)).not.toThrow();
  });

  it("GET /docs redireciona para /api-docs", async () => {
    const r = await api().get("/docs");
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe("/api-docs");
  });

  it("a página de documentação não enfraquece a segurança do resto da API", async () => {
    const docs = await api().get("/api-docs/");
    const saude = await api().get("/api/health");
    // Na documentação, scripts só podem vir do próprio servidor (nada de script embutido ou de terceiros)
    expect(docs.headers["content-security-policy"]).toMatch(
      /script-src 'self';/,
    );
    expect(saude.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(saude.headers["x-content-type-options"]).toBe("nosniff");
  });
});
