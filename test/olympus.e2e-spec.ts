import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { OLYMPUS_FETCH } from '../src/modules/providers/olympus/olympus.client';

const fixtureDir = join(process.cwd(), 'test/fixtures/olympus');
const fixture = (name: string): string => readFileSync(join(fixtureDir, name), 'utf8');
const chapters = JSON.parse(fixture('chapters.json')) as { page1: unknown; page2: unknown };
const origin = 'https://olympusxyz.com';
const slug = '20-225-2sabueso13424';
const readerPath = `/series/comic-${slug}/capitulo/190`;

describe('Olympus (e2e sin red externa)', () => {
  let app: INestApplication;
  let fetchFn: jest.MockedFunction<typeof fetch>;
  const unexpected: string[] = [];

  beforeAll(async () => {
    fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (input, init) => {
      const url = String(input);
      if (init?.redirect !== 'manual' || init.method !== 'GET') {
        throw new Error('HTTP options invalid');
      }
      if (url === 'https://olympus.pages.dev/') return new Response(fixture('landing.html'));
      if (url === `${origin}/api/series/list`) return new Response(fixture('series-list.json'));
      if (url === `${origin}/api/new-chapters?page=1`) {
        return new Response(fixture('latest-page-1.json'));
      }
      if (url === `${origin}/api/new-chapters?page=20`) {
        return new Response(fixture('latest-page-20.json'));
      }
      if (url === `${origin}/api/new-chapters?page=2`) return new Response('json inválido');
      if (url === `${origin}/api/series/${slug}?type=comic`) {
        return new Response(fixture('series-detail.json'));
      }
      if (url === `${origin}/api/series/missing?type=comic`) {
        return new Response(null, { status: 404 });
      }
      if (url === `${origin}/api/series/${slug}/chapters?page=1&direction=desc&type=comic`) {
        return new Response(JSON.stringify(chapters.page1));
      }
      if (url === `${origin}/api/series/${slug}/chapters?page=2&direction=desc&type=comic`) {
        return new Response(JSON.stringify(chapters.page2));
      }
      if (url === `${origin}/capitulo/135953/comic-${slug}`) {
        return new Response(null, { status: 301, headers: { location: readerPath } });
      }
      if (url === origin + readerPath) return new Response(fixture('chapter.html'));
      if (url === `${origin}/capitulo/7/comic-externa`) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://evil.invalid/series/comic-externa/capitulo/1' },
        });
      }
      if (url === `${origin}/capitulo/8/comic-vacia`) {
        return new Response('<main class="strip"></main>');
      }
      unexpected.push(url);
      throw new Error('Petición no pactada');
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OLYMPUS_FETCH)
      .useValue(fetchFn)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await app.close();
    expect(unexpected).toEqual([]);
  });

  it('expone el manifiesto de Olympus', async () => {
    const response = await request(app.getHttpServer()).get('/v1/providers/olympus').expect(200);
    expect(response.body.data).toMatchObject({
      id: 'olympus',
      name: 'Olympus Scanlation',
      version: '0.1.0',
      contractVersion: 1,
      kinds: ['comic'],
      languages: ['es'],
      capabilities: { login: 'none', captcha: 'none', pages: 'server', deviceEgress: false },
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('busca cómics usando el listado simulado', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalog/olympus/search')
      .query({ q: 'cronica del heroe' })
      .expect(200);
    expect(response.body.data).toEqual([
      {
        id: 'cronica-del-heroe-aureo',
        providerId: 'olympus',
        title: 'Crónica del Héroe Áureo',
        coverUrl: `${origin}/covers/aureo.webp`,
      },
    ]);
  });

  it('devuelve cómics recientes sin duplicados e indica la última página', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalog/olympus/latest?page=1')
      .expect(200, {
        data: [
          {
            id: 'sabueso',
            providerId: 'olympus',
            title: 'Sabueso',
            coverUrl: `${origin}/covers/sabueso.webp`,
          },
          {
            id: 'torre',
            providerId: 'olympus',
            title: 'La torre',
            coverUrl: 'https://media.imagesolymp.xyz/comics/covers/82/torre.webp',
          },
        ],
        page: 1,
        hasNextPage: true,
      });
    await request(app.getHttpServer())
      .get('/v1/catalog/olympus/latest?page=20')
      .expect(200, {
        data: [{ id: 'cronicas', providerId: 'olympus', title: 'Crónicas' }],
        page: 20,
        hasNextPage: false,
      });
  });

  it('devuelve UPSTREAM_INVALID_RESPONSE si el listado reciente contiene JSON inválido', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalog/olympus/latest?page=2')
      .expect(502);
    expect(response.body.error.code).toBe('UPSTREAM_INVALID_RESPONSE');
  });

  it('consulta la ficha por slug', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/catalog/olympus/series/${slug}`)
      .expect(200);
    expect(response.body.data).toEqual({
      id: slug,
      providerId: 'olympus',
      title: '20-225: 2 Sabueso',
      description: 'Un cazador sigue el rastro de dos sabuesos.',
    });
  });

  it('pagina capítulos y mantiene el orden y sus identificadores', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/catalog/olympus/series/${slug}/chapters`)
      .expect(200);
    expect(response.body.data).toEqual([
      { id: '135953', number: '190', publishedAt: '2026-11-24T18:42:00.000000Z' },
      { id: '135952', number: '189.5', publishedAt: '2026-11-20T10:10:00.000000Z' },
      { id: '135951', number: '189' },
    ]);
  });

  it('sigue un 301 autorizado y ordena las páginas del lector', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/catalog/olympus/series/${slug}/chapters/135953/pages`)
      .expect(200);
    expect(response.body.data).toEqual(
      [0, 1, 2].map((index) => ({
        index,
        url: `https://media.imagesolymp.xyz/comics/743/135953/${index}_${index + 1}.webp`,
      })),
    );
    const called = fetchFn.mock.calls.map(([input]) => String(input));
    expect(called).toContain(`${origin}/capitulo/135953/comic-${slug}`);
    expect(called).toContain(origin + readerPath);
  });

  it('devuelve 404 NOT_FOUND para ficha inexistente', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalog/olympus/series/missing')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rechaza un Location externo sin contactar ese host', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalog/olympus/series/externa/chapters/7/pages')
      .expect(502);
    expect(response.body.error.code).toBe('UPSTREAM_INVALID_RESPONSE');
    expect(fetchFn.mock.calls.some(([input]) => String(input).includes('evil.invalid'))).toBe(false);
  });

  it('devuelve 502 ante lector sin paneles válidos', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalog/olympus/series/vacia/chapters/8/pages')
      .expect(502);
    expect(response.body.error.code).toBe('UPSTREAM_INVALID_RESPONSE');
  });
});
