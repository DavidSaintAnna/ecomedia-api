import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, categorias, criarPost, criarUsuario } from './helpers.js';

let ana: Awaited<ReturnType<typeof criarUsuario>>;
let bob: Awaited<ReturnType<typeof criarUsuario>>;
let cat: Awaited<ReturnType<typeof criarUsuario>>;
let bobPost = 0;
let catPost = 0;
let reciclagem = 0;

beforeAll(async () => {
  ana = await criarUsuario('Ana Souza', 'Aracaju');
  bob = await criarUsuario('Bob Lima', 'Recife');
  cat = await criarUsuario('Cat Dias');
  reciclagem = (await categorias())['Reciclagem'];
  bobPost = (await criarPost(bob.token, reciclagem, 'Bob reciclou vidro hoje')).id;
  catPost = (await criarPost(cat.token, reciclagem, 'Cat fez compostagem em casa')).id;
  await criarPost(ana.token, reciclagem, 'Post da própria Ana');
});

describe('perfil público', () => {
  it('mostra contagens e nunca vaza e-mail ou senha', async () => {
    const r = await api().get(`/api/users/${bob.id}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: bob.id, name: 'Bob Lima', city: 'Recife', postsCount: 1, followersCount: 0, followingCount: 0, followedByMe: false });
    expect(r.body.email).toBeUndefined();
    expect(r.body.passwordHash).toBeUndefined();
  });

  it('404 para usuário inexistente e 400 para id inválido', async () => {
    const r = await api().get('/api/users/9999');
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Usuário não encontrado');
    expect((await api().get('/api/users/abc')).status).toBe(400);
  });
});

describe('editar o próprio perfil', () => {
  it('exige login e pelo menos um campo', async () => {
    expect((await api().patch('/api/users/me').send({ bio: 'x' })).status).toBe(401);
    expect((await api().patch('/api/users/me').set(auth(ana.token)).send({})).status).toBe(400);
  });

  it('valida nome e avatar (só http/https)', async () => {
    expect((await api().patch('/api/users/me').set(auth(ana.token)).send({ name: 'A' })).status).toBe(400);
    expect((await api().patch('/api/users/me').set(auth(ana.token)).send({ avatarUrl: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('atualiza bio, avatar e cidade, e permite limpar um campo', async () => {
    const r = await api().patch('/api/users/me').set(auth(ana.token)).send({ bio: 'Apaixonada por reciclagem', avatarUrl: 'https://exemplo.com/ana.png' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ bio: 'Apaixonada por reciclagem', avatarUrl: 'https://exemplo.com/ana.png' });
    const limpo = await api().patch('/api/users/me').set(auth(ana.token)).send({ bio: null });
    expect(limpo.body.bio).toBeNull();
  });

  it('não permite mudar papel nem e-mail por aqui', async () => {
    const r = await api().patch('/api/users/me').set(auth(ana.token)).send({ role: 'ADMIN', email: 'novo@teste.dev', bio: 'oi' });
    expect(r.status).toBe(200);
    const me = await api().get('/api/auth/me').set(auth(ana.token));
    expect(me.body.role).toBe('USER');
    expect(me.body.email).toBe(ana.email);
  });
});

describe('seguir', () => {
  it('exige login, não deixa seguir a si mesmo nem usuário inexistente', async () => {
    expect((await api().post(`/api/users/${bob.id}/follow`)).status).toBe(401);
    const eu = await api().post(`/api/users/${ana.id}/follow`).set(auth(ana.token));
    expect(eu.status).toBe(400);
    expect(eu.body.message).toBe('Você não pode seguir a si mesmo');
    expect((await api().post('/api/users/9999/follow').set(auth(ana.token))).status).toBe(404);
  });

  it('seguir e deixar de seguir alternam a cada chamada', async () => {
    expect((await api().post(`/api/users/${bob.id}/follow`).set(auth(ana.token))).body).toEqual({ following: true, followersCount: 1 });
    expect((await api().post(`/api/users/${bob.id}/follow`).set(auth(ana.token))).body).toEqual({ following: false, followersCount: 0 });
    expect((await api().post(`/api/users/${bob.id}/follow`).set(auth(ana.token))).body).toEqual({ following: true, followersCount: 1 });
  });

  it('o perfil mostra followedByMe e as contagens', async () => {
    const comoAna = await api().get(`/api/users/${bob.id}`).set(auth(ana.token));
    const comoCat = await api().get(`/api/users/${bob.id}`).set(auth(cat.token));
    const anonimo = await api().get(`/api/users/${bob.id}`);
    expect(comoAna.body).toMatchObject({ followedByMe: true, followersCount: 1 });
    expect(comoCat.body.followedByMe).toBe(false);
    expect(anonimo.body.followedByMe).toBe(false);
    expect((await api().get(`/api/users/${ana.id}`)).body.followingCount).toBe(1);
  });

  it('lista seguidores e quem a pessoa segue, com paginação e sem e-mail', async () => {
    await api().post(`/api/users/${bob.id}/follow`).set(auth(cat.token));
    const seguidores = await api().get(`/api/users/${bob.id}/followers`);
    expect(seguidores.body.meta.total).toBe(2);
    expect(seguidores.body.data.map((u: { name: string }) => u.name).sort()).toEqual(['Ana Souza', 'Cat Dias']);
    expect(seguidores.body.data[0].email).toBeUndefined();
    expect((await api().get(`/api/users/${bob.id}/followers?limit=1&page=2`)).body.data).toHaveLength(1);
    const seguindo = await api().get(`/api/users/${ana.id}/following`);
    expect(seguindo.body.data.map((u: { name: string }) => u.name)).toEqual(['Bob Lima']);
    expect((await api().get('/api/users/9999/followers')).status).toBe(404);
    expect((await api().get('/api/users/9999/following')).status).toBe(404);
  });
});

describe('feed (posts de quem eu sigo)', () => {
  it('exige login', async () => {
    expect((await api().get('/api/feed')).status).toBe(401);
  });

  it('mostra só posts de quem eu sigo: nem os meus, nem os de desconhecidos', async () => {
    const r = await api().get('/api/feed').set(auth(ana.token));
    expect(r.status).toBe(200);
    expect(r.body.meta.total).toBe(1);
    expect(r.body.data[0]).toMatchObject({ content: 'Bob reciclou vidro hoje', author: { name: 'Bob Lima' }, likedByMe: false });
  });

  it('fica vazio para quem não segue ninguém', async () => {
    const r = await api().get('/api/feed').set(auth(bob.token));
    expect(r.body.data).toEqual([]);
    expect(r.body.meta.total).toBe(0);
  });

  it('cresce ao seguir mais gente, do mais novo ao mais antigo, com likedByMe', async () => {
    await api().post(`/api/users/${cat.id}/follow`).set(auth(ana.token));
    await api().post(`/api/posts/${bobPost}/like`).set(auth(ana.token));
    const r = await api().get('/api/feed').set(auth(ana.token));
    expect(r.body.meta.total).toBe(2);
    expect(r.body.data.map((p: { content: string }) => p.content)).toEqual(['Cat fez compostagem em casa', 'Bob reciclou vidro hoje']);
    expect(r.body.data[1]).toMatchObject({ likedByMe: true, likesCount: 1 });
  });

  it('deixar de seguir tira os posts da pessoa do feed', async () => {
    await api().post(`/api/users/${bob.id}/follow`).set(auth(ana.token)); // deixa de seguir
    const r = await api().get('/api/feed').set(auth(ana.token));
    expect(r.body.data.map((p: { author: { name: string } }) => p.author.name)).toEqual(['Cat Dias']);
    await api().post(`/api/users/${bob.id}/follow`).set(auth(ana.token)); // volta a seguir
  });

  it('pagina o feed', async () => {
    const p1 = await api().get('/api/feed?limit=1&page=1').set(auth(ana.token));
    const p2 = await api().get('/api/feed?limit=1&page=2').set(auth(ana.token));
    expect(p1.body.data).toHaveLength(1);
    expect(p2.body.data).toHaveLength(1);
    expect(p1.body.meta.totalPages).toBe(2);
  });

  it('apagar um post o tira do feed', async () => {
    expect((await api().delete(`/api/posts/${catPost}`).set(auth(cat.token))).status).toBe(204);
    expect((await api().get('/api/feed').set(auth(ana.token))).body.meta.total).toBe(1);
  });
});

describe('contagens do perfil são de cada usuário', () => {
  it('postsCount não se mistura entre pessoas', async () => {
    await criarPost(bob.token, reciclagem, 'Segundo post do Bob');
    expect((await api().get(`/api/users/${bob.id}`)).body.postsCount).toBe(2);
    expect((await api().get(`/api/users/${cat.id}`)).body.postsCount).toBe(0);
    expect((await api().get(`/api/users/${ana.id}`)).body.postsCount).toBe(1);
  });
});
