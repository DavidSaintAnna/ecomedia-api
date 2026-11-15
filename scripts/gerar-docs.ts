// Gera os arquivos de documentação da pasta docs/ a partir de src/docs/openapi.ts:
//   docs/openapi.json                       a especificação OpenAPI (importável no Postman, Insomnia etc.)
//   docs/ecomedia.postman_collection.json   a coleção de testes do Postman
//
// Uso:  npm run docs:gerar
import { mkdirSync, writeFileSync } from 'node:fs';
import { openapi } from '../src/docs/openapi.js';
import { gerarColecao } from '../src/docs/postman.js';

mkdirSync('docs', { recursive: true });
writeFileSync('docs/openapi.json', JSON.stringify(openapi, null, 2) + '\n');
writeFileSync('docs/ecomedia.postman_collection.json', JSON.stringify(gerarColecao(), null, 2) + '\n');

console.log('✅ docs/openapi.json');
console.log('✅ docs/ecomedia.postman_collection.json');
