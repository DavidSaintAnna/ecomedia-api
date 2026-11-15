// O Swagger UI vem com os textos da interface em inglês ("Authorize", "Try it out", "Execute"...).
// Este script, servido pela própria API em /api-docs/traducao-pt-br.js, troca esses textos por português
// enquanto a página é desenhada. Os textos que NÃO estão no dicionário (por exemplo, nomes de campos)
// simplesmente ficam como estão.
//
// Ele roda no NAVEGADOR e por isso é guardado como texto puro (JavaScript simples, sem TypeScript):
// assim chega ao navegador exatamente como está escrito aqui.
// Também é um arquivo à parte, e não um <script> dentro do HTML, porque a política de segurança do
// helmet só aceita scripts vindos do próprio servidor.

export const scriptTraducaoSwagger = String.raw`(function () {
var dicionario = {
  'Authorize': 'Autorizar',
  'Authorized': 'Autorizado',
  'Available authorizations': 'Autorizações disponíveis',
  'Logout': 'Sair',
  'Close': 'Fechar',
  'Value:': 'Valor:',
  'Try it out': 'Testar',
  'Cancel': 'Cancelar',
  'Execute': 'Executar',
  'Clear': 'Limpar',
  'Reset': 'Restaurar',
  'Parameters': 'Parâmetros',
  'No parameters': 'Sem parâmetros',
  'Parameter content type': 'Tipo de conteúdo do parâmetro',
  'Request body': 'Corpo da requisição',
  'Response body': 'Corpo da resposta',
  'Response headers': 'Cabeçalhos da resposta',
  'Responses': 'Respostas',
  'Server response': 'Resposta do servidor',
  'Code': 'Código',
  'Details': 'Detalhes',
  'Description': 'Descrição',
  'Name': 'Nome',
  'Links': 'Links',
  'No links': 'Sem links',
  'Media type': 'Tipo de mídia',
  'Controls Accept header.': 'Controla o cabeçalho Accept.',
  'Example Value': 'Exemplo',
  'Example': 'Exemplo',
  'Examples': 'Exemplos',
  'Schema': 'Esquema',
  'Schemas': 'Esquemas',
  'Model': 'Modelo',
  'Request URL': 'URL da requisição',
  'Request duration': 'Duração da requisição',
  'Curl': 'Curl',
  'Download': 'Baixar',
  'Servers': 'Servidores',
  'Server': 'Servidor',
  'Computed URL': 'URL calculada',
  'Loading...': 'Carregando...',
  'Undocumented': 'Não documentado',
  'No content': 'Sem conteúdo',
  'required': 'obrigatório',
  'Required': 'Obrigatório',
  'optional': 'opcional',
  'Available values': 'Valores possíveis',
  'Available values :': 'Valores possíveis:',
  'Default value': 'Valor padrão',
  'Expand all': 'Expandir tudo',
  'Collapse all': 'Recolher tudo',
  'Show': 'Mostrar',
  'Hide': 'Ocultar',
  'Copy to clipboard': 'Copiar',
  'Copied': 'Copiado',
  'Send empty value': 'Enviar valor vazio',
  'Select a response': 'Escolha uma resposta',
  'Terms of service': 'Termos de serviço',
  'Find out more': 'Saiba mais',
  'License': 'Licença',
  'Contact': 'Contato',
  'Filter by tag': 'Filtrar por tag',
  'Filter by tag or path': 'Filtrar por grupo ou rota',
  'Skip to operations': 'Pular para as rotas',
  'Explore': 'Explorar',
  'Edit Value': 'Editar valor',
  'Controls': 'Controla o cabeçalho',
  'header.': '(tipo de resposta aceito).',
  'Cancel Request': 'Cancelar',
  'Choose file': 'Escolher arquivo',
  'string': 'texto',
  'integer': 'número inteiro',
  'boolean': 'verdadeiro/falso',
  'array': 'lista',
  'object': 'objeto',
  'number': 'número',
};

// Prefixos que aparecem coladinhos num valor (ex.: "default: 10", "Example : 1")
var prefixos = [
  [/^default\s*:/i, 'padrão:'],
  [/^minimum\s*:/i, 'mínimo:'],
  [/^maximum\s*:/i, 'máximo:'],
  [/^minLength\s*:/i, 'tamanho mínimo:'],
  [/^maxLength\s*:/i, 'tamanho máximo:'],
  [/^Example\s*:/, 'Exemplo:'],
  [/^Available values\s*:/, 'Valores possíveis:'],
  [/^Allowed values\s*:/, 'Valores permitidos:'],
  [/^enum\s*:/i, 'valores:'],
  [/^format\s*:/i, 'formato:'],
];

function traduzirTexto(original) {
  var t = original.trim();
  if (!t) return null;
  var direto = dicionario[t];
  if (direto) return original.replace(t, direto);
  for (var i = 0; i < prefixos.length; i++) {
    if (prefixos[i][0].test(t)) return original.replace(prefixos[i][0], prefixos[i][1]);
  }
  return null;
}

function percorrer(no) {
  if (no.nodeType === Node.TEXT_NODE) {
    var novo = traduzirTexto(no.nodeValue || '');
    if (novo !== null && novo !== no.nodeValue) no.nodeValue = novo;
    return;
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return;
  var el = no;
  if (['SCRIPT', 'STYLE', 'PRE', 'CODE', 'TEXTAREA'].includes(el.tagName)) {
    // Não mexe em exemplos de código, JSON, curl etc. (só no placeholder abaixo)
  } else {
    el.childNodes.forEach(percorrer);
  }
  ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
    var v = el.getAttribute && el.getAttribute(attr);
    if (v) {
      var novo = traduzirTexto(v);
      if (novo !== null && novo !== v) el.setAttribute(attr, novo);
    }
  });
}

function iniciar() {
  document.documentElement.lang = 'pt-BR';
  percorrer(document.body);
  new MutationObserver(function (mudancas) {
    mudancas.forEach(function (m) {
      m.addedNodes.forEach(percorrer);
      if (m.type === 'characterData') percorrer(m.target);
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
})();
`;
