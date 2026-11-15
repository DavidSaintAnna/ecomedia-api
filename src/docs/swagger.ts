import cors from 'cors';
import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './openapi.js';
import { scriptTraducaoSwagger } from './traducao-swagger.js';

// Tudo o que é documentação fica neste roteador:
//   /api-docs                      página interativa (Swagger UI), em português
//   /api-docs.json                 a especificação OpenAPI em JSON (serve para Postman, Insomnia, geradores de cliente...)
//   /api-docs/traducao-pt-br.js    script que traduz os textos da interface do Swagger UI
//   /docs                          atalho que redireciona para /api-docs
export const docsRouter = Router();

// O Swagger UI precisa de uma política de segurança (CSP) um pouco mais aberta que a do resto da API:
// carrega estilos embutidos e imagens "data:". Scripts continuam permitidos apenas do próprio servidor.
docsRouter.use(
  '/api-docs',
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }),
);

docsRouter.get('/docs', (_req, res) => res.redirect('/api-docs'));

// A especificação é pública e somente leitura, então qualquer site pode lê-la
docsRouter.get('/api-docs.json', cors(), (_req, res) => {
  res.json(openapi);
});

docsRouter.get('/api-docs/traducao-pt-br.js', (_req, res) => {
  res.type('application/javascript; charset=utf-8').send(scriptTraducaoSwagger);
});

docsRouter.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customSiteTitle: 'API EcoMedia — Documentação',
    customJs: '/api-docs/traducao-pt-br.js',
    // Alguns textos do Swagger UI são gerados por CSS (não dá para traduzir por JavaScript), então são trocados aqui
    customCss: [
      '.swagger-ui .topbar { display: none }',
      '.swagger-ui .info { margin: 30px 0 }',
      '.swagger-ui .parameter__name.required:after { content: "obrigatório" }',
      '.swagger-ui .loading-container .loading:after { content: "carregando" }',
    ].join(' '),
    swaggerOptions: {
      docExpansion: 'none', // começa com as rotas fechadas, só os grupos aparecem
      filter: true, // caixa "Filtrar por tag"
      persistAuthorization: true, // lembra o token se a página for recarregada
      displayRequestDuration: true,
    },
  }),
);
