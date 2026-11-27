import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { APOLLCOMICS_FETCH } from '../src/modules/providers/apollcomics/apollcomics.client';

const catalog = '/v1/catalog/apollcomics';
const origin = 'https://apollcomics.es';

describe('API (e2e)', () => {
  let app: INestApplication;
  const fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APOLLCOMICS_FETCH)
      .useValue(fetchFn)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  beforeEach(() => {
    fetchFn.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /v1/providers lista Aedex, Apoll Comics y Olympus', async () => {
    const res = await request(app.getHttpServer()).get('/v1/providers').expect(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual(['aedex', 'apollcomics', 'olympus']);
  });

  it('devuelve 501 para el lector Aedex pendiente', async () => {
    const res = await request(app.getHttpServer()).get('/v1/catalog/aedex/series/serie/chapters/1/pages').expect(501);
    expect(res.body.error.code).toBe('READER_NOT_AVAILABLE');
  });

  it('GET /v1/providers/:id devuelve 404 con código para un provider desconocido', async () => {
    const res = await request(app.getHttpServer()).get('/v1/providers/desconocido').expect(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('GET /v1/catalog/apollcomics/search?q=serie devuelve resultados', async () => {
    fetchFn.mockResolvedValueOnce(
      new Response('<h3 class="h4"><a href="/manga/serie/">Serie</a></h3>'),
    );
    const res = await request(app.getHttpServer()).get(`${catalog}/search?q=serie`).expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('usa la primera página de novedades por defecto', async () => {
    const html = readFileSync(join(__dirname, 'fixtures/apollcomics/latest-page-1.html'), 'utf8');
    fetchFn.mockResolvedValueOnce(new Response(html));

    const res = await request(app.getHttpServer()).get(`${catalog}/latest`).expect(200);
    expect(res.body).toMatchObject({ page: 1, hasNextPage: true });
    expect(res.body.data).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/manga/?m_orderby=latest`, expect.anything());
  });

  it('devuelve una página vacía cuando el origen responde sin series', async () => {
    fetchFn.mockResolvedValueOnce(new Response('<main></main>'));

    await request(app.getHttpServer()).get(`${catalog}/latest?page=2`).expect(200, {
      data: [],
      page: 2,
      hasNextPage: false,
    });
  });

  it.each(['', '0', '-1', '1.5', 'abc', '1e2', '1&page=2', '9007199254740992'])(
    'rechaza page=%s con INVALID_QUERY',
    async (page) => {
      const res = await request(app.getHttpServer())
        .get(`${catalog}/latest?page=${page}`)
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_QUERY');
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('devuelve PROVIDER_NOT_FOUND al pedir novedades de un provider desconocido', async () => {
    const res = await request(app.getHttpServer()).get('/v1/catalog/desconocido/latest').expect(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('GET /v1/catalog/desconocido/search devuelve 404 con código', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/catalog/desconocido/search?q=serie')
      .expect(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });
});
