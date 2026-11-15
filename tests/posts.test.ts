import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin } from './helpers.js';

let admin = '';
let ana: Awaited<ReturnType<typeof criarUsuario>>;
let bob: Awaited<ReturnType<typeof criarUsuario>>;
let cats: Record<string, number> = {};
let postId = 0;

beforeAll(async () => {
  admin = await loginAdmin();
  ana = await criarUsuario('Ana Souza', 'Aracaju');
  bob = await criarUsuario('Bob Lima', 'Recife');
  cats = await categorias();
});

describe('criar post', () => {
  it('exige login', async () => {
    const r = await api().post('/api/posts').send({ categoryId: cats['Reciclagem'], content: 'Olá, mundo' });
    expect(r.status).toBe(401);
  });

  it('valida os campos', async () => {
    const r = await api().post('/api/posts').set(auth(ana.token)).send({ categoryId: 'x', content: 'a', imageUrl: 'javascript:alert(1)' });
    expect(r.status).toBe(400);
    expect(r.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['categoryId', 'content', 'imageUrl']);
  });

  it('só aceita imagens http(s)', async () => {
    const ftp = await api().post('/api/posts').set(auth(ana.token)).send({ categoryId: cats['Reciclagem'], content: 'texto ok', imageUrl: 'ftp://x.com/a.png' });
    expect(ftp.status).toBe(400);
  });

  it('recusa categoria que não existe', async () => {
    const r = await api().post('/api/posts').set(auth(ana.token)).send({ categoryId: 99999, content: 'texto válido' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('A categoria informada (categoryId) não existe');
  });

  it('cria o post e usa a cidade do autor quando nenhuma é enviada', async () => {
    const r = await api().post('/api/posts').set(auth(ana.token)).send({
      categoryId: cats['Reciclagem'],
      content: 'Separei todo o plastico da semana!',
      imageUrl: 'https://exemplo.com/foto.png',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ city: 'Aracaju', likesCount: 0, commentsCount: 0, likedByMe: false, imageUrl: 'https://exemplo.com/foto.png' });
    expect(r.body.author).toMatchObject({ id: ana.id, name: 'Ana Souza' });
    expect(r.body.category.name).toBe('Reciclagem');
    expect(r.body.author.email).toBeUndefined();
    postId = r.body.id;
  });

  it('aceita uma cidade diferente da do autor', async () => {
    const r = await api().post('/api/posts').set(auth(bob.token)).send({ categoryId: cats['Mobilidade'], content: 'Nova ciclovia no centro', city: 'Olinda' });
    expect(r.status).toBe(201);
    expect(r.body.city).toBe('Olinda');
  });
});

describe('listagem pública', () => {
  beforeAll(async () => {
    await criarPost(bob.token, cats['Mobilidade'], 'Fui de bicicleta ao trabalho hoje');
    await criarPost(bob.token, cats['Reciclagem'], 'Levei o VIDRO para a coleta seletiva');
  });

  it('traz os mais novos primeiro, com contagem total', async () => {
    const r = await api().get('/api/posts');
    expect(r.status).toBe(200);
    expect(r.body.meta).toMatchObject({ page: 1, limit: 10, total: 4, totalPages: 1 });
    expect(r.body.data[0].content).toBe('Levei o VIDRO para a coleta seletiva');
    expect(r.body.data.at(-1).id).toBe(postId);
  });

  it('filtra por categoria, cidade, texto e autor', async () => {
    expect((await api().get(`/api/posts?categoryId=${cats['Mobilidade']}`)).body.meta.total).toBe(2);
    expect((await api().get('/api/posts?city=recife')).body.meta.total).toBe(2);
    expect((await api().get('/api/posts?q=vidro')).body.data).toHaveLength(1);
    expect((await api().get(`/api/posts?authorId=${ana.id}`)).body.meta.total).toBe(1);
    expect((await api().get('/api/posts?q=inexistente')).body.data).toEqual([]);
  });

  it('combina filtros', async () => {
    const r = await api().get(`/api/posts?categoryId=${cats['Reciclagem']}&city=recife`);
    expect(r.body.data.map((p: { content: string }) => p.content)).toEqual(['Levei o VIDRO para a coleta seletiva']);
  });

  it('pagina os resultados', async () => {
    const p1 = await api().get('/api/posts?limit=3&page=1');
    const p2 = await api().get('/api/posts?limit=3&page=2');
    expect(p1.body.data).toHaveLength(3);
    expect(p2.body.data).toHaveLength(1);
    expect(p1.body.meta.totalPages).toBe(2);
    const ids = [...p1.body.data, ...p2.body.data].map((p: { id: number }) => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('valida a paginação', async () => {
    expect((await api().get('/api/posts?limit=500')).status).toBe(400);
    expect((await api().get('/api/posts?page=0')).status).toBe(400);
  });
});

describe('um post', () => {
  it('busca pelo id, e dá 404 ou 400 quando não existe ou é inválido', async () => {
    expect((await api().get(`/api/posts/${postId}`)).body.id).toBe(postId);
    expect((await api().get('/api/posts/99999')).status).toBe(404);
    expect((await api().get('/api/posts/abc')).status).toBe(400);
  });
});

describe('editar', () => {
  it('só o autor ou um administrador edita', async () => {
    const outraPessoa = await api().patch(`/api/posts/${postId}`).set(auth(bob.token)).send({ content: 'invadido!!' });
    expect(outraPessoa.status).toBe(403);
    expect(outraPessoa.body.message).toBe('Você só pode alterar os seus próprios posts');
    expect((await api().patch(`/api/posts/${postId}`).send({ content: 'anonimo' })).status).toBe(401);
  });

  it('exige pelo menos um campo', async () => {
    const r = await api().patch(`/api/posts/${postId}`).set(auth(ana.token)).send({});
    expect(r.status).toBe(400);
  });

  it('o autor altera o texto e remove a imagem', async () => {
    const r = await api().patch(`/api/posts/${postId}`).set(auth(ana.token)).send({ content: 'Texto atualizado', imageUrl: null });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ content: 'Texto atualizado', imageUrl: null });
    expect(new Date(r.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(r.body.createdAt).getTime());
  });

  it('o administrador pode mudar a categoria de qualquer post', async () => {
    const r = await api().patch(`/api/posts/${postId}`).set(auth(admin)).send({ categoryId: cats['Energia'] });
    expect(r.status).toBe(200);
    expect(r.body.category.name).toBe('Energia');
  });

  it('404 para post que não existe', async () => {
    expect((await api().patch('/api/posts/99999').set(auth(ana.token)).send({ content: 'qualquer coisa' })).status).toBe(404);
  });
});

describe('apagar', () => {
  it('só o autor ou um administrador apaga', async () => {
    expect((await api().delete(`/api/posts/${postId}`).set(auth(bob.token))).status).toBe(403);
    expect((await api().delete(`/api/posts/${postId}`).set(auth(ana.token))).status).toBe(204);
    expect((await api().get(`/api/posts/${postId}`)).status).toBe(404);
    expect((await api().delete(`/api/posts/${postId}`).set(auth(ana.token))).status).toBe(404);
  });

  it('o administrador apaga o post de qualquer pessoa', async () => {
    const p = await criarPost(bob.token, cats['Água'], 'Reaproveitei a água da chuva');
    expect((await api().delete(`/api/posts/${p.id}`).set(auth(admin))).status).toBe(204);
  });
});
