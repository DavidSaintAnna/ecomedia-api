import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`🌱 API EcoMedia rodando em http://localhost:${port}`);
  console.log(`📖 Documentação (Swagger): http://localhost:${port}/api-docs`);
});
