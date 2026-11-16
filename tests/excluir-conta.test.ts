import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin, SENHA } from './helpers.js';

// DELETE /api/users/me: a pessoa apaga a própria conta (e tudo o que ela criou).
describe('excluir a própria conta', () => {
  it('apaga a conta e tudo o que ela criou, sem encostar no conteúdo das outras pessoas', async () => {
    const saindo = await criarUsuario('Pessoa Saindo');
    const ficando = await criarUsuario('Pessoa Ficando');
    const reciclagem = (await categorias())['Reciclagem'];

    const postDelaId = (await criarPost(saindo.token, reciclagem, 'Post de quem vai sair')).id;
    const postDeOutraId = (await criarPost(ficando.token, reciclagem, 'Post de quem fica')).id;
    await api().post(`/api/posts/${postDeOutraId}/like`).set(auth(saindo.token)); // curtida dela no post da outra
    await api().post(`/api/posts/${postDeOutraId}/comments`).set(auth(saindo.token)).send({ content: 'Comentário de quem vai sair' });
    await api().post(`/api/posts/${postDelaId}/comments`).set(auth(ficando.token)).send({ content: 'Comentário no post de quem sai' });
    await api().post(`/api/users/${ficando.id}/follow`).set(auth(saindo.token)); // ela segue a outra
    await api().post(`/api/users/${saindo.id}/follow`).set(auth(ficando.token)); // a outra segue ela

    const r = await api().delete('/api/users/me').set(auth(saindo.token));
    expect(r.status).toBe(204);
    expect(r.text).toBe('');

    // a conta e o conteúdo dela sumiram
    expect((await api().get(`/api/users/${saindo.id}`)).status).toBe(404);
    expect((await api().get(`/api/posts/${postDelaId}`)).status).toBe(404);

    // o que era das outras pessoas continua, sem as marcas dela
    const outra = await api().get(`/api/posts/${postDeOutraId}`).set(auth(ficando.token));
    expect(outra.status).toBe(200);
    expect(outra.body).toMatchObject({ likesCount: 0, commentsCount: 0 });
    const perfil = await api().get(`/api/users/${ficando.id}`);
    expect(perfil.body).toMatchObject({ postsCount: 1, followersCount: 0, followingCount: 0 });

    // o token antigo e a senha antiga deixam de valer
    expect((await api().get('/api/auth/me').set(auth(saindo.token))).status).toBe(404);
    expect((await api().delete('/api/users/me').set(auth(saindo.token))).status).toBe(404);
    expect((await api().post('/api/auth/login').send({ email: saindo.email, password: SENHA })).status).toBe(401);

    // e o e-mail fica livre para um novo cadastro
    const novo = await api().post('/api/auth/register').send({ name: 'Voltei', email: saindo.email, password: SENHA });
    expect(novo.status).toBe(201);
  });

  it('exige login', async () => {
    expect((await api().delete('/api/users/me')).status).toBe(401);
    expect((await api().delete('/api/users/me').set(auth('token.invalido.aqui'))).status).toBe(401);
  });

  it('o único administrador não pode excluir a própria conta (a API nunca fica sem administrador)', async () => {
    const admin = await loginAdmin();
    const r = await api().delete('/api/users/me').set(auth(admin));
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('Você é o único administrador, então a sua conta não pode ser excluída');
    expect(await loginAdmin()).toBeTruthy(); // continua entrando normalmente
  });

  it('havendo outro administrador, um deles pode excluir a própria conta', async () => {
    const segundo = await criarUsuario('Segundo Admin');
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, segundo.id));
    const login = await api().post('/api/auth/login').send({ email: segundo.email, password: SENHA });
    expect(login.body.user.role).toBe('ADMIN');

    expect((await api().delete('/api/users/me').set(auth(login.body.token))).status).toBe(204);
    expect((await api().get(`/api/users/${segundo.id}`)).status).toBe(404);
    expect(await loginAdmin()).toBeTruthy(); // o administrador do seed continua lá
  });

  it('a trava usa o papel que está no banco, não o que o token antigo diz', async () => {
    // Esta pessoa tem um token de USUÁRIO, mas virou ADMIN no banco depois do login.
    const pessoa = await criarUsuario('Promovida Depois');
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, pessoa.id));
    // Sai o administrador do seed (direto no banco, só para este teste): ela passa a ser a única administradora.
    await db.delete(users).where(eq(users.email, process.env.ADMIN_EMAIL!.toLowerCase()));

    const r = await api().delete('/api/users/me').set(auth(pessoa.token));
    expect(r.status).toBe(409);
  });
});
