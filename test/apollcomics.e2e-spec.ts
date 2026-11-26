import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { APOLLCOMICS_FETCH } from '../src/modules/providers/apollcomics/apollcomics.client';

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'test/fixtures/apollcomics', name), 'utf8');
const origin = 'https://apollcomics.es';
const catalog = '/v1/catalog/apollcomics';
const slug = 'el-invocador-solitario-de-clase-sss';
const seriesUrl = `${origin}/manga/${slug}/`;

describe('Apoll Comics (e2e sin red externa)', () => {
  let app: INestApplication;
  let fetchFn: jest.MockedFunction<typeof fetch>;
  const unexpected: string[] = [];

  beforeAll(async () => {
    fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (input, init) => {
      const url = String(input);
      if (init?.method !== 'GET' || init.redirect !== 'manual') {
        unexpected.push(url);
        throw new Error('Opciones HTTP inesperadas');
      }
      switch (url) {
        case `${origin}/?s=invocador+%26+acci%C3%B3n&post_type=wp-manga`:
          return new Response(fixture('search.html'));
        case seriesUrl:
          return new Response(fixture('series.html'));
        case `${seriesUrl}?style=list`:
          return new Response(fixture('chapters.html'));
        case `${seriesUrl}capitulo-1/`:
          return new Response(fixture('reader.html'));
        case `${origin}/manga/ausente/`:
        case `${origin}/manga/ausente/?style=list`:
        case `${seriesUrl}capitulo-ausente/`:
          return new Response(null, { status: 404 });
        case `${seriesUrl}capitulo-invalido/`:
          return new Response('<div class="reading-content"></div>');
        case `${origin}/manga/redirigida/`:
          return new Response(null, {
            status: 302,
            headers: { location: 'https://externo.invalid/manga/redirigida/' },
          });
        default:
          unexpected.push(url);
          throw new Error('Petición inesperada');
      }
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APOLLCOMICS_FETCH)
      .useValue(fetchFn)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    fetchFn.mockClear();
  });

  afterAll(async () => {
    await app.close();
    expect(unexpected).toEqual([]);
  });

  it('registra el manifiesto junto a demo y Olympus', async () => {
    const list = await request(app.getHttpServer()).get('/v1/providers').expect(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(['demo', 'olympus', 'apollcomics']),
    );
    const response = await request(app.getHttpServer())
      .get('/v1/providers/apollcomics')
      .expect(200);
    expect(response.body.data).toEqual({
      id: 'apollcomics',
      name: 'Apoll Comics',
      version: '0.1.0',
      contractVersion: 1,
      kinds: ['comic'],
      languages: ['es'],
      origins: [origin, 'https://cdn1.apollcomics.com'],
      capabilities: { login: 'none', captcha: 'none', pages: 'server', deviceEgress: false },
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('busca por WordPress y conserva los slugs válidos en el orden del HTML', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/search`)
      .query({ q: 'invocador & acción' })
      .expect(200);
    expect(response.body.data).toEqual([
      { id: slug, providerId: 'apollcomics', title: 'El invocador solitario de clase SSS' },
      { id: 'leviatan', providerId: 'apollcomics', title: 'Leviatán' },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('consulta la ficha por slug e incluye los campos disponibles', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/series/${slug}`)
      .expect(200);
    expect(response.body.data).toEqual({
      id: slug,
      providerId: 'apollcomics',
      title: 'El invocador solitario de clase SSS',
      coverUrl: `${origin}/wp-content/uploads/invocador.jpg`,
      description: 'Un invocador intenta sobrevivir por su cuenta.',
      status: 'En curso',
    });
  });

  it('solicita la lista completa y devuelve los slugs de los capítulos en orden', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/series/${slug}/chapters`)
      .expect(200);
    expect(response.body.data).toEqual([
      { id: 'capitulo-55', number: '55' },
      { id: 'capitulo-2-5', number: '2.5' },
      { id: 'especial', number: 'Especial de invierno' },
      { id: 'capitulo-1', number: '1' },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(`${seriesUrl}?style=list`, expect.anything());
  });

  it('resuelve las imágenes del lector en el orden del HTML', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/series/${slug}/chapters/capitulo-1/pages`)
      .expect(200);
    expect(response.body.data).toEqual([
      { index: 0, url: 'https://cdn1.apollcomics.com/invocador/1/02.jpg' },
      { index: 1, url: 'https://cdn1.apollcomics.com/invocador/1/01.png' },
      { index: 2, url: `${origin}/wp-content/uploads/invocador/1/03.jpg` },
    ]);
  });

  it.each(['ausente', 'ausente/chapters', `${slug}/chapters/capitulo-ausente/pages`])(
    'devuelve 404 NOT_FOUND para %s',
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(`${catalog}/series/${path}`)
        .expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    },
  );

  it('devuelve 502 ante un lector sin imágenes', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/series/${slug}/chapters/capitulo-invalido/pages`)
      .expect(502);
    expect(response.body.error.code).toBe('UPSTREAM_INVALID_RESPONSE');
  });

  it('devuelve 502 ante una redirección sin contactar con el destino', async () => {
    const response = await request(app.getHttpServer())
      .get(`${catalog}/series/redirigida`)
      .expect(502);
    expect(response.body.error.code).toBe('UPSTREAM_INVALID_RESPONSE');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
