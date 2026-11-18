// Gera a coleção do Postman a partir da documentação OpenAPI (src/docs/openapi.ts).
//
// Assim a coleção nunca fica diferente da documentação: as rotas, os parâmetros e os exemplos vêm do OpenAPI.
// O que este arquivo acrescenta é a ORDEM DE USO (cadastrar → entrar → criar post → curtir...), os testes
// automáticos de cada requisição e a captura automática do token e dos ids.
//
// Para gerar os arquivos:  npm run docs:gerar

import { openapi, type Obj } from './openapi.js';

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
const METODOS: Metodo[] = ['get', 'post', 'put', 'patch', 'delete'];

interface Passo {
  /** operationId da rota no OpenAPI */
  op: string;
  /** Nome que aparece no Postman (padrão: o resumo da rota no OpenAPI) */
  nome?: string;
  /** Pasta onde o passo aparece (padrão: a tag da rota) */
  pasta?: string;
  /** Valor do parâmetro {id} da URL, geralmente uma variável da coleção, ex.: '{{postId}}' */
  id?: string;
  /** Parâmetros de query ativos (os demais ficam desmarcados) */
  query?: Record<string, string>;
  /** Corpo da requisição: objeto (vira JSON) ou texto (para usar variáveis como número) */
  corpo?: Obj | string;
  /** Quem faz a chamada: 'usuario' (padrão), 'admin', 'segunda', 'temporaria' ou 'ninguem' */
  como?: 'usuario' | 'admin' | 'segunda' | 'temporaria' | 'ninguem';
  /** Status HTTP esperado (padrão: o primeiro 2xx documentado) */
  status?: number;
  /** Linhas de JavaScript do Postman executadas ANTES de enviar */
  antes?: string[];
  /** Linhas de JavaScript do Postman executadas DEPOIS, para testes e capturas (j = corpo da resposta em JSON) */
  depois?: string[];
  /** Explicação extra mostrada na descrição da requisição */
  nota?: string;
}

const usaJson = 'const j = pm.response.json();';

// ───────────────────────── A sequência de uso ─────────────────────────
const FLUXO: Passo[] = [
  // Sistema
  { op: 'infoApi', depois: [usaJson, "pm.test('Informa o nome da API', () => pm.expect(j.name).to.eql('EcoMedia API'));"] },
  { op: 'verificarSaude', depois: [usaJson, "pm.test('A API está no ar', () => pm.expect(j.status).to.eql('ok'));"] },

  // Autenticação
  {
    op: 'cadastrarUsuario',
    nome: 'Criar uma conta',
    como: 'ninguem',
    nota: 'Gera um e-mail novo a cada execução e guarda o token e o id nas variáveis `token` e `userId`.',
    antes: ["pm.collectionVariables.set('emailUsuario', 'ana.' + Date.now() + '@exemplo.com');"],
    corpo: { name: 'Ana Souza', email: '{{emailUsuario}}', password: '{{senhaUsuario}}', city: 'São Paulo', bio: 'Apaixonada por compostagem e bicicleta.' },
    depois: [
      usaJson,
      "pm.test('A conta nasce como USER', () => pm.expect(j.user.role).to.eql('USER'));",
      "pm.test('Devolve um token', () => pm.expect(j.token).to.be.a('string').and.not.empty);",
      "pm.test('Nunca devolve a senha', () => pm.expect(JSON.stringify(j)).to.not.include('password'));",
      "pm.collectionVariables.set('token', j.token);",
      "pm.collectionVariables.set('userId', j.user.id);",
    ],
  },
  {
    op: 'cadastrarUsuario',
    nome: 'Criar conta com o mesmo e-mail (erro 409)',
    como: 'ninguem',
    status: 409,
    nota: 'Mostra a mensagem de erro em português quando o e-mail já existe.',
    corpo: { name: 'Ana Souza', email: '{{emailUsuario}}', password: '{{senhaUsuario}}' },
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('E-mail já cadastrado'));"],
  },
  {
    op: 'cadastrarUsuario',
    nome: 'Criar conta com dados inválidos (erro 400)',
    como: 'ninguem',
    status: 400,
    nota: 'Mostra a lista `details`, que indica qual campo está errado e por quê.',
    corpo: { name: 'A', email: 'isto-nao-e-um-email', password: '123' },
    depois: [
      usaJson,
      "pm.test('É um erro de validação', () => pm.expect(j.error).to.eql('ValidationError'));",
      "pm.test('Aponta os 3 campos errados', () => pm.expect(j.details.map(d => d.path).sort()).to.eql(['email', 'name', 'password']));",
    ],
  },
  {
    op: 'entrar',
    nome: 'Entrar (login)',
    como: 'ninguem',
    corpo: { email: '{{emailUsuario}}', password: '{{senhaUsuario}}' },
    depois: [usaJson, "pm.test('Devolve um token', () => pm.expect(j.token).to.be.a('string').and.not.empty);", "pm.collectionVariables.set('token', j.token);"],
  },
  {
    op: 'entrar',
    nome: 'Entrar com senha errada (erro 401)',
    como: 'ninguem',
    status: 401,
    corpo: { email: '{{emailUsuario}}', password: 'senha-errada' },
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('E-mail ou senha inválidos'));"],
  },
  {
    op: 'entrar',
    nome: 'Entrar como administrador',
    como: 'ninguem',
    nota: 'Usa o administrador criado pelo comando de seed. Se você mudou `ADMIN_EMAIL` ou `ADMIN_PASSWORD` no `.env`, ajuste as variáveis `adminEmail` e `adminPassword` da coleção.',
    corpo: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
    depois: [
      usaJson,
      "pm.test('É administrador', () => pm.expect(j.user.role).to.eql('ADMIN'));",
      "pm.collectionVariables.set('adminToken', j.token);",
    ],
  },
  {
    op: 'cadastrarUsuario',
    nome: 'Criar a conta de uma segunda pessoa',
    como: 'ninguem',
    nota: 'Para testar permissões e "seguir", precisamos de outra pessoa. Guarda o token e o id dela em `tokenSegunda` e `userIdSegunda`.',
    antes: ["pm.collectionVariables.set('emailSegunda', 'bruno.' + Date.now() + '@exemplo.com');"],
    corpo: { name: 'Bruno Lima', email: '{{emailSegunda}}', password: '{{senhaUsuario}}', city: 'Curitiba' },
    depois: [usaJson, "pm.collectionVariables.set('tokenSegunda', j.token);", "pm.collectionVariables.set('userIdSegunda', j.user.id);"],
  },
  {
    op: 'meuUsuario',
    nome: 'Ver quem está logado',
    depois: [usaJson, "pm.test('É a conta que acabei de criar', () => pm.expect(j.email).to.eql(String(pm.collectionVariables.get('emailUsuario'))));"],
  },
  {
    op: 'meuUsuario',
    nome: 'Ver quem está logado sem token (erro 401)',
    como: 'ninguem',
    status: 401,
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Autenticação necessária'));"],
  },

  // Categorias
  {
    op: 'listarCategorias',
    nota: 'Guarda o `id` da primeira categoria na variável `categoryId`, usada para criar posts.',
    como: 'ninguem',
    depois: [
      usaJson,
      "pm.test('Há categorias (o seed cria 7)', () => pm.expect(j.length).to.be.at.least(7));",
      "pm.collectionVariables.set('categoryId', j[0].id);",
    ],
  },
  {
    op: 'buscarCategoria',
    id: '{{categoryId}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('É a categoria pedida', () => pm.expect(String(j.id)).to.eql(String(pm.collectionVariables.get('categoryId'))));"],
  },
  {
    op: 'criarCategoria',
    nome: 'Criar categoria sem ser administrador (erro 403)',
    status: 403,
    corpo: { name: 'Categoria que não deve ser criada' },
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Você não tem permissão para fazer isso'));"],
  },
  {
    op: 'criarCategoria',
    nome: 'Criar categoria (administrador)',
    como: 'admin',
    antes: ["pm.collectionVariables.set('nomeCategoriaNova', 'Educação Ambiental ' + Date.now());"],
    corpo: { name: '{{nomeCategoriaNova}}', description: 'Palestras, oficinas e campanhas de conscientização.' },
    depois: [usaJson, "pm.collectionVariables.set('categoriaNovaId', j.id);"],
  },
  {
    op: 'atualizarCategoria',
    nome: 'Atualizar categoria (administrador)',
    como: 'admin',
    id: '{{categoriaNovaId}}',
    corpo: { name: '{{nomeCategoriaNova}} e Cidadania', description: 'Palestras, oficinas e campanhas de conscientização.' },
    depois: [usaJson, "pm.test('O nome mudou', () => pm.expect(j.name).to.include('e Cidadania'));"],
  },
  {
    op: 'excluirCategoria',
    nome: 'Excluir categoria (administrador)',
    como: 'admin',
    id: '{{categoriaNovaId}}',
  },

  // Posts
  {
    op: 'criarPost',
    nome: 'Publicar um post',
    nota: 'Guarda o id do post na variável `postId`, usada pelas próximas requisições.',
    corpo: `{
  "categoryId": {{categoryId}},
  "content": "Comecei a compostagem em casa: já são 3 kg de lixo orgânico a menos por semana! 🌱",
  "city": "São Paulo"
}`,
    depois: [
      usaJson,
      "pm.test('O autor sou eu', () => pm.expect(String(j.author.id)).to.eql(String(pm.collectionVariables.get('userId'))));",
      "pm.test('Começa com 0 curtidas', () => pm.expect(j.likesCount).to.eql(0));",
      "pm.collectionVariables.set('postId', j.id);",
    ],
  },
  {
    op: 'criarPost',
    nome: 'Publicar sem estar logado (erro 401)',
    como: 'ninguem',
    status: 401,
    corpo: `{ "categoryId": {{categoryId}}, "content": "Este post não deve ser criado" }`,
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Autenticação necessária'));"],
  },
  {
    op: 'listarPosts',
    como: 'ninguem',
    query: { page: '1', limit: '10', q: 'compostagem' },
    nota: 'Os filtros `city`, `categoryId` e `authorId` também existem: marque-os na aba Params para testar.',
    depois: [
      usaJson,
      "pm.test('Traz a paginação', () => pm.expect(j.meta).to.have.keys('page', 'limit', 'total', 'totalPages'));",
      "pm.test('Encontra o post que acabei de criar', () => pm.expect(j.data.map(p => String(p.id))).to.include(String(pm.collectionVariables.get('postId'))));",
    ],
  },
  {
    op: 'buscarPost',
    id: '{{postId}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('É o post pedido', () => pm.expect(String(j.id)).to.eql(String(pm.collectionVariables.get('postId'))));"],
  },
  {
    op: 'buscarPost',
    nome: 'Ver um post que não existe (erro 404)',
    id: '999999',
    como: 'ninguem',
    status: 404,
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Post não encontrado'));"],
  },
  {
    op: 'atualizarPost',
    nome: 'Editar um post',
    id: '{{postId}}',
    corpo: { content: 'Atualização: já são 5 kg a menos por semana! 🌱' },
    depois: [usaJson, "pm.test('O texto mudou', () => pm.expect(j.content).to.include('5 kg'));"],
  },
  {
    op: 'atualizarPost',
    nome: 'Editar o post de outra pessoa (erro 403)',
    id: '{{postId}}',
    como: 'segunda',
    status: 403,
    corpo: { content: 'Tentando editar o post de outra pessoa' },
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Você só pode alterar os seus próprios posts'));"],
  },
  {
    op: 'atualizarPost',
    nome: 'Moderação: administrador edita o post de outra pessoa',
    id: '{{postId}}',
    como: 'admin',
    nota: 'Administradores podem moderar qualquer post, por isso aqui a resposta é 200.',
    corpo: { city: 'São Paulo' },
  },
  {
    op: 'excluirPost',
    nome: 'Excluir um post',
    id: '{{postIdExcluir}}',
    nota: 'Antes de enviar, o Postman cria um post temporário só para este teste, para não apagar o `postId` que as outras requisições usam.',
    antes: [
      'pm.sendRequest({',
      "  url: pm.variables.get('baseUrl') + '/api/posts', method: 'POST',",
      "  header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pm.collectionVariables.get('token') },",
      "  body: { mode: 'raw', raw: JSON.stringify({ categoryId: Number(pm.collectionVariables.get('categoryId')), content: 'Post temporário para o teste de exclusão' }) },",
      "}, (erro, resposta) => pm.collectionVariables.set('postIdExcluir', resposta.json().id));",
    ],
  },
  {
    op: 'buscarPost',
    nome: 'Conferir que o post excluído sumiu (erro 404)',
    id: '{{postIdExcluir}}',
    como: 'ninguem',
    status: 404,
  },

  // Interações
  {
    op: 'curtirPost',
    nome: 'Curtir um post',
    id: '{{postId}}',
    depois: [usaJson, "pm.test('Agora está curtido', () => pm.expect(j.liked).to.eql(true));", "pm.test('Tem 1 curtida', () => pm.expect(j.likesCount).to.eql(1));"],
  },
  {
    op: 'curtirPost',
    nome: 'Curtir de novo (remove a curtida)',
    id: '{{postId}}',
    depois: [usaJson, "pm.test('Descurtiu', () => pm.expect(j.liked).to.eql(false));", "pm.test('Voltou a 0 curtidas', () => pm.expect(j.likesCount).to.eql(0));"],
  },
  {
    op: 'comentarPost',
    id: '{{postId}}',
    corpo: { content: 'Que inspirador! Vou começar a minha também.' },
    depois: [usaJson, "pm.test('O comentário é meu', () => pm.expect(String(j.author.id)).to.eql(String(pm.collectionVariables.get('userId'))));", "pm.collectionVariables.set('comentarioId', j.id);"],
  },
  {
    op: 'listarComentarios',
    id: '{{postId}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('Mostra o comentário', () => pm.expect(j.data.length).to.eql(1));"],
  },
  {
    op: 'editarComentario',
    id: '{{comentarioId}}',
    corpo: { content: 'Que inspirador! Já comecei a minha composteira.' },
    depois: [usaJson, "pm.test('O texto mudou', () => pm.expect(j.content).to.eql('Que inspirador! Já comecei a minha composteira.'));", "pm.test('Aparece como editado', () => pm.expect(j.editedAt).to.not.eql(null));"],
  },
  {
    op: 'editarComentario',
    nome: 'Editar o comentário de outra pessoa (erro 403)',
    id: '{{comentarioId}}',
    como: 'segunda',
    corpo: { content: 'Tentando editar o comentário de outra pessoa' },
    status: 403,
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Você só pode editar os seus próprios comentários'));"],
  },
  {
    op: 'editarComentario',
    nome: 'Editar com texto curto demais (erro 400)',
    id: '{{comentarioId}}',
    corpo: { content: 'curto' },
    status: 400,
    depois: [usaJson, "pm.test('Aponta o campo content', () => pm.expect(j.details[0].path).to.eql('content'));"],
  },
  {
    op: 'excluirComentario',
    id: '{{comentarioId}}',
  },

  // Usuários
  {
    op: 'atualizarMeuPerfil',
    corpo: { city: 'Campinas', bio: 'Agora moro em Campinas e ando de bicicleta.' },
    depois: [usaJson, "pm.test('A cidade mudou', () => pm.expect(j.city).to.eql('Campinas'));"],
  },
  {
    op: 'buscarPerfil',
    id: '{{userIdSegunda}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('Não mostra o e-mail', () => pm.expect(j).to.not.have.property('email'));", "pm.test('Tem contadores', () => pm.expect(j).to.include.keys('postsCount', 'followersCount', 'followingCount'));"],
  },
  {
    op: 'seguirUsuario',
    nome: 'Seguir a segunda pessoa',
    id: '{{userIdSegunda}}',
    depois: [usaJson, "pm.test('Agora sigo', () => pm.expect(j.following).to.eql(true));", "pm.test('Ela tem 1 seguidor', () => pm.expect(j.followersCount).to.eql(1));"],
  },
  {
    op: 'seguirUsuario',
    nome: 'Seguir a mim mesmo (erro 400)',
    id: '{{userId}}',
    status: 400,
    depois: [usaJson, "pm.test('Mensagem em português', () => pm.expect(j.message).to.eql('Você não pode seguir a si mesmo'));"],
  },
  {
    op: 'listarSeguidores',
    id: '{{userIdSegunda}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('Eu apareço entre os seguidores', () => pm.expect(j.data.map(u => String(u.id))).to.include(String(pm.collectionVariables.get('userId'))));"],
  },
  {
    op: 'listarSeguindo',
    id: '{{userId}}',
    como: 'ninguem',
    depois: [usaJson, "pm.test('A segunda pessoa aparece em quem sigo', () => pm.expect(j.data.map(u => String(u.id))).to.include(String(pm.collectionVariables.get('userIdSegunda'))));"],
  },
  {
    op: 'excluirMinhaConta',
    como: 'temporaria',
    nota: 'Antes de enviar, o Postman cria uma conta temporária só para este teste (assim nenhuma das outras requisições perde o login).',
    antes: [
      'pm.sendRequest({',
      "  url: pm.variables.get('baseUrl') + '/api/auth/register', method: 'POST',",
      "  header: { 'Content-Type': 'application/json' },",
      "  body: { mode: 'raw', raw: JSON.stringify({ name: 'Conta Temporária', email: 'temporaria.' + Date.now() + '@exemplo.com', password: pm.collectionVariables.get('senhaUsuario') }) },",
      "}, (erro, resposta) => { const r = resposta.json(); pm.collectionVariables.set('tokenTemporaria', r.token); pm.collectionVariables.set('userIdTemporaria', r.user.id); });",
    ],
  },
  {
    op: 'buscarPerfil',
    nome: 'Conferir que a conta excluída sumiu (erro 404)',
    id: '{{userIdTemporaria}}',
    como: 'ninguem',
    status: 404,
  },

  // Feed
  {
    op: 'criarPost',
    nome: 'A segunda pessoa publica um post',
    pasta: 'Feed',
    como: 'segunda',
    nota: 'Para o feed ter o que mostrar, quem eu sigo precisa publicar.',
    corpo: `{ "categoryId": {{categoryId}}, "content": "Troquei o carro pela bicicleta no trajeto até o trabalho! 🚲", "city": "Curitiba" }`,
  },
  {
    op: 'verFeed',
    depois: [usaJson, "pm.test('O feed mostra o post de quem eu sigo', () => pm.expect(j.data.length).to.be.at.least(1));", "pm.test('Todos os posts são da pessoa que sigo', () => j.data.forEach(p => pm.expect(String(p.author.id)).to.eql(String(pm.collectionVariables.get('userIdSegunda')))));"],
  },

  // Ranking e estatísticas
  {
    op: 'verRanking',
    como: 'ninguem',
    query: { limit: '10' },
    depois: [usaJson, "pm.test('É uma lista com posição (rank)', () => { pm.expect(j).to.be.an('array'); if (j.length) pm.expect(j[0].rank).to.eql(1); });"],
  },
  {
    op: 'verEstatisticas',
    como: 'ninguem',
    depois: [usaJson, "pm.test('Traz os totais', () => pm.expect(j).to.have.keys('users', 'posts', 'comments', 'likes', 'categories', 'cities'));"],
  },
];

// ───────────────────────── Montagem da coleção ─────────────────────────

interface Operacao {
  id: string;
  metodo: Metodo;
  caminho: string;
  op: Obj;
}

function todasAsOperacoes(): Operacao[] {
  const lista: Operacao[] = [];
  for (const [caminho, itens] of Object.entries<Obj>(openapi.paths)) {
    for (const metodo of METODOS) {
      const op = itens[metodo];
      if (op) lista.push({ id: op.operationId, metodo, caminho, op });
    }
  }
  return lista;
}

const TOKEN_POR_PAPEL = {
  usuario: '{{token}}',
  admin: '{{adminToken}}',
  segunda: '{{tokenSegunda}}',
  temporaria: '{{tokenTemporaria}}',
} as const;

function statusEsperado(op: Obj): number {
  const codigos = Object.keys(op.responses).map(Number);
  return codigos.find((c) => c >= 200 && c < 300) ?? 200;
}

function descricao(passo: Passo, o: Operacao, status: number): string {
  const linhas: string[] = [];
  linhas.push(`**${o.metodo.toUpperCase()} ${o.caminho}**`, '');
  if (passo.nota) linhas.push(passo.nota, '');
  if (o.op.description) linhas.push(o.op.description, '');
  linhas.push(`Resposta esperada neste teste: **${status}**.`, '', 'Respostas possíveis desta rota:', '');
  for (const [codigo, r] of Object.entries<Obj>(o.op.responses)) {
    const texto = r.$ref ? openapi.components.responses[r.$ref.split('/').pop()!].description : r.description;
    linhas.push(`- \`${codigo}\`: ${texto}`);
  }
  return linhas.join('\n');
}

function montarItem(passo: Passo, o: Operacao): Obj {
  const status = passo.status ?? statusEsperado(o.op);

  // URL: troca {id} pela variável do passo e monta a lista de segmentos
  const caminho = o.caminho.replace('{id}', passo.id ?? '1');
  const segmentos = caminho.split('/').filter(Boolean);

  const parametrosDeQuery: Obj[] = (o.op.parameters ?? []).filter((p: Obj) => p.in === 'query');
  const query = parametrosDeQuery.map((p) => {
    const ativo = passo.query !== undefined && p.name in passo.query;
    const exemplo = p.example ?? p.schema?.default ?? '';
    return {
      key: p.name,
      value: ativo ? passo.query![p.name] : String(exemplo),
      description: p.description,
      disabled: !ativo,
    };
  });
  const textoQuery = query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&');

  const como = passo.como ?? (o.op.security ? 'usuario' : 'ninguem');
  const auth =
    como === 'ninguem'
      ? { type: 'noauth' }
      : { type: 'bearer', bearer: [{ key: 'token', value: TOKEN_POR_PAPEL[como], type: 'string' }] };

  const requisicao: Obj = {
    method: o.metodo.toUpperCase(),
    header: [],
    auth,
    url: {
      raw: `{{baseUrl}}/${segmentos.join('/')}${textoQuery ? `?${textoQuery}` : ''}`,
      host: ['{{baseUrl}}'],
      path: segmentos,
      ...(query.length ? { query } : {}),
    },
    description: descricao(passo, o, status),
  };

  if (o.op.requestBody) {
    const exemplo = o.op.requestBody.content['application/json'].example;
    const corpo = passo.corpo ?? exemplo;
    requisicao.header = [{ key: 'Content-Type', value: 'application/json' }];
    requisicao.body = {
      mode: 'raw',
      raw: typeof corpo === 'string' ? corpo : JSON.stringify(corpo, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  const testes = [
    `pm.test('Status ${status}', () => pm.response.to.have.status(${status}));`,
    ...(status === 204 ? [] : ["pm.test('A resposta é JSON', () => pm.response.to.be.json);"]),
    ...(passo.depois ?? []),
  ];

  const eventos: Obj[] = [];
  if (passo.antes) eventos.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: passo.antes } });
  eventos.push({ listen: 'test', script: { type: 'text/javascript', exec: testes } });

  return {
    name: passo.nome ?? o.op.summary,
    event: eventos,
    request: requisicao,
    response: [],
  };
}

export function gerarColecao(): Obj {
  const operacoes = new Map(todasAsOperacoes().map((o) => [o.id, o]));

  // Garante que a coleção cobre TODAS as rotas documentadas
  const usadas = new Set(FLUXO.map((p) => p.op));
  for (const passo of FLUXO) {
    if (!operacoes.has(passo.op)) throw new Error(`Passo do Postman aponta para uma rota que não existe no OpenAPI: ${passo.op}`);
  }
  for (const id of operacoes.keys()) {
    if (!usadas.has(id)) throw new Error(`A rota ${id} está no OpenAPI, mas não tem nenhum passo na coleção do Postman (src/docs/postman.ts).`);
  }

  // Agrupa em pastas, mantendo a ordem de uso. Pastas aparecem na ordem da primeira vez que são citadas.
  const pastas = new Map<string, Obj[]>();
  for (const passo of FLUXO) {
    const o = operacoes.get(passo.op)!;
    const pasta = passo.pasta ?? (o.op.tags[0] as string);
    if (!pastas.has(pasta)) pastas.set(pasta, []);
    pastas.get(pasta)!.push(montarItem(passo, o));
  }

  const descricaoDasPastas = new Map<string, string>(openapi.tags.map((t: Obj) => [t.name, t.description]));

  return {
    info: {
      name: 'EcoMedia API',
      description: [
        'Coleção de testes da **API EcoMedia**, a rede social de ações sustentáveis (ODS 11 da ONU).',
        '',
        '## Como usar',
        '',
        '1. A variável `baseUrl` (aba **Variables** da coleção) aponta para a API. Por padrão é `http://localhost:3333`; troque pelo endereço da API publicada, se for o caso.',
        '2. Para rodar tudo de uma vez, clique com o botão direito na coleção → **Run collection**. As requisições estão em ordem e cada uma tem testes automáticos.',
        '3. Para testar uma de cada vez, comece por **Autenticação → Criar uma conta**: o token é guardado sozinho e as próximas requisições já o usam.',
        '',
        'As variáveis `token`, `adminToken`, `postId` e outras são preenchidas automaticamente pelas próprias requisições.',
        'As requisições com "(erro 4xx)" no nome existem de propósito, para mostrar as mensagens de erro em português.',
        '',
        'A documentação completa está no Swagger: `{{baseUrl}}/api-docs`.',
      ].join('\n'),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3333' },
      { key: 'senhaUsuario', value: 'Senha12345' },
      { key: 'adminEmail', value: 'admin@ecomedia.dev' },
      { key: 'adminPassword', value: 'Admin12345' },
      { key: 'token', value: '' },
      { key: 'adminToken', value: '' },
      { key: 'tokenSegunda', value: '' },
      { key: 'tokenTemporaria', value: '' },
      { key: 'userIdTemporaria', value: '' },
    ],
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
    item: [...pastas.entries()].map(([name, item]) => ({
      name,
      ...(descricaoDasPastas.get(name) ? { description: descricaoDasPastas.get(name) } : {}),
      item,
    })),
  };
}
