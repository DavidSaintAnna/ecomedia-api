# 🌱 EcoMedia API

**A rede social das ações sustentáveis da sua cidade.**
Pessoas publicam o que fazem no dia a dia para um futuro mais verde (compostagem, bicicleta, economia de água, mutirões de limpeza…), curtem, comentam e seguem umas às outras.

Este repositório é o **back-end (a API)** do projeto. Ele responde ao **[Objetivo de Desenvolvimento Sustentável 11 da ONU](https://brasil.un.org/pt-br/sdgs/11) — Cidades e Comunidades Sustentáveis**.

> 🔗 **API publicada:** https://ecomedia-api.onrender.com
> 📖 **Documentação interativa (Swagger):** https://ecomedia-api.onrender.com/api-docs/

---

## Sumário

1. [O problema e a solução](#1-o-problema-e-a-solução)
2. [Regras de negócio](#2-regras-de-negócio)
3. [Como o Neon, o Render e o GitHub se conectam](#3-como-o-neon-o-render-e-o-github-se-conectam)
4. [Testando online (sem instalar nada)](#4-testando-online-sem-instalar-nada)
5. [Rodando na sua máquina](#5-rodando-na-sua-máquina)
6. [Comandos do npm](#6-comandos-do-npm)
7. [Testes automatizados](#7-testes-automatizados)
8. [Licença e autor](#8-licença-e-autor)

---

## 1. O problema e a solução

As cidades concentram a maior parte da população e dos impactos ambientais, mas as pequenas ações sustentáveis de cada pessoa raramente são vistas, e quem quer começar não sabe por onde. Quando alguém do seu bairro conta que começou a compostar ou que trocou o carro pela bicicleta, isso inspira.

A **EcoMedia** transforma essas ações em conteúdo compartilhável:

- cada pessoa publica uma **ação sustentável**, classificada por categoria e cidade;
- a comunidade reage com **curtidas e comentários**;
- dá para **seguir** pessoas e acompanhar um **feed** só com quem inspira você;
- um **ranking** mostra quem mais inspira a comunidade, e as **estatísticas** mostram o tamanho do movimento.

---

## 2. Regras de negócio

**Modelo conceitual** (estilo BRModelo): as 4 entidades da API e como elas se relacionam. Uma pessoa publica vários posts, cada post tem exatamente uma categoria, pessoas curtem posts e comentam neles, e usuários seguem outros usuários.

![Modelo conceitual da EcoMedia: entidades, relacionamentos, atributos e cardinalidades](docs/img/modelo-conceitual.png)

**Quem pode fazer o quê** e as regras que o sistema garante sozinho (e-mail único, curtir/seguir como interruptor, categoria obrigatória, ranking, feed…):

![Matriz de permissões e regras de negócio da EcoMedia](docs/img/regras-de-negocio.png)

Quem se cadastra pela API **sempre** vira usuário comum: ninguém consegue se promover a administrador.

---

## 3. Como o Neon, o Render e o GitHub se conectam

Cada peça faz **um** trabalho. O código fica no **GitHub**, o **Render** executa a API na internet e o **Neon** guarda os dados (usuários, posts, curtidas…) num PostgreSQL na nuvem.

```mermaid
flowchart LR
  V["👤 Qualquer pessoa<br/>(navegador)"] -->|"1. abre o Swagger e usa a API"| R
  G["🐙 GitHub<br/>código do projeto"] -->|"2. cada push = deploy automático"| R
  R["⚙️ Render<br/>roda a API (Node)"] -->|"3. DATABASE_URL (segredo)"| N[("🐘 Neon<br/>PostgreSQL na nuvem")]
  L["💻 Seu computador<br/>npm run dev + .env"] -.->|"seu próprio banco"| B[("Seu banco<br/>(Neon ou Postgres local)")]
```

- **A ponte é a variável `DATABASE_URL`**: o endereço e a senha do banco. Ela existe só no painel do Render e no `.env` de quem roda o projeto. **Nunca vai para o GitHub** (o `.env` está no `.gitignore`).
- **`JWT_SECRET`** é o segredo que assina os logins (tokens). Também fica só no Render e no `.env`. As demais variáveis são opcionais e estão explicadas no `.env.example`.
- **Quem usa a API online não precisa de conta no Neon nem de Render:** a API é a porta de entrada e o banco fica protegido atrás dela.
- **Quem clonar o código** precisa do **próprio banco** (conta grátis no Neon ou PostgreSQL/Docker local). Ele nunca enxerga os dados do meu banco, porque não tem a minha `DATABASE_URL`.
- O Render grátis **dorme após 15 minutos parado**: o primeiro acesso depois disso pode levar cerca de 1 minuto para acordar. É normal.

---

## 4. Testando online (sem instalar nada)

O **Swagger** é a página que documenta a API: lista todas as rotas e deixa você testá-las no navegador, sem programar. Abra **https://ecomedia-api.onrender.com/api-docs/** (na primeira vez pode levar ~1 minuto: o servidor grátis está acordando).

**Como ler a página**
- As rotas ficam em **grupos** (Autenticação, Posts, Categorias…): clique no nome do grupo e depois numa rota para ver os detalhes. O campo **Filtrar por grupo ou rota** ajuda a achar uma.
- **GET** = ver, **POST** = criar/enviar, **PATCH** = editar, **DELETE** = apagar. Rotas com **cadeado 🔒** exigem login; as outras qualquer pessoa pode usar.
- Dentro de uma rota, **Exemplo** é só uma ilustração e **Respostas** mostra o que ela pode devolver (200, 401…).

**Passo a passo: entrar e publicar um post**
1. **Pegar o token** (o "crachá" de login): abra **Autenticação → `POST /api/auth/login` → Testar**, troque o modelo pelo e-mail e a senha de uma conta de demonstração (`ana.souza@exemplo.com` / `Senha12345`; ou crie a sua em `POST /api/auth/register`) e clique em **Executar**.
2. **Copiar o token:** na **Resposta do servidor → Corpo da resposta**, procure `"token": "eyJ…"` (um texto bem longo). Copie **só o que está entre as aspas** (pelo ícone de copiar ou selecionando tudo). ⚠️ Não use o token do bloco "Exemplo": ele é falso (termina em `assinatura-de-exemplo`) e dá erro 401.
3. **Autorizar:** clique no botão **Autorizar** (no topo ou em qualquer 🔒), cole o token em **Valor** (sem escrever "Bearer"), clique em **Autorizar** e depois em **Fechar**. Os cadeados ficam fechados: o Swagger passa a enviar o seu token em todas as rotas.
4. **Escolher a categoria:** em **Categorias → `GET /api/categories` → Testar → Executar**, anote o `id` da que quiser (ex.: `1`).
5. **Publicar:** em **Posts → `POST /api/posts` → Testar**, edite o corpo, por exemplo `{"categoryId": 1, "content": "Troquei o carro pela bicicleta hoje!", "city": "Aracaju"}`, e clique em **Executar**. Código **201** = post criado; confira em `GET /api/posts`.

**Testar as rotas de administrador:** cadastrar-se pela API sempre cria um usuário comum (ninguém vira admin sozinho). Para testar o que só o admin faz (criar, editar e excluir categorias; moderar posts e comentários de qualquer pessoa), repita os passos 1 a 3 entrando com a **conta de administrador de demonstração**: `admin@ecomedia.dev` / `Admin12345`. É uma conta pública, só para avaliação; os dados podem ser restaurados a qualquer momento.

**Deu erro?** **401**: sem token, token colado errado ou vencido (vale 7 dias); refaça os passos 1 a 3. **400**: algum campo inválido; leia a `message` da resposta. **403**: sem permissão (ex.: rotas de administrador). **404**: o id não existe. **429**: muitas tentativas; espere alguns minutos.

---

## 5. Rodando na sua máquina

Você precisa do **Node.js 22.12+** ([nodejs.org](https://nodejs.org)) e de **um banco PostgreSQL**: uma conta grátis no [Neon](https://neon.com) (botão **Connect → Pooled connection** para copiar o endereço) ou Docker local:
`docker run --name ecomedia-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ecomedia -p 5432:5432 -d postgres:16`

```powershell
git clone https://github.com/DavidSaintAnna/ecomedia-api.git
cd ecomedia-api
npm install
Copy-Item .env.example .env      # macOS/Linux: cp .env.example .env
```

Abra o `.env` e preencha **`DATABASE_URL`** (endereço do seu banco; com Docker: `postgres://postgres:postgres@localhost:5432/ecomedia`) e **`JWT_SECRET`** (um texto secreto de 32+ caracteres; para gerar um: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Depois:

```powershell
npm run db:migrate     # cria as tabelas
npm run db:seed        # cria as categorias e o administrador
npm run dev            # liga a API em http://localhost:3333 (Swagger em /api-docs)
```

---

## 6. Comandos do npm

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Liga a API em modo desenvolvimento (reinicia ao salvar) |
| `npm run build` | Converte o TypeScript em JavaScript na pasta `dist/` |
| `npm start` | Liga a versão compilada (é o que o Render roda, depois do `build`) |
| `npm run typecheck` | Confere os tipos do TypeScript sem gerar arquivos |
| `npm test` | Roda os testes automatizados |
| `npm run db:generate` | Cria uma migração SQL a partir de mudanças em `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações pendentes no banco |
| `npm run db:seed` | Cria categorias e administrador (pode repetir sem duplicar) |
| `npm run db:demo -- --sim` | **Apaga** usuários comuns e posts do banco e cria dados de demonstração em português |
| `npm run docs:gerar` | Regenera `docs/openapi.json` e a coleção do Postman |

---

## 7. Testes automatizados

`npm test` roda **152 testes** com **Vitest + Supertest + PGlite** (um PostgreSQL em memória): não precisam de Neon, de internet nem de `.env`, e terminam em poucos segundos. Eles cobrem cadastro e login, permissões, posts, curtidas, seguidores, feed, ranking, mensagens em português e se o Swagger bate com as rotas reais.

---

## 8. Licença e autor

Distribuído sob a licença **MIT** (arquivo [`LICENSE`](LICENSE)).

Feito por **David Saint Anna** ([@DavidSaintAnna](https://github.com/DavidSaintAnna)) como projeto acadêmico, em apoio ao **ODS 11 da ONU**. 🌍
