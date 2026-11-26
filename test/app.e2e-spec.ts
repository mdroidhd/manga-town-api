import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /v1/providers lista demo y Olympus', async () => {
    const res = await request(app.getHttpServer()).get('/v1/providers').expect(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual(
      expect.arrayContaining(['demo', 'olympus']),
    );
  });

  it('GET /v1/catalog/demo/search?q=serie devuelve resultados', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/catalog/demo/search?q=serie')
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('lista las novedades de Demo y usa la primera página por defecto', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalog/demo/latest')
      .expect(200, {
        data: [{ id: 'demo-1', providerId: 'demo', title: 'Serie de ejemplo' }],
        page: 1,
        hasNextPage: false,
      });
  });

  it('devuelve una página vacía de Demo después de la primera', async () => {
    await request(app.getHttpServer()).get('/v1/catalog/demo/latest?page=2').expect(200, {
      data: [],
      page: 2,
      hasNextPage: false,
    });
  });

  it.each(['', '0', '-1', '1.5', 'abc', '1e2', '1&page=2', '9007199254740992'])(
    'rechaza page=%s con INVALID_QUERY',
    async (page) => {
      const res = await request(app.getHttpServer())
        .get(`/v1/catalog/demo/latest?page=${page}`)
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_QUERY');
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
