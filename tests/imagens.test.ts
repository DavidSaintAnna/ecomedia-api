import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { images } from '../src/db/schema.js';
import { api, auth, categorias, criarUsuario, loginAdmin } from './helpers.js';

// Um PNG de verdade (1x1 pixel) e cabeçalhos mínimos de JPEG e WebP
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([100, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(100, 2)]);

const enviar = (token: string, corpo: Buffer, tipo = 'image/png') =>
  api().post('/api/images').set(auth(token)).set('Content-Type', tipo).send(corpo);

// Faz a imagem parecer antiga, para passar da carência de 1 hora antes da limpeza
const envelhecer = (id: number) =>
  db.update(images).set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }).where(eq(images.id, id));
const existe = async (id: number) => (await db.select({ id: images.id }).from(images).where(eq(images.id, id))).length === 1;
const idDaUrl = (url: string) => Number(url.split('/').pop());

describe('enviar foto do computador', () => {
  it('guarda a imagem e devolve o link para usar como foto de perfil', async () => {
    const eu = await criarUsuario('Foto Perfil');
    const r = await enviar(eu.token, PNG);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ contentType: 'image/png', size: PNG.length });
    expect(r.body.url).toMatch(/^https?:\/\/.+\/api\/images\/\d+$/);

    // o link é aceito pelo perfil e a imagem aparece no endereço
    const perfil = await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: r.body.url });
    expect(perfil.status).toBe(200);
    expect(perfil.body.avatarUrl).toBe(r.body.url);

    const img = await api().get(`/api/images/${r.body.id}`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(img.body, PNG)).toBe(0);
  });

  it('serve a imagem para qualquer pessoa, com cache longo e liberada para outros sites', async () => {
    const eu = await criarUsuario('Foto Publica');
    const { body } = await enviar(eu.token, JPEG, 'image/jpeg');
    const r = await api().get(`/api/images/${body.id}`); // sem login
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
    expect(r.headers['cache-control']).toContain('immutable');
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('aceita PNG, JPEG e WebP e usa a imagem numa publicação', async () => {
    const eu = await criarUsuario('Foto Post');
    const reciclagem = (await categorias())['Reciclagem'];
    for (const [corpo, tipo] of [[PNG, 'image/png'], [JPEG, 'image/jpeg'], [WEBP, 'image/webp']] as const) {
      expect((await enviar(eu.token, corpo, tipo)).status).toBe(201);
    }
    const { body } = await enviar(eu.token, WEBP, 'image/webp');
    const post = await api()
      .post('/api/posts')
      .set(auth(eu.token))
      .send({ categoryId: reciclagem, content: 'Post com foto enviada do computador', imageUrl: body.url });
    expect(post.status).toBe(201);
    expect(post.body.imageUrl).toBe(body.url);
  });

  it('exige login para enviar', async () => {
    expect((await api().post('/api/images').set('Content-Type', 'image/png').send(PNG)).status).toBe(401);
  });

  it('recusa o que não é PNG, JPEG ou WebP de verdade', async () => {
    const eu = await criarUsuario('Foto Errada');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const casos: [string, Buffer, string][] = [
      ['SVG (pode carregar script)', svg, 'image/svg+xml'],
      ['texto', Buffer.from('oi, eu sou uma foto'), 'text/plain'],
      ['texto dizendo ser PNG', Buffer.from('não sou imagem nenhuma'), 'image/png'],
      ['JPEG dizendo ser PNG', JPEG, 'image/png'],
      ['arquivo vazio', Buffer.alloc(0), 'image/png'],
    ];
    for (const [nome, corpo, tipo] of casos) {
      const r = await enviar(eu.token, corpo, tipo);
      expect(r.status, nome).toBe(415);
      expect(r.body.error).toBe('UnsupportedMediaType');
    }
    const json = await api().post('/api/images').set(auth(eu.token)).send({ url: 'http://x.com/a.png' });
    expect(json.status).toBe(415);
  });

  it('recusa imagem maior que 512 KB', async () => {
    const eu = await criarUsuario('Foto Grande');
    const grande = Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(512 * 1024 + 10, 7)]);
    const r = await enviar(eu.token, grande);
    expect(r.status).toBe(413);
    expect(r.body.message).toBe('A imagem é grande demais (máximo de 512 KB)');
    // as outras rotas continuam com o limite de 100 KB para JSON
    const json = await api().post('/api/posts').set(auth(eu.token)).send({ content: 'x'.repeat(200_000) });
    expect(json.status).toBe(413);
    expect(json.body.message).toContain('100 KB');
  });

  it('GET de imagem que não existe dá 404, e id inválido dá 400', async () => {
    expect((await api().get('/api/images/99999')).status).toBe(404);
    expect((await api().get('/api/images/abc')).status).toBe(400);
  });

  it('limita a 20 imagens por pessoa (e não atrapalha as outras pessoas)', async () => {
    const eu = await criarUsuario('Foto Muitas');
    const outra = await criarUsuario('Foto Outra');
    for (let i = 0; i < 20; i++) expect((await enviar(eu.token, PNG)).status).toBe(201);
    const r = await enviar(eu.token, PNG);
    expect(r.status).toBe(409);
    expect(r.body.message).toContain('limite de 20 imagens');
    expect((await enviar(outra.token, PNG)).status).toBe(201);
  });
});

describe('limpeza das imagens que ninguém usa mais', () => {
  it('trocar a foto do perfil apaga a antiga, mas só depois da carência de 1 hora', async () => {
    const eu = await criarUsuario('Troca Foto');
    const velha = (await enviar(eu.token, PNG)).body;
    const nova = (await enviar(eu.token, JPEG, 'image/jpeg')).body;
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: velha.url });

    // trocar logo depois do envio: a antiga é recente, então ainda fica (pode estar numa tela aberta)
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: nova.url });
    expect(await existe(velha.id)).toBe(true);

    // com mais de 1 hora e sem uso, some na próxima troca; a que está em uso nunca some
    await envelhecer(velha.id);
    await envelhecer(nova.id);
    await api().patch('/api/users/me').set(auth(eu.token)).send({ bio: 'Só mudei a bio agora' });
    expect(await existe(velha.id)).toBe(true); // bio não mexe nas fotos
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: nova.url });
    expect(await existe(velha.id)).toBe(false);
    expect(await existe(nova.id)).toBe(true);
  });

  it('excluir ou trocar a foto de uma publicação apaga a imagem; uma imagem em uso em outro lugar fica', async () => {
    const eu = await criarUsuario('Limpa Post');
    const reciclagem = (await categorias())['Reciclagem'];
    const foto = (await enviar(eu.token, PNG)).body;
    const post = await api()
      .post('/api/posts')
      .set(auth(eu.token))
      .send({ categoryId: reciclagem, content: 'Publicação com uma foto bem bonita', imageUrl: foto.url });
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: foto.url }); // mesma foto no perfil
    await envelhecer(foto.id);

    // o post some, mas o perfil ainda usa a foto
    await api().delete(`/api/posts/${post.body.id}`).set(auth(eu.token));
    expect(await existe(foto.id)).toBe(true);

    // tirando do perfil também, ela some
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: null });
    expect(await existe(foto.id)).toBe(false);
    expect((await api().get(`/api/images/${foto.id}`)).status).toBe(404);
  });

  it('administrador que edita a publicação de outra pessoa limpa as imagens da AUTORA', async () => {
    const autora = await criarUsuario('Autora Foto');
    const admin = await loginAdmin();
    const reciclagem = (await categorias())['Reciclagem'];
    const foto = (await enviar(autora.token, PNG)).body;
    const post = await api()
      .post('/api/posts')
      .set(auth(autora.token))
      .send({ categoryId: reciclagem, content: 'Publicação que o admin vai editar', imageUrl: foto.url });
    await envelhecer(foto.id);
    const r = await api().patch(`/api/posts/${post.body.id}`).set(auth(admin)).send({ imageUrl: null });
    expect(r.status).toBe(200);
    expect(await existe(foto.id)).toBe(false);
  });

  it('excluir a conta apaga as imagens da pessoa', async () => {
    const eu = await criarUsuario('Conta Foto');
    const foto = (await enviar(eu.token, PNG)).body;
    await api().patch('/api/users/me').set(auth(eu.token)).send({ avatarUrl: foto.url });
    expect((await api().delete('/api/users/me').set(auth(eu.token))).status).toBe(204);
    expect(await existe(foto.id)).toBe(false);
  });

  it('a limpeza só mexe nas imagens de quem fez a alteração', async () => {
    const a = await criarUsuario('Dona A');
    const b = await criarUsuario('Dono B');
    const deB = (await enviar(b.token, PNG)).body; // solta, mas é de outra pessoa
    await envelhecer(deB.id);
    await api().patch('/api/users/me').set(auth(a.token)).send({ avatarUrl: null });
    expect(await existe(deB.id)).toBe(true);
    expect(idDaUrl(deB.url)).toBe(deB.id);
  });
});
