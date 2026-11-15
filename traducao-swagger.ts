import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'A variável DATABASE_URL não está definida. Copie o arquivo .env.example para .env e preencha com a conexão do seu banco PostgreSQL (veja o README).',
  );
}

// Bancos na nuvem (Neon, Render...) exigem conexão criptografada (SSL); um Postgres instalado na sua
// máquina normalmente não usa SSL. Por padrão a decisão é automática (local = sem SSL, nuvem = com SSL).
// Se precisar forçar, defina DATABASE_SSL=true ou DATABASE_SSL=false no .env.
function precisaDeSsl(): boolean {
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;
  try {
    const host = new URL(url!).hostname;
    return !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return true;
  }
}

export const pool = new pg.Pool({
  connectionString: url,
  ssl: precisaDeSsl() ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
