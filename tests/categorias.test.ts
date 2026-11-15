import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin } from './helpers.js';

let admin = '';
let ana: Awaited<ReturnType<typeof criarUsuario>>;

beforeAll(async () => {
  admin = await loginAdmin();
  ana = await criarUsuario('Ana');
});

describe('categorias iniciais (seed)', () => {
  it('existem 7 categorias, todas em português', async () => {
    const nomes = Object.keys(await categorias()).sort();
    expect(nomes).toEqual(
      ['Água', 'Energia', 'Hortas Urbanas', 'Mobilidade', 'Mutirão de Limpeza', 'Reciclagem', 'Redução de Resíduos'].sort(),
    );
  });

  it('a listagem é pública e traz descrição', async () => {
    const r = await api().get('/api/categories');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(7);
    expect(r.body.every((c: { description: string }) => c.description.length > 5)).toBe(true);
  });
});

describe('consulta', () => {
  it('busca uma categoria pelo id', async () => {
    const id = (await categorias())['Reciclagem'];
    const r = await api().get(`/api/categories/${id}`);
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Reciclagem');
  });
  it('404 quando não existe e 400 quando o id é inválido', async () => {
    const naoExiste = await api().get('/api/categories/9999');
    expect(naoExiste.status).toBe(404);
    expect(naoExiste.body.message).toBe('Categoria não encontrada');
    expect((await api().get('/api/categories/abc')).status).toBe(400);
  });
});

describe('administração (só ADMIN)', () => {
  let id = 0;

  it('exige login e perfil de administrador para criar', async () => {
    expect((await api().post('/api/categories').send({ name: 'Solar' })).status).toBe(401);
    const r = await api().post('/api/categories').set(auth(ana.token)).send({ name: 'Solar' });
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('Você não tem permissão para fazer isso');
  });

  it('o administrador cria, e nome repetido dá 409', async () => {
    const r = await api().post('/api/categories').set(auth(admin)).send({ name: 'Energia Solar', description: 'Painéis solares' });
    expect(r.status).toBe(201);
    id = r.body.id;
    const repetida = await api().post('/api/categories').set(auth(admin)).send({ name: 'Energia Solar' });
    expect(repetida.status).toBe(409);
    expect(repetida.body.message).toBe('Categoria já existe');
  });

  it('valida o nome', async () => {
    expect((await api().post('/api/categories').set(auth(admin)).send({ name: 'x' })).status).toBe(400);
    expect((await api().post('/api/categories').set(auth(admin)).send({})).status).toBe(400);
  });

  it('só o administrador edita', async () => {
    expect((await api().put(`/api/categories/${id}`).set(auth(ana.token)).send({ name: 'Hackeada' })).status).toBe(403);
    const r = await api().put(`/api/categories/${id}`).set(auth(admin)).send({ name: 'Energia Solar Residencial' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Energia Solar Residencial');
    expect((await api().put('/api/categories/9999').set(auth(admin)).send({ name: 'Qualquer' })).status).toBe(404);
  });

  it('só o administrador remove', async () => {
    expect((await api().delete(`/api/categories/${id}`).set(auth(ana.token))).status).toBe(403);
    expect((await api().delete(`/api/categories/${id}`).set(auth(admin))).status).toBe(204);
    expect((await api().get(`/api/categories/${id}`)).status).toBe(404);
    expect((await api().delete(`/api/categories/${id}`).set(auth(admin))).status).toBe(404);
  });

  it('não deixa remover uma categoria que já tem posts', async () => {
    const cats = await categorias();
    await criarPost(ana.token, cats['Mobilidade'], 'Fui de bicicleta ao trabalho');
    const r = await api().delete(`/api/categories/${cats['Mobilidade']}`).set(auth(admin));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/usado por outros dados/);
  });
});
