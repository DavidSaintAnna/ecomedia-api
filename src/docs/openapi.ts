// Documentação OpenAPI 3 da API EcoMedia, escrita à mão e em português.
//
// Este arquivo é a ÚNICA fonte da documentação. Dele saem:
//   - a página interativa do Swagger UI (rota /api-docs);
//   - o arquivo docs/openapi.json (rota /api-docs.json);
//   - a coleção do Postman (npm run docs:postman).
//
// Os nomes dos campos do JSON (name, content, city...) ficam em inglês porque são o "contrato"
// da API. Tudo o que a pessoa lê (títulos, descrições, mensagens de erro) está em português.

export type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ───────────────────────── Peças reutilizáveis ─────────────────────────

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });
const refResposta = (nome: string) => ({ $ref: `#/components/responses/${nome}` });
const conteudo = (schema: Obj, example?: unknown) => ({
  'application/json': { schema, ...(example !== undefined ? { example } : {}) },
});
const resposta = (description: string, schema: Obj, example?: unknown) => ({
  description,
  content: conteudo(schema, example),
});

const parametroId = (descricao: string): Obj => ({
  name: 'id',
  in: 'path',
  required: true,
  description: descricao,
  schema: { type: 'integer', minimum: 1, example: 1 },
});

const parametrosPaginacao: Obj[] = [
  {
    name: 'page',
    in: 'query',
    description: 'Número da página (começa em 1).',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'limit',
    in: 'query',
    description: 'Itens por página (de 1 a 50).',
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
  },
];

const exigeLogin = [{ bearerAuth: [] }];

const exemploPost = {
  id: 1,
  content: 'Comecei a compostagem em casa: já são 3 kg de lixo orgânico a menos por semana! 🌱',
  imageUrl: 'https://exemplo.com/fotos/composteira.jpg',
  city: 'São Paulo',
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-15T14:30:00.000Z',
  author: { id: 2, name: 'Ana Souza', avatarUrl: null },
  category: { id: 6, name: 'Redução de Resíduos' },
  likesCount: 4,
  commentsCount: 1,
  likedByMe: false,
};

const exemploUsuario = {
  id: 2,
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  role: 'USER',
  city: 'São Paulo',
  bio: 'Apaixonada por compostagem e bicicleta.',
  avatarUrl: null,
  createdAt: '2026-11-15T14:00:00.000Z',
};

const exemploPerfil = {
  id: 2,
  name: 'Ana Souza',
  city: 'São Paulo',
  bio: 'Apaixonada por compostagem e bicicleta.',
  avatarUrl: null,
  createdAt: '2026-11-15T14:00:00.000Z',
  postsCount: 3,
  followersCount: 5,
  followingCount: 2,
  followedByMe: false,
};

const exemploMeta = { page: 1, limit: 10, total: 1, totalPages: 1 };

const tokenExemplo =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6IjIiLCJpYXQiOjE3NjMyMTUyMDAsImV4cCI6MTc2MzgyMDAwMH0.assinatura-de-exemplo';

// ───────────────────────── Documento principal ─────────────────────────

export const openapi: Obj = {
  openapi: '3.0.3',
  info: {
    title: 'API EcoMedia',
    version: '1.0.0',
    description: [
      'A **EcoMedia** é uma rede social em que as pessoas de uma cidade compartilham ações sustentáveis do dia a dia:',
      'compostagem, reciclagem, economia de água e energia, mobilidade, consumo consciente e mais.',
      'Ela responde ao **Objetivo de Desenvolvimento Sustentável 11 da ONU — Cidades e Comunidades Sustentáveis**.',
      '',
      '## Como testar em 1 minuto',
      '',
      '1. Abra **Autenticação → `POST /api/auth/register`**, clique em **Testar** e depois em **Executar** (o exemplo já vem preenchido; troque o e-mail por um seu).',
      '2. Copie o valor do campo `token` da resposta.',
      '3. Clique no botão **Autorizar** (cadeado, no topo da página), cole o token e confirme.',
      '4. Pronto! Agora você pode testar as rotas protegidas (cadeado fechado), como criar posts, curtir e comentar.',
      '',
      '## Convenções',
      '',
      '- **Formato**: todas as requisições e respostas usam JSON (`Content-Type: application/json`).',
      '- **Autenticação**: o login devolve um token JWT. Nas rotas protegidas, envie o cabeçalho `Authorization: Bearer <token>`. O token vale 7 dias.',
      '- **Idioma**: as mensagens de erro vêm em português (campo `message`). O campo `error` é um código fixo em inglês, ideal para o código do front-end decidir o que fazer (`ValidationError`, `Unauthorized`, `NotFound`...).',
      '- **Paginação**: as listas devolvem `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`. Use `?page=` e `?limit=` (máximo de 50 por página).',
      '- **Limite de uso**: 300 requisições a cada 15 minutos por IP (50 nas rotas de cadastro e login). Ao exceder, a API responde `429`.',
      '- **Erros de validação** (`400`) trazem a lista `details`, indicando qual campo está errado e por quê.',
      '',
      '## Perfis de acesso',
      '',
      '- **Visitante** (sem login): lê posts, categorias, comentários, perfis, ranking e estatísticas.',
      '- **Usuário** (`USER`): tudo acima, mais criar/editar/excluir os próprios posts e comentários, curtir e seguir.',
      '- **Administrador** (`ADMIN`): tudo acima, mais gerenciar categorias e moderar (excluir) posts e comentários de qualquer pessoa.',
      '  Quem se cadastra pela API sempre vira `USER`; o administrador é criado pelo comando de seed.',
    ].join('\n'),
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [{ url: '/', description: 'Servidor atual (o mesmo endereço desta página)' }],
  tags: [
    { name: 'Sistema', description: 'Rotas para conferir se a API está no ar.' },
    { name: 'Autenticação', description: 'Cadastro, login e dados de quem está logado.' },
    { name: 'Categorias', description: 'Tipos de ação sustentável (Reciclagem, Energia, Água...). A leitura é pública; criar, editar e excluir é só para administradores.' },
    { name: 'Posts', description: 'Publicações de ações sustentáveis. A leitura é pública; escrever exige login.' },
    { name: 'Interações', description: 'Curtidas e comentários nos posts.' },
    { name: 'Imagens', description: 'Fotos enviadas do computador (foto de perfil e imagem de publicação). Ficam guardadas no banco de dados.' },
    { name: 'Usuários', description: 'Perfis públicos, edição do próprio perfil e seguir/deixar de seguir.' },
    { name: 'Feed', description: 'Linha do tempo com os posts de quem você segue.' },
    { name: 'Ranking e estatísticas', description: 'Quem mais inspira a comunidade e os números gerais da rede.' },
  ],

  // ───────────────────────── Rotas ─────────────────────────
  paths: {
    '/': {
      get: {
        tags: ['Sistema'],
        operationId: 'infoApi',
        summary: 'Informações da API',
        description: 'Devolve o nome da API e os caminhos da documentação e da verificação de saúde.',
        responses: {
          200: resposta('Informações básicas.', { type: 'object' }, {
            name: 'EcoMedia API',
            docs: '/api-docs',
            health: '/api/health',
          }),
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Sistema'],
        operationId: 'verificarSaude',
        summary: 'Verificar se a API está no ar',
        description: 'Não consulta o banco e não conta no limite de requisições. Útil para monitoramento e para a hospedagem.',
        responses: {
          200: resposta('A API está funcionando.', { type: 'object', properties: { status: { type: 'string', example: 'ok' } } }, { status: 'ok' }),
        },
      },
    },

    // ── Autenticação ──
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        operationId: 'cadastrarUsuario',
        summary: 'Criar uma conta',
        description:
          'Cadastra uma pessoa nova e já devolve o token de acesso, então não é preciso fazer login em seguida. ' +
          'A conta sempre nasce com o perfil `USER`. A senha é guardada com hash (bcrypt) e nunca é devolvida.',
        requestBody: {
          required: true,
          content: conteudo(ref('CadastroEntrada'), {
            name: 'Ana Souza',
            email: 'ana@exemplo.com',
            password: 'Senha12345',
            city: 'São Paulo',
            bio: 'Apaixonada por compostagem e bicicleta.',
          }),
        },
        responses: {
          201: resposta('Conta criada.', ref('RespostaAuth'), { user: exemploUsuario, token: tokenExemplo }),
          400: refResposta('DadosInvalidos'),
          409: resposta('Já existe uma conta com este e-mail.', ref('Erro'), { error: 'Conflict', message: 'E-mail já cadastrado' }),
          429: refResposta('MuitasRequisicoes'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        operationId: 'entrar',
        summary: 'Entrar (fazer login)',
        description: 'Confere e-mail e senha e devolve o token JWT. Por segurança, a mensagem de erro é a mesma quando o e-mail não existe ou a senha está errada.',
        requestBody: {
          required: true,
          content: conteudo(ref('LoginEntrada'), { email: 'ana@exemplo.com', password: 'Senha12345' }),
        },
        responses: {
          200: resposta('Login feito.', ref('RespostaAuth'), { user: exemploUsuario, token: tokenExemplo }),
          400: refResposta('DadosInvalidos'),
          401: resposta('E-mail ou senha incorretos.', ref('Erro'), { error: 'Unauthorized', message: 'E-mail ou senha inválidos' }),
          429: refResposta('MuitasRequisicoes'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        operationId: 'meuUsuario',
        summary: 'Ver os dados de quem está logado',
        description: 'Devolve a conta dona do token enviado. O front-end usa esta rota para recuperar a sessão ao recarregar a página.',
        security: exigeLogin,
        responses: {
          200: resposta('Dados da conta.', ref('Usuario'), exemploUsuario),
          401: refResposta('NaoAutenticado'),
          404: resposta('A conta do token foi excluída.', ref('Erro'), { error: 'NotFound', message: 'Usuário não existe mais' }),
        },
      },
    },

    // ── Categorias ──
    '/api/categories': {
      get: {
        tags: ['Categorias'],
        operationId: 'listarCategorias',
        summary: 'Listar as categorias',
        description:
          'Lista todas as categorias, sem paginação (são poucas). Use o `id` de uma categoria ao criar um post. ' +
          'A ordenação vem do banco de dados; se precisar de ordem alfabética perfeita em português (por exemplo, "Água" junto do "A"), ordene no front-end com `localeCompare("pt-BR")`.',
        responses: {
          200: resposta('Lista de categorias.', { type: 'array', items: ref('Categoria') }, [
            { id: 4, name: 'Energia', description: 'Economia de energia e uso de fontes limpas' },
            { id: 2, name: 'Hortas Urbanas', description: 'Hortas comunitárias, telhados verdes e plantas na varanda' },
          ]),
        },
      },
      post: {
        tags: ['Categorias'],
        operationId: 'criarCategoria',
        summary: 'Criar uma categoria (administrador)',
        security: exigeLogin,
        requestBody: {
          required: true,
          content: conteudo(ref('CategoriaEntrada'), { name: 'Educação Ambiental', description: 'Palestras, oficinas e campanhas de conscientização.' }),
        },
        responses: {
          201: resposta('Categoria criada.', ref('Categoria'), { id: 8, name: 'Educação Ambiental', description: 'Palestras, oficinas e campanhas de conscientização.' }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: refResposta('SemPermissao'),
          409: resposta('Já existe uma categoria com este nome.', ref('Erro'), { error: 'Conflict', message: 'Categoria já existe' }),
        },
      },
    },
    '/api/categories/{id}': {
      get: {
        tags: ['Categorias'],
        operationId: 'buscarCategoria',
        summary: 'Ver uma categoria',
        parameters: [parametroId('Número (id) da categoria.')],
        responses: {
          200: resposta('A categoria.', ref('Categoria'), { id: 1, name: 'Reciclagem', description: 'Separação, reaproveitamento e reciclagem de materiais' }),
          400: refResposta('DadosInvalidos'),
          404: refResposta('NaoEncontrado'),
        },
      },
      put: {
        tags: ['Categorias'],
        operationId: 'atualizarCategoria',
        summary: 'Atualizar uma categoria (administrador)',
        description: 'Substitui o nome e a descrição da categoria.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) da categoria.')],
        requestBody: {
          required: true,
          content: conteudo(ref('CategoriaEntrada'), { name: 'Educação Ambiental e Cidadania', description: 'Palestras, oficinas e campanhas de conscientização.' }),
        },
        responses: {
          200: resposta('Categoria atualizada.', ref('Categoria'), { id: 8, name: 'Educação Ambiental e Cidadania', description: 'Palestras, oficinas e campanhas de conscientização.' }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: refResposta('SemPermissao'),
          404: refResposta('NaoEncontrado'),
        },
      },
      delete: {
        tags: ['Categorias'],
        operationId: 'excluirCategoria',
        summary: 'Excluir uma categoria (administrador)',
        description: 'Só é possível excluir categorias que não tenham posts. Se houver posts, a API responde `409`.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) da categoria.')],
        responses: {
          204: { description: 'Categoria excluída (sem corpo na resposta).' },
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: refResposta('SemPermissao'),
          404: refResposta('NaoEncontrado'),
          409: resposta('A categoria está em uso por posts.', ref('Erro'), {
            error: 'Conflict',
            message: 'Este registro está sendo usado por outros dados e não pode ser removido',
          }),
        },
      },
    },

    // ── Posts ──
    '/api/posts': {
      get: {
        tags: ['Posts'],
        operationId: 'listarPosts',
        summary: 'Listar posts (com busca e filtros)',
        description:
          'Lista os posts, do mais novo para o mais antigo, com paginação. Todos os filtros são opcionais e podem ser combinados. ' +
          'Se você enviar o token, o campo `likedByMe` indica se você já curtiu cada post; sem token, ele vem sempre `false`.',
        parameters: [
          ...parametrosPaginacao,
          { name: 'q', in: 'query', description: 'Busca por texto dentro do conteúdo do post (sem diferenciar maiúsculas de minúsculas).', schema: { type: 'string' }, example: 'compostagem' },
          { name: 'city', in: 'query', description: 'Filtra pela cidade (aceita parte do nome).', schema: { type: 'string' }, example: 'São Paulo' },
          { name: 'categoryId', in: 'query', description: 'Filtra por categoria (use o `id` de /api/categories).', schema: { type: 'integer', minimum: 1 } },
          { name: 'authorId', in: 'query', description: 'Filtra pelos posts de uma pessoa (use o `id` do usuário).', schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          200: resposta('Página de posts.', ref('PaginaDePosts'), { data: [exemploPost], meta: exemploMeta }),
          400: refResposta('DadosInvalidos'),
        },
      },
      post: {
        tags: ['Posts'],
        operationId: 'criarPost',
        summary: 'Publicar um post',
        description: 'Se `city` não for enviada, o post usa a cidade do perfil de quem publica. A `imageUrl` aceita apenas links `http://` ou `https://`.',
        security: exigeLogin,
        requestBody: {
          required: true,
          content: conteudo(ref('PostEntrada'), {
            categoryId: 6,
            content: 'Comecei a compostagem em casa: já são 3 kg de lixo orgânico a menos por semana! 🌱',
            imageUrl: 'https://exemplo.com/fotos/composteira.jpg',
            city: 'São Paulo',
          }),
        },
        responses: {
          201: resposta('Post publicado.', ref('Post'), exemploPost),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
        },
      },
    },
    '/api/posts/{id}': {
      get: {
        tags: ['Posts'],
        operationId: 'buscarPost',
        summary: 'Ver um post',
        parameters: [parametroId('Número (id) do post.')],
        responses: {
          200: resposta('O post.', ref('Post'), exemploPost),
          400: refResposta('DadosInvalidos'),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
      patch: {
        tags: ['Posts'],
        operationId: 'atualizarPost',
        summary: 'Editar um post',
        description: 'Só o autor do post (ou um administrador) pode editar. Envie apenas os campos que quer mudar; `imageUrl` e `city` aceitam `null` para limpar o valor.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do post.')],
        requestBody: {
          required: true,
          content: conteudo(ref('PostAtualizacao'), { content: 'Atualização: já são 5 kg a menos por semana! 🌱' }),
        },
        responses: {
          200: resposta('Post atualizado.', ref('Post'), { ...exemploPost, content: 'Atualização: já são 5 kg a menos por semana! 🌱' }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: resposta('O post é de outra pessoa.', ref('Erro'), { error: 'Forbidden', message: 'Você só pode alterar os seus próprios posts' }),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
      delete: {
        tags: ['Posts'],
        operationId: 'excluirPost',
        summary: 'Excluir um post',
        description: 'Só o autor (ou um administrador) pode excluir. As curtidas e os comentários do post são excluídos junto.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do post.')],
        responses: {
          204: { description: 'Post excluído (sem corpo na resposta).' },
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: resposta('O post é de outra pessoa.', ref('Erro'), { error: 'Forbidden', message: 'Você só pode alterar os seus próprios posts' }),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
    },

    // ── Interações ──
    '/api/posts/{id}/like': {
      post: {
        tags: ['Interações'],
        operationId: 'curtirPost',
        summary: 'Curtir ou descurtir um post',
        description: 'Funciona como um interruptor: a primeira chamada curte (`liked: true`), a segunda remove a curtida (`liked: false`).',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do post.')],
        responses: {
          200: resposta('Estado da curtida depois da chamada.', ref('RespostaCurtida'), { liked: true, likesCount: 5 }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
    },
    '/api/posts/{id}/comments': {
      get: {
        tags: ['Interações'],
        operationId: 'listarComentarios',
        summary: 'Listar os comentários de um post',
        description: 'Do mais antigo para o mais novo, com paginação.',
        parameters: [parametroId('Número (id) do post.'), ...parametrosPaginacao],
        responses: {
          200: resposta('Página de comentários.', ref('PaginaDeComentarios'), {
            data: [
              {
                id: 1,
                postId: 1,
                content: 'Que inspirador! Vou começar a minha também.',
                createdAt: '2026-11-15T15:00:00.000Z',
                editedAt: null,
                author: { id: 3, name: 'Bruno Lima', avatarUrl: null },
              },
            ],
            meta: exemploMeta,
          }),
          400: refResposta('DadosInvalidos'),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
      post: {
        tags: ['Interações'],
        operationId: 'comentarPost',
        summary: 'Comentar em um post',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do post.')],
        requestBody: {
          required: true,
          content: conteudo(ref('ComentarioEntrada'), { content: 'Que inspirador! Vou começar a minha também.' }),
        },
        responses: {
          201: resposta('Comentário publicado.', ref('Comentario'), {
            id: 1,
            postId: 1,
            content: 'Que inspirador! Vou começar a minha também.',
            createdAt: '2026-11-15T15:00:00.000Z',
            editedAt: null,
            author: { id: 3, name: 'Bruno Lima', avatarUrl: null },
          }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          404: resposta('Post não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Post não encontrado' }),
        },
      },
    },
    '/api/images': {
      post: {
        tags: ['Imagens'],
        operationId: 'enviarImagem',
        summary: 'Enviar uma foto do computador',
        description:
          'Envie os bytes da imagem direto no corpo da requisição, com o `Content-Type` igual ao tipo do arquivo (`image/png`, `image/jpeg` ou `image/webp`). A API confere o conteúdo do arquivo, não só o nome. Tamanho máximo: 512 KB (o site já reduz a foto antes de enviar). Cada pessoa pode ter até 20 imagens; as que deixam de ser usadas são apagadas sozinhas. A resposta traz o `url` para colocar em `avatarUrl` (PATCH /api/users/me) ou `imageUrl` (post).',
        security: exigeLogin,
        requestBody: {
          required: true,
          content: {
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        responses: {
          201: resposta('Imagem guardada.', ref('ImagemEnviada'), {
            id: 7,
            contentType: 'image/webp',
            size: 48213,
            url: 'https://ecomedia-api.onrender.com/api/images/7',
          }),
          401: refResposta('NaoAutenticado'),
          409: resposta('A pessoa já tem 20 imagens guardadas.', ref('Erro'), {
            error: 'Conflict',
            message: 'Você chegou ao limite de 20 imagens. Exclua publicações antigas com foto ou troque a foto do perfil e tente de novo',
          }),
          413: resposta('Imagem maior que 512 KB.', ref('Erro'), {
            error: 'PayloadTooLarge',
            message: 'A imagem é grande demais (máximo de 512 KB)',
          }),
          415: resposta('Não é um PNG, JPEG ou WebP válido (SVG e outros formatos são recusados).', ref('Erro'), {
            error: 'UnsupportedMediaType',
            message: 'O arquivo não é uma imagem PNG, JPEG ou WebP válida',
          }),
        },
      },
    },
    '/api/images/{id}': {
      get: {
        tags: ['Imagens'],
        operationId: 'verImagem',
        summary: 'Ver uma imagem enviada',
        description: 'Pública: não precisa de login, então pode ser usada direto numa tag `<img>`. O navegador guarda a imagem por um ano (ela nunca muda sob o mesmo número).',
        parameters: [parametroId('Número (id) da imagem.')],
        responses: {
          200: {
            description: 'Os bytes da imagem.',
            content: {
              'image/png': { schema: { type: 'string', format: 'binary' } },
              'image/jpeg': { schema: { type: 'string', format: 'binary' } },
              'image/webp': { schema: { type: 'string', format: 'binary' } },
            },
          },
          400: refResposta('DadosInvalidos'),
          404: resposta('Imagem não encontrada.', ref('Erro'), { error: 'NotFound', message: 'Imagem não encontrada' }),
        },
      },
    },
    '/api/comments/{id}': {
      patch: {
        tags: ['Interações'],
        operationId: 'editarComentario',
        summary: 'Editar um comentário',
        description:
          'Só quem escreveu o comentário pode editar (o administrador pode excluir, mas não reescrever o que outra pessoa disse). O texto novo segue a mesma regra de quando se comenta: de 10 a 500 caracteres. Depois de editar, `editedAt` mostra quando foi. Enviar o mesmo texto de novo não muda nada.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do comentário.')],
        requestBody: {
          required: true,
          content: conteudo(ref('ComentarioEntrada'), { content: 'Que inspirador! Já comecei a minha composteira.' }),
        },
        responses: {
          200: resposta('Comentário atualizado.', ref('Comentario'), {
            id: 1,
            postId: 1,
            content: 'Que inspirador! Já comecei a minha composteira.',
            createdAt: '2026-11-15T15:00:00.000Z',
            editedAt: '2026-11-15T16:30:00.000Z',
            author: { id: 3, name: 'Bruno Lima', avatarUrl: null },
          }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: resposta('O comentário é de outra pessoa.', ref('Erro'), {
            error: 'Forbidden',
            message: 'Você só pode editar os seus próprios comentários',
          }),
          404: resposta('Comentário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Comentário não encontrado' }),
        },
      },
      delete: {
        tags: ['Interações'],
        operationId: 'excluirComentario',
        summary: 'Excluir um comentário',
        description: 'Só quem escreveu o comentário (ou um administrador) pode excluir.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do comentário.')],
        responses: {
          204: { description: 'Comentário excluído (sem corpo na resposta).' },
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
          403: resposta('O comentário é de outra pessoa.', ref('Erro'), {
            error: 'Forbidden',
            message: 'Você só pode excluir os seus próprios comentários',
          }),
          404: resposta('Comentário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Comentário não encontrado' }),
        },
      },
    },

    // ── Usuários ──
    '/api/users/me': {
      patch: {
        tags: ['Usuários'],
        operationId: 'atualizarMeuPerfil',
        summary: 'Editar o meu perfil',
        description: 'Envie apenas os campos que quer mudar. `city`, `bio` e `avatarUrl` aceitam `null` para limpar o valor. O e-mail e a senha não podem ser alterados por aqui.',
        security: exigeLogin,
        requestBody: {
          required: true,
          content: conteudo(ref('PerfilAtualizacao'), { city: 'Curitiba', bio: 'Agora moro em Curitiba e ando de bicicleta.' }),
        },
        responses: {
          200: resposta('Perfil atualizado.', ref('Perfil'), { ...exemploPerfil, city: 'Curitiba', bio: 'Agora moro em Curitiba e ando de bicicleta.' }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
        },
      },
      delete: {
        tags: ['Usuários'],
        operationId: 'excluirMinhaConta',
        summary: 'Excluir a minha conta',
        description:
          'Apaga a sua conta **e tudo o que ela criou**: posts, comentários, curtidas e quem você segue ou te segue. Não dá para desfazer. O conteúdo das outras pessoas continua. O único administrador não pode excluir a própria conta.',
        security: exigeLogin,
        responses: {
          204: { description: 'Conta excluída (sem corpo na resposta). O token deixa de funcionar.' },
          401: refResposta('NaoAutenticado'),
          404: resposta('A conta já não existe (por exemplo, já foi excluída).', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
          409: resposta('Você é o único administrador.', ref('Erro'), {
            error: 'Conflict',
            message: 'Você é o único administrador, então a sua conta não pode ser excluída',
          }),
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Usuários'],
        operationId: 'buscarPerfil',
        summary: 'Ver o perfil público de uma pessoa',
        description: 'Nunca mostra e-mail nem senha. Com o token enviado, `followedByMe` indica se você segue a pessoa.',
        parameters: [parametroId('Número (id) do usuário.')],
        responses: {
          200: resposta('O perfil.', ref('Perfil'), exemploPerfil),
          400: refResposta('DadosInvalidos'),
          404: resposta('Usuário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
        },
      },
      delete: {
        tags: ['Usuários'],
        operationId: 'excluirUsuario',
        summary: 'Excluir a conta de outra pessoa (administrador)',
        description:
          'Só administrador. Apaga a conta **e tudo o que ela criou** (posts, comentários, curtidas, quem ela segue e quem a segue, imagens). Não dá para desfazer. Não serve para a sua própria conta (use `DELETE /api/users/me`) nem para a de outro administrador.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do usuário a excluir.')],
        responses: {
          204: { description: 'Conta excluída (sem corpo na resposta).' },
          400: resposta('Número inválido, ou tentou excluir a própria conta por aqui.', ref('Erro'), {
            error: 'BadRequest',
            message: 'Para excluir a sua própria conta, use a opção em Minha conta',
          }),
          401: refResposta('NaoAutenticado'),
          403: resposta('Quem chamou não é administrador, ou o alvo é outro administrador.', ref('Erro'), {
            error: 'Forbidden',
            message: 'Só administradores podem excluir a conta de outra pessoa',
          }),
          404: resposta('Usuário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
        },
      },
    },
    '/api/users/{id}/follow': {
      post: {
        tags: ['Usuários'],
        operationId: 'seguirUsuario',
        summary: 'Seguir ou deixar de seguir uma pessoa',
        description: 'Funciona como um interruptor: a primeira chamada segue (`following: true`), a segunda deixa de seguir. Não é possível seguir a si mesmo.',
        security: exigeLogin,
        parameters: [parametroId('Número (id) do usuário.')],
        responses: {
          200: resposta('Estado depois da chamada.', ref('RespostaSeguir'), { following: true, followersCount: 6 }),
          400: resposta('Tentou seguir a si mesmo ou o número é inválido.', ref('Erro'), { error: 'BadRequest', message: 'Você não pode seguir a si mesmo' }),
          401: refResposta('NaoAutenticado'),
          404: resposta('Usuário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
        },
      },
    },
    '/api/users/{id}/followers': {
      get: {
        tags: ['Usuários'],
        operationId: 'listarSeguidores',
        summary: 'Listar quem segue a pessoa',
        description: 'Os seguidores mais recentes primeiro, com paginação.',
        parameters: [parametroId('Número (id) do usuário.'), ...parametrosPaginacao],
        responses: {
          200: resposta('Página de pessoas.', ref('PaginaDeUsuarios'), {
            data: [{ id: 3, name: 'Bruno Lima', city: 'Curitiba', avatarUrl: null }],
            meta: exemploMeta,
          }),
          400: refResposta('DadosInvalidos'),
          404: resposta('Usuário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
        },
      },
    },
    '/api/users/{id}/following': {
      get: {
        tags: ['Usuários'],
        operationId: 'listarSeguindo',
        summary: 'Listar quem a pessoa segue',
        description: 'Quem foi seguido por último aparece primeiro, com paginação.',
        parameters: [parametroId('Número (id) do usuário.'), ...parametrosPaginacao],
        responses: {
          200: resposta('Página de pessoas.', ref('PaginaDeUsuarios'), {
            data: [{ id: 3, name: 'Bruno Lima', city: 'Curitiba', avatarUrl: null }],
            meta: exemploMeta,
          }),
          400: refResposta('DadosInvalidos'),
          404: resposta('Usuário não encontrado.', ref('Erro'), { error: 'NotFound', message: 'Usuário não encontrado' }),
        },
      },
    },

    // ── Feed ──
    '/api/feed': {
      get: {
        tags: ['Feed'],
        operationId: 'verFeed',
        summary: 'Ver o meu feed',
        description: 'Os posts das pessoas que você segue, do mais novo para o mais antigo. Se você ainda não segue ninguém, a lista vem vazia.',
        security: exigeLogin,
        parameters: parametrosPaginacao,
        responses: {
          200: resposta('Página de posts.', ref('PaginaDePosts'), { data: [exemploPost], meta: exemploMeta }),
          400: refResposta('DadosInvalidos'),
          401: refResposta('NaoAutenticado'),
        },
      },
    },

    // ── Ranking e estatísticas ──
    '/api/leaderboard': {
      get: {
        tags: ['Ranking e estatísticas'],
        operationId: 'verRanking',
        summary: 'Ranking de quem mais inspira a comunidade',
        description: 'Ordena as pessoas pelo total de curtidas recebidas nos próprios posts (empate: quem tem mais posts). Só aparece quem já publicou.',
        parameters: [
          { name: 'limit', in: 'query', description: 'Quantas pessoas mostrar (de 1 a 50).', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          { name: 'city', in: 'query', description: 'Mostra só as pessoas de uma cidade (aceita parte do nome).', schema: { type: 'string' }, example: 'São Paulo' },
        ],
        responses: {
          200: resposta('Ranking.', { type: 'array', items: ref('ItemDoRanking') }, [
            { rank: 1, id: 2, name: 'Ana Souza', city: 'São Paulo', avatarUrl: null, postsCount: 3, likesReceived: 12 },
          ]),
          400: refResposta('DadosInvalidos'),
        },
      },
    },
    '/api/stats': {
      get: {
        tags: ['Ranking e estatísticas'],
        operationId: 'verEstatisticas',
        summary: 'Números gerais da rede',
        description: 'Totais públicos, pensados para a página inicial do site.',
        responses: {
          200: resposta('Estatísticas.', ref('Estatisticas'), { users: 42, posts: 130, comments: 310, likes: 980, categories: 7, cities: 9 }),
        },
      },
    },
  },

  // ───────────────────────── Componentes ─────────────────────────
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token JWT devolvido por `POST /api/auth/register` ou `POST /api/auth/login`. ' +
          'Cole apenas o token (sem a palavra "Bearer"); a página já envia o cabeçalho `Authorization: Bearer <token>`.',
      },
    },

    responses: {
      DadosInvalidos: resposta(
        'Dados inválidos. A lista `details` diz qual campo está errado (`path`) e o motivo (`message`).',
        ref('ErroDeValidacao'),
        {
          error: 'ValidationError',
          message: 'Dados da requisição inválidos',
          details: [{ path: 'password', message: 'Pequeno demais: esperava que o texto tivesse >= 8 caracteres' }],
        },
      ),
      NaoAutenticado: resposta('Faltou o token, ou ele é inválido ou expirou. Faça login de novo.', ref('Erro'), {
        error: 'Unauthorized',
        message: 'Autenticação necessária',
      }),
      SemPermissao: resposta('Você está logado, mas não tem permissão para esta ação.', ref('Erro'), {
        error: 'Forbidden',
        message: 'Você não tem permissão para fazer isso',
      }),
      NaoEncontrado: resposta('O recurso não existe.', ref('Erro'), { error: 'NotFound', message: 'Categoria não encontrada' }),
      MuitasRequisicoes: resposta('Limite de requisições excedido. Espere alguns minutos.', ref('Erro'), {
        error: 'TooManyRequests',
        message: 'Muitas requisições. Tente novamente mais tarde',
      }),
    },

    schemas: {
      Erro: {
        type: 'object',
        description: 'Formato de todo erro da API.',
        properties: {
          error: { type: 'string', description: 'Código fixo em inglês, para o código do front-end.', example: 'NotFound' },
          message: { type: 'string', description: 'Mensagem em português, para mostrar à pessoa.', example: 'Post não encontrado' },
        },
      },
      ErroDeValidacao: {
        type: 'object',
        description: 'Erro 400 de validação, com o detalhe campo a campo.',
        properties: {
          error: { type: 'string', example: 'ValidationError' },
          message: { type: 'string', example: 'Dados da requisição inválidos' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Nome do campo com problema.', example: 'email' },
                message: { type: 'string', description: 'O que está errado, em português.', example: 'Formato do endereço de e-mail inválido' },
              },
            },
          },
        },
      },

      Usuario: {
        type: 'object',
        description: 'Conta de quem está logado (inclui o e-mail, que nunca aparece em perfis públicos).',
        properties: {
          id: { type: 'integer', example: 2 },
          name: { type: 'string', example: 'Ana Souza' },
          email: { type: 'string', format: 'email', example: 'ana@exemplo.com' },
          role: { type: 'string', enum: ['USER', 'ADMIN'], description: 'Perfil de acesso.', example: 'USER' },
          city: { type: 'string', nullable: true, example: 'São Paulo' },
          bio: { type: 'string', nullable: true, example: 'Apaixonada por compostagem e bicicleta.' },
          avatarUrl: { type: 'string', nullable: true, example: null },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CadastroEntrada: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100, description: 'Nome de exibição.' },
          email: { type: 'string', format: 'email', description: 'E-mail único. É guardado em minúsculas.' },
          password: { type: 'string', minLength: 8, maxLength: 72, description: 'Senha (de 8 a 72 caracteres).' },
          city: { type: 'string', maxLength: 100, description: 'Sua cidade (opcional). Vira a cidade padrão dos seus posts.' },
          bio: { type: 'string', maxLength: 500, description: 'Apresentação curta (opcional).' },
        },
      },
      LoginEntrada: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      RespostaAuth: {
        type: 'object',
        properties: {
          user: ref('Usuario'),
          token: { type: 'string', description: 'Token JWT (válido por 7 dias). Use no botão Autorizar.' },
        },
      },

      ImagemEnviada: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 7 },
          contentType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp'] },
          size: { type: 'integer', description: 'Tamanho em bytes.', example: 48213 },
          url: { type: 'string', format: 'uri', description: 'Link para usar em `avatarUrl` ou `imageUrl`.', example: 'https://ecomedia-api.onrender.com/api/images/7' },
        },
      },

      Categoria: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Reciclagem' },
          description: { type: 'string', nullable: true, example: 'Separação, reaproveitamento e reciclagem de materiais' },
        },
      },
      CategoriaEntrada: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 60 },
          description: { type: 'string', nullable: true, maxLength: 300 },
        },
      },

      Post: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          content: { type: 'string', example: 'Comecei a compostagem em casa! 🌱' },
          imageUrl: { type: 'string', nullable: true, example: 'https://exemplo.com/fotos/composteira.jpg' },
          city: { type: 'string', nullable: true, example: 'São Paulo' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          author: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
          category: {
            type: 'object',
            properties: { id: { type: 'integer' }, name: { type: 'string' } },
          },
          likesCount: { type: 'integer', description: 'Total de curtidas.', example: 4 },
          commentsCount: { type: 'integer', description: 'Total de comentários.', example: 1 },
          likedByMe: { type: 'boolean', description: 'Se quem pediu (com token) já curtiu. Sem token é sempre `false`.' },
        },
      },
      PostEntrada: {
        type: 'object',
        required: ['categoryId', 'content'],
        properties: {
          categoryId: { type: 'integer', minimum: 1, description: 'Número (id) de uma categoria existente.' },
          content: { type: 'string', minLength: 10, maxLength: 1000, description: 'O texto do post: de 10 a 1000 caracteres (espaços nas pontas não contam).' },
          imageUrl: { type: 'string', format: 'uri', maxLength: 500, description: 'Link de uma imagem (http ou https): pode ser de qualquer site ou o `url` devolvido por POST /api/images. Opcional.' },
          city: { type: 'string', minLength: 1, maxLength: 100, description: 'Cidade da ação. Se omitida, usa a cidade do seu perfil.' },
        },
      },
      PostAtualizacao: {
        type: 'object',
        minProperties: 1,
        description: 'Envie pelo menos um campo.',
        properties: {
          categoryId: { type: 'integer', minimum: 1 },
          content: { type: 'string', minLength: 10, maxLength: 1000 },
          imageUrl: { type: 'string', format: 'uri', maxLength: 500, nullable: true },
          city: { type: 'string', minLength: 1, maxLength: 100, nullable: true },
        },
      },

      Comentario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          postId: { type: 'integer' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          editedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Quando o comentário foi editado pela última vez; `null` se nunca foi editado.' },
          author: {
            type: 'object',
            properties: { id: { type: 'integer' }, name: { type: 'string' }, avatarUrl: { type: 'string', nullable: true } },
          },
        },
      },
      ComentarioEntrada: {
        type: 'object',
        required: ['content'],
        properties: { content: { type: 'string', minLength: 10, maxLength: 500, description: 'De 10 a 500 caracteres (espaços nas pontas não contam).' } },
      },
      RespostaCurtida: {
        type: 'object',
        properties: {
          liked: { type: 'boolean', description: '`true` se agora o post está curtido por você.' },
          likesCount: { type: 'integer', description: 'Total de curtidas do post.' },
        },
      },

      Perfil: {
        type: 'object',
        description: 'Perfil público (sem e-mail).',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          city: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          postsCount: { type: 'integer' },
          followersCount: { type: 'integer' },
          followingCount: { type: 'integer' },
          followedByMe: { type: 'boolean', description: 'Se quem pediu (com token) segue esta pessoa.' },
        },
      },
      PerfilAtualizacao: {
        type: 'object',
        minProperties: 1,
        description: 'Envie pelo menos um campo.',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          city: { type: 'string', minLength: 1, maxLength: 100, nullable: true },
          bio: { type: 'string', maxLength: 500, nullable: true },
          avatarUrl: { type: 'string', format: 'uri', maxLength: 500, nullable: true, description: 'Link http ou https.' },
        },
      },
      RespostaSeguir: {
        type: 'object',
        properties: {
          following: { type: 'boolean', description: '`true` se agora você segue a pessoa.' },
          followersCount: { type: 'integer', description: 'Total de seguidores da pessoa.' },
        },
      },
      UsuarioResumo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          city: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
        },
      },

      ItemDoRanking: {
        type: 'object',
        properties: {
          rank: { type: 'integer', description: 'Posição no ranking (1 = primeiro).' },
          id: { type: 'integer' },
          name: { type: 'string' },
          city: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          postsCount: { type: 'integer' },
          likesReceived: { type: 'integer' },
        },
      },
      Estatisticas: {
        type: 'object',
        properties: {
          users: { type: 'integer', description: 'Pessoas cadastradas.' },
          posts: { type: 'integer' },
          comments: { type: 'integer' },
          likes: { type: 'integer' },
          categories: { type: 'integer' },
          cities: { type: 'integer', description: 'Cidades diferentes com posts.' },
        },
      },

      Paginacao: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', description: 'Total de itens em todas as páginas.', example: 1 },
          totalPages: { type: 'integer', example: 1 },
        },
      },
      PaginaDePosts: {
        type: 'object',
        properties: { data: { type: 'array', items: ref('Post') }, meta: ref('Paginacao') },
      },
      PaginaDeComentarios: {
        type: 'object',
        properties: { data: { type: 'array', items: ref('Comentario') }, meta: ref('Paginacao') },
      },
      PaginaDeUsuarios: {
        type: 'object',
        properties: { data: { type: 'array', items: ref('UsuarioResumo') }, meta: ref('Paginacao') },
      },
    },
  },
};
