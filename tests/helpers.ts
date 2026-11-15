import request from 'supertest';
import { app } from '../src/app.js';

export const api = () => request(app);
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
export const SENHA = 'Senha12345';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  token: string;
}

let contador = 0;

// Cria um usuário comum novo (e-mail único a cada chamada)
export async function criarUsuario(nome: string, cidade?: string): Promise<Usuario> {
  const email = `${nome.toLowerCase().replace(/\s+/g, '.')}${++contador}@teste.dev`;
  const r = await api().post('/api/auth/register').send({ name: nome, email, password: SENHA, city: cidade });
  if (r.status !== 201) throw new Error(`Falha ao criar usuário de teste: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, nome, email, token: r.body.token };
}

// O administrador vem do seed (e-mail e senha definidos em vitest.config.ts)
export async function loginAdmin(): Promise<string> {
  const r = await api()
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  return r.body.token;
}

export async function categorias(): Promise<Record<string, number>> {
  const r = await api().get('/api/categories');
  return Object.fromEntries((r.body as { id: number; name: string }[]).map((c) => [c.name, c.id]));
}

export async function criarPost(token: string, categoryId: number, content: string, extra: object = {}) {
  const r = await api().post('/api/posts').set(auth(token)).send({ categoryId, content, ...extra });
  if (r.status !== 201) throw new Error(`Falha ao criar post de teste: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { id: number };
}
