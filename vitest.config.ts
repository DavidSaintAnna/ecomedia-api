import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Valores fixos para os testes: nunca dependem do seu .env e nunca apontam para o banco real
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
      DATABASE_URL: 'postgres://teste:teste@localhost:1/teste', // endereço falso de propósito
      DATABASE_SSL: 'false',
      CORS_ORIGIN: 'http://localhost:5173',
      ADMIN_EMAIL: 'admin@teste.dev',
      ADMIN_PASSWORD: 'AdminTeste123',
    },
  },
});
