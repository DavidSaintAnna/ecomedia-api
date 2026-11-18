import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin } from './helpers.js';

let admin = '';
let ana: Awaited<ReturnType<typeof criarUsuario>>;
let bob: Awaited<ReturnType<typeof criarUsuario>>;
let cat: Awaited<ReturnType<typeof criarUsuario>>;
let postId = 0;
let comentarioId = 0;

beforeAll(async () => {
  admin = await loginAdmin();
  ana = await criarUsuario('Ana');
  bob = await criarUsuario('Bob');
  cat = await criarUsuario('Cat');
  const cats = await categorias();
  postId = (await criarPost(ana.token, cats['Reciclagem'], 'Separei todo o plástico!')).id;
});

describe('curtidas', () => {
  it('exigem login', async () => {
    expect((await api().post(`/api/posts/${postId}/like`)).status).toBe(401);
  });

  it('dão 404 para post inexistente e 400 para id inválido', async () => {
    expect((await api().post('/api/posts/9999/like').set(auth(bob.token))).status).toBe(404);
    expect((await api().post('/api/posts/abc/like').set(auth(bob.token))).status).toBe(400);
  });

  it('curtir e descurtir alternam a cada chamada', async () => {
    const curtiu = await api().post(`/api/posts/${postId}/like`).set(auth(bob.token));
    expect(curtiu.body).toEqual({ liked: true, likesCount: 1 });
    const descurtiu = await api().post(`/api/posts/${postId}/like`).set(auth(bob.token));
    expect(descurtiu.body).toEqual({ liked: false, likesCount: 0 });
    const denovo = await api().post(`/api/posts/${postId}/like`).set(auth(bob.token));
    expect(denovo.body).toEqual({ liked: true, likesCount: 1 });
  });

  it('soma curtidas de pessoas diferentes, sem curtida dupla', async () => {
    const r = await api().post(`/api/posts/${postId}/like`).set(auth(ana.token));
    expect(r.body).toEqual({ liked: true, likesCount: 2 });
    await api().post(`/api/posts/${postId}/like`).set(auth(ana.token)); // Ana descurte
  });
});

describe('likedByMe (o coração pintado no React)', () => {
  it('é verdadeiro só para quem curtiu; anônimos e outros veem falso', async () => {
    const comoBob = await api().get(`/api/posts/${postId}`).set(auth(bob.token));
    const comoAna = await api().get(`/api/posts/${postId}`).set(auth(ana.token));
    const anonimo = await api().get(`/api/posts/${postId}`);
    expect(comoBob.body).toMatchObject({ likedByMe: true, likesCount: 1 });
    expect(comoAna.body).toMatchObject({ likedByMe: false, likesCount: 1 });
    expect(anonimo.body).toMatchObject({ likedByMe: false, likesCount: 1 });
  });

  it('também funciona na listagem', async () => {
    expect((await api().get('/api/posts').set(auth(bob.token))).body.data[0].likedByMe).toBe(true);
    expect((await api().get('/api/posts')).body.data[0].likedByMe).toBe(false);
  });

  it('token lixo numa rota pública é tratado como anônimo, sem erro', async () => {
    const r = await api().get(`/api/posts/${postId}`).set(auth('lixo'));
    expect(r.status).toBe(200);
    expect(r.body.likedByMe).toBe(false);
  });
});

describe('comentários', () => {
  it('exigem login para criar', async () => {
    expect((await api().post(`/api/posts/${postId}/comments`).send({ content: 'oi' })).status).toBe(401);
  });

  it('validam o texto e o post', async () => {
    expect((await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: '   ' })).status).toBe(400);
    expect((await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: 'x'.repeat(501) })).status).toBe(400);
    expect((await api().post('/api/posts/9999/comments').set(auth(bob.token)).send({ content: 'Comentário num post que não existe' })).status).toBe(404);
    expect((await api().get('/api/posts/9999/comments')).status).toBe(404);
  });

  it('pedem no mínimo 10 caracteres (espaços nas pontas não contam)', async () => {
    const curto = await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: '  1234567890  ' }); // 10 caracteres de verdade: vale
    expect(curto.status).toBe(201);
    await api().delete(`/api/comments/${curto.body.id}`).set(auth(bob.token));
    const nove = await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: '  Parabéns!  ' });
    expect(nove.status).toBe(400);
    expect(nove.body.details).toEqual([{ path: 'content', message: 'O comentário precisa ter pelo menos 10 caracteres' }]);
  });

  it('criam o comentário e devolvem o autor, sem e-mail', async () => {
    const r = await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: 'Parabéns pelo projeto!' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ postId, content: 'Parabéns pelo projeto!', author: { id: bob.id, name: 'Bob' } });
    expect(r.body.author.email).toBeUndefined();
    comentarioId = r.body.id;
    await api().post(`/api/posts/${postId}/comments`).set(auth(ana.token)).send({ content: 'Obrigada pelo carinho!' });
  });

  it('listam publicamente, do mais antigo ao mais novo, com paginação', async () => {
    const r = await api().get(`/api/posts/${postId}/comments`);
    expect(r.body.data.map((c: { content: string }) => c.content)).toEqual(['Parabéns pelo projeto!', 'Obrigada pelo carinho!']);
    expect(r.body.meta).toMatchObject({ total: 2, totalPages: 1 });
    const p2 = await api().get(`/api/posts/${postId}/comments?limit=1&page=2`);
    expect(p2.body.data.map((c: { content: string }) => c.content)).toEqual(['Obrigada pelo carinho!']);
  });

  it('a contagem aparece no post', async () => {
    expect((await api().get(`/api/posts/${postId}`)).body.commentsCount).toBe(2);
  });

  it('só o autor edita, e o comentário passa a mostrar quando foi editado', async () => {
    const lista = async () => (await api().get(`/api/posts/${postId}/comments`)).body.data as { id: number; content: string; editedAt: string | null }[];
    expect((await lista()).every((c) => c.editedAt === null)).toBe(true);

    expect((await api().patch(`/api/comments/${comentarioId}`).send({ content: 'Parabéns pelo projeto, de novo!' })).status).toBe(401);
    const outra = await api().patch(`/api/comments/${comentarioId}`).set(auth(ana.token)).send({ content: 'Texto de quem não é o autor' });
    expect(outra.status).toBe(403);
    expect(outra.body.message).toBe('Você só pode editar os seus próprios comentários');
    // o administrador modera (exclui), mas não reescreve o que outra pessoa disse
    expect((await api().patch(`/api/comments/${comentarioId}`).set(auth(admin)).send({ content: 'Texto escrito pelo administrador' })).status).toBe(403);

    expect((await api().patch('/api/comments/9999').set(auth(bob.token)).send({ content: 'Comentário que não existe' })).status).toBe(404);
    expect((await api().patch('/api/comments/abc').set(auth(bob.token)).send({ content: 'Comentário com id errado' })).status).toBe(400);
    expect((await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({})).status).toBe(400);
    expect((await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({ content: 'curto' })).status).toBe(400);
    expect((await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({ content: 'x'.repeat(501) })).status).toBe(400);

    const ok = await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({ content: '  Parabéns pelo projeto, de novo!  ' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: comentarioId, postId, content: 'Parabéns pelo projeto, de novo!', author: { id: bob.id } });
    expect(ok.body.editedAt).toEqual(expect.any(String));
    expect(ok.body.author.email).toBeUndefined();

    const depois = await lista();
    expect(depois[0]).toMatchObject({ id: comentarioId, content: 'Parabéns pelo projeto, de novo!' });
    expect(depois[0].editedAt).not.toBeNull();
    expect(depois[1].editedAt).toBeNull(); // o outro comentário continua intacto
  });

  it('enviar o mesmo texto de novo não muda a data da edição', async () => {
    const antes = (await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({ content: 'Parabéns pelo projeto, de novo!' })).body.editedAt;
    const de_novo = (await api().patch(`/api/comments/${comentarioId}`).set(auth(bob.token)).send({ content: 'Parabéns pelo projeto, de novo!' })).body.editedAt;
    expect(de_novo).toBe(antes);
  });

  it('só o autor do comentário ou um administrador apaga', async () => {
    expect((await api().delete(`/api/comments/${comentarioId}`)).status).toBe(401);
    const outra = await api().delete(`/api/comments/${comentarioId}`).set(auth(ana.token));
    expect(outra.status).toBe(403);
    expect(outra.body.message).toBe('Você só pode excluir os seus próprios comentários');
    expect((await api().delete(`/api/comments/${comentarioId}`).set(auth(bob.token))).status).toBe(204);
    expect((await api().delete(`/api/comments/${comentarioId}`).set(auth(bob.token))).status).toBe(404);
    const restante = (await api().get(`/api/posts/${postId}/comments`)).body.data[0].id;
    expect((await api().delete(`/api/comments/${restante}`).set(auth(admin))).status).toBe(204);
    expect((await api().get(`/api/posts/${postId}`)).body.commentsCount).toBe(0);
  });
});

describe('contagens corretas em vários posts ao mesmo tempo', () => {
  it('cada post mostra as suas próprias curtidas, comentários e likedByMe', async () => {
    const cats = await categorias();
    const p1 = (await criarPost(ana.token, cats['Energia'], 'primeiro post de energia')).id;
    const p2 = (await criarPost(ana.token, cats['Energia'], 'segundo post de energia')).id;
    const p3 = (await criarPost(bob.token, cats['Energia'], 'terceiro post de energia')).id;
    for (const u of [ana, bob, cat]) await api().post(`/api/posts/${p1}/like`).set(auth(u.token)); // 3 curtidas
    await api().post(`/api/posts/${p2}/like`).set(auth(bob.token));                                // 1 curtida
    await api().post(`/api/posts/${p1}/comments`).set(auth(bob.token)).send({ content: 'comentário número 1' });    // 1 comentário
    for (const u of [ana, bob]) await api().post(`/api/posts/${p3}/comments`).set(auth(u.token)).send({ content: 'comentário de teste' }); // 2

    const lista = (await api().get(`/api/posts?categoryId=${cats['Energia']}`).set(auth(bob.token))).body.data;
    const por = Object.fromEntries(lista.map((p: { id: number }) => [p.id, p]));
    expect([por[p1].likesCount, por[p2].likesCount, por[p3].likesCount]).toEqual([3, 1, 0]);
    expect([por[p1].commentsCount, por[p2].commentsCount, por[p3].commentsCount]).toEqual([1, 0, 2]);
    expect([por[p1].likedByMe, por[p2].likedByMe, por[p3].likedByMe]).toEqual([true, true, false]);
  });
});

describe('apagar um post leva junto curtidas e comentários', () => {
  it('em cascata', async () => {
    await api().post(`/api/posts/${postId}/comments`).set(auth(bob.token)).send({ content: 'comentário que vai embora' });
    expect((await api().delete(`/api/posts/${postId}`).set(auth(ana.token))).status).toBe(204);
    expect((await api().get(`/api/posts/${postId}/comments`)).status).toBe(404);
    expect((await api().post(`/api/posts/${postId}/like`).set(auth(bob.token))).status).toBe(404);
  });
});
