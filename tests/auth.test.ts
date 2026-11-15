import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { api, auth, criarUsuario, loginAdmin, SENHA } from './helpers.js';

describe('cadastro', () => {
  it('cria um usuário comum e devolve o token, sem expor a senha', async () => {
    const r = await api()
      .post('/api/auth/register')
      .send({ name: 'Ana Souza', email: 'ana@teste.dev', password: SENHA, city: 'Aracaju', bio: 'Reciclo tudo' });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ name: 'Ana Souza', email: 'ana@teste.dev', role: 'USER', city: 'Aracaju', bio: 'Reciclo tudo' });
    expect(typeof r.body.token).toBe('string');
    expect(r.body.user.passwordHash).toBeUndefined();
    expect(r.body.user.password).toBeUndefined();
  });

  it('normaliza o e-mail (espaços e maiúsculas) e o login funciona com qualquer capitalização', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'Bia Lima', email: '  BIA@Teste.DEV ', password: SENHA });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe('bia@teste.dev');
    const login = await api().post('/api/auth/login').send({ email: 'BIA@TESTE.DEV', password: SENHA });
    expect(login.status).toBe(200);
  });

  it('recusa e-mail repetido, mesmo com letras diferentes', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'Outra Ana', email: 'ANA@teste.dev', password: SENHA });
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('E-mail já cadastrado');
  });

  it('valida os campos e explica o erro de cada um', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'x', email: 'ruim', password: '1' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('ValidationError');
    expect(r.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'name', 'password']);
  });

  it('recusa requisição sem corpo', async () => {
    expect((await api().post('/api/auth/register')).status).toBe(400);
  });

  it('recusa senha com mais de 72 caracteres (limite do bcrypt)', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'Senha Longa', email: 'longa@teste.dev', password: 'a'.repeat(73) });
    expect(r.status).toBe(400);
    expect(r.body.details[0].path).toBe('password');
  });

  it('ignora o campo role: ninguém vira ADMIN pelo cadastro', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'Espertinho', email: 'esperto@teste.dev', password: SENHA, role: 'ADMIN' });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('USER');
    const me = await api().get('/api/auth/me').set(auth(r.body.token));
    expect(me.body.role).toBe('USER');
  });
});

describe('login', () => {
  it('entra com e-mail e senha corretos', async () => {
    const r = await api().post('/api/auth/login').send({ email: 'ana@teste.dev', password: SENHA });
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('ana@teste.dev');
    expect(typeof r.body.token).toBe('string');
    expect(r.body.user.passwordHash).toBeUndefined();
  });

  it('não revela se o e-mail existe: mesma resposta para senha errada e e-mail desconhecido', async () => {
    const senhaErrada = await api().post('/api/auth/login').send({ email: 'ana@teste.dev', password: 'senhaerrada1' });
    const semConta = await api().post('/api/auth/login').send({ email: 'ninguem@teste.dev', password: SENHA });
    expect(senhaErrada.status).toBe(401);
    expect(semConta.status).toBe(401);
    expect(senhaErrada.body).toEqual(semConta.body);
    expect(senhaErrada.body.message).toBe('E-mail ou senha inválidos');
  });

  it('valida o formato dos dados', async () => {
    expect((await api().post('/api/auth/login').send({ email: 'ruim', password: '' })).status).toBe(400);
  });

  it('o administrador criado pelo seed consegue entrar', async () => {
    const token = await loginAdmin();
    const me = await api().get('/api/auth/me').set(auth(token));
    expect(me.body.role).toBe('ADMIN');
  });
});

describe('quem sou eu (/auth/me)', () => {
  it('devolve o próprio perfil, sem dados secretos', async () => {
    const u = await criarUsuario('Caio Dias', 'Recife');
    const r = await api().get('/api/auth/me').set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: u.id, name: 'Caio Dias', email: u.email, role: 'USER', city: 'Recife' });
    expect(r.body.passwordHash).toBeUndefined();
  });

  it('exige token', async () => {
    const r = await api().get('/api/auth/me');
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Autenticação necessária');
  });

  it('recusa token inválido, de outro segredo ou expirado', async () => {
    const segredo = process.env.JWT_SECRET!;
    expect((await api().get('/api/auth/me').set(auth('lixo'))).status).toBe(401);
    const outroSegredo = jwt.sign({ role: 'ADMIN' }, 'um-segredo-totalmente-diferente-123456', { subject: '1' });
    expect((await api().get('/api/auth/me').set(auth(outroSegredo))).status).toBe(401);
    const expirado = jwt.sign({ role: 'USER' }, segredo, { subject: '1', expiresIn: -10 });
    const r = await api().get('/api/auth/me').set(auth(expirado));
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Token inválido ou expirado');
  });

  it('token de um usuário que não existe mais devolve 404', async () => {
    const fantasma = jwt.sign({ role: 'USER' }, process.env.JWT_SECRET!, { subject: '99999' });
    const r = await api().get('/api/auth/me').set(auth(fantasma));
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Usuário não existe mais');
  });

  it('o papel (role) vem do banco no cadastro, não de algo que o cliente envia', async () => {
    const u = await criarUsuario('Dani Reis');
    const r = await api().get('/api/auth/me').set(auth(u.token));
    expect(r.body.role).toBe('USER');
  });
});
