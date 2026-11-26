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

  it('GET /v1/providers lista el provider de ejemplo', async () => {
    const res = await request(app.getHttpServer()).get('/v1/providers').expect(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain('demo');
  });

  it('GET /v1/catalog/demo/search?q=serie devuelve resultados', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/catalog/demo/search?q=serie')
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /v1/catalog/desconocido/search devuelve 404 con código', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/catalog/desconocido/search?q=serie')
      .expect(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });
});
