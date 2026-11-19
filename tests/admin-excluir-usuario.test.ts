import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { images, users } from '../src/db/schema.js';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin } from './helpers.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// DELETE /api/users/:id: o administrador exclui a conta de outra pessoa (moderação).
describe('administrador exclui a conta de outra pessoa', () => {
  it('apaga a conta e tudo o que ela criou, sem encostar no conteúdo das outras pessoas', async () => {
    const admin = await loginAdmin();
    const alvo = await criarUsuario('Alvo Moderado');
    const outra = await criarUsuario('Outra Pessoa');
    const reciclagem = (await categorias())['Reciclagem'];

    const postDoAlvo = (await criarPost(alvo.token, reciclagem, 'Publicação que vai sumir junto')).id;
    const postDaOutra = (await criarPost(outra.token, reciclagem, 'Publicação que continua aqui')).id;
    await api().post(`/api/posts/${postDaOutra}/like`).set(auth(alvo.token));
    await api().post(`/api/posts/${postDaOutra}/comments`).set(auth(alvo.token)).send({ content: 'Comentário do alvo moderado' });
    await api().post(`/api/users/${outra.id}/follow`).set(auth(alvo.token));
    const foto = await api().post('/api/images').set(auth(alvo.token)).set('Content-Type', 'image/png').send(PNG);
    expect(foto.status).toBe(201);

    const r = await api().delete(`/api/users/${alvo.id}`).set(auth(admin));
    expect(r.status).toBe(204);
    expect(r.text).toBe('');

    expect((await api().get(`/api/users/${alvo.id}`)).status).toBe(404);
    expect((await api().get(`/api/posts/${postDoAlvo}`)).status).toBe(404);
    expect((await api().get(`/api/images/${foto.body.id}`)).status).toBe(404);
    expect((await db.select().from(images).where(eq(images.id, foto.body.id))).length).toBe(0);
    const intacta = await api().get(`/api/posts/${postDaOutra}`);
    expect(intacta.body).toMatchObject({ likesCount: 0, commentsCount: 0 });
    expect((await api().get(`/api/users/${outra.id}`)).body.followersCount).toBe(0);
    // o token antigo da pessoa excluída deixa de valer
    expect((await api().get('/api/auth/me').set(auth(alvo.token))).status).toBe(404);
  });

  it('exige login', async () => {
    const alvo = await criarUsuario('Sem Login Alvo');
    expect((await api().delete(`/api/users/${alvo.id}`)).status).toBe(401);
    expect((await api().get(`/api/users/${alvo.id}`)).status).toBe(200); // continua lá
  });

  it('pessoa comum não pode (403) e nada é apagado', async () => {
    const comum = await criarUsuario('Pessoa Comum');
    const alvo = await criarUsuario('Alvo Protegido');
    const r = await api().delete(`/api/users/${alvo.id}`).set(auth(comum.token));
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('Só administradores podem excluir a conta de outra pessoa');
    expect((await api().get(`/api/users/${alvo.id}`)).status).toBe(200);
  });

  it('o poder vem do banco: quem foi rebaixado depois do login perde o acesso na hora', async () => {
    const rebaixado = await criarUsuario('Rebaixado Depois');
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, rebaixado.id));
    const login = await api().post('/api/auth/login').send({ email: rebaixado.email, password: 'Senha12345' });
    await db.update(users).set({ role: 'USER' }).where(eq(users.id, rebaixado.id)); // token ainda diz ADMIN
    const alvo = await criarUsuario('Alvo Do Rebaixado');
    expect((await api().delete(`/api/users/${alvo.id}`).set(auth(login.body.token))).status).toBe(403);
  });

  it('não serve para a própria conta (400): para isso existe DELETE /users/me', async () => {
    const admin = await loginAdmin();
    const eu = (await api().get('/api/auth/me').set(auth(admin))).body.id;
    const r = await api().delete(`/api/users/${eu}`).set(auth(admin));
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Para excluir a sua própria conta, use a opção em Minha conta');
    expect(await loginAdmin()).toBeTruthy();
  });

  it('não exclui outro administrador (403)', async () => {
    const admin = await loginAdmin();
    const segundo = await criarUsuario('Segundo Admin Alvo');
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, segundo.id));
    const r = await api().delete(`/api/users/${segundo.id}`).set(auth(admin));
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('A conta de outro administrador não pode ser excluída por aqui');
    expect((await api().get(`/api/users/${segundo.id}`)).status).toBe(200);
  });

  it('pessoa que não existe (404) e número inválido (400)', async () => {
    const admin = await loginAdmin();
    expect((await api().delete('/api/users/999999').set(auth(admin))).status).toBe(404);
    expect((await api().delete('/api/users/abc').set(auth(admin))).status).toBe(400);
  });
});
