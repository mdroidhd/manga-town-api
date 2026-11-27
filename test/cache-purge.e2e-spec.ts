import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CacheController } from '../src/infrastructure/cache/cache.controller';
import { CacheService } from '../src/infrastructure/cache/cache.service';

describe('Purga de caché', () => {
  let app: INestApplication;
  let cache: CacheService;
  async function start(redis?: string) {
    const config = new ConfigService({ CACHE_PURGE_TOKEN: 'secret', REDIS_URL: redis });
    const module = await Test.createTestingModule({ controllers: [CacheController], providers: [CacheService, {provide: ConfigService, useValue: config}] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    cache = app.get(CacheService);
  }
  afterEach(async () => { await app?.close(); });
  it.each([['redis://127.0.0.1:1', 503], [undefined, 200]])('purga L1 con Redis %s y responde %i', async (redis, status) => {
    await start(redis);
    const load = jest.fn(async () => ({status: 'ok' as const, data: 42}));
    await cache.get('p', '1', 'series', {id: 'x'}, load);
    expect((await cache.get('p', '1', 'series', {id: 'x'}, load)).cache).toBe('HIT-L1');
    const response = await request(app.getHttpServer()).post('/v1/cache/purge').set('x-cache-token', 'secret').send({provider: 'p'}).expect(status);
    if (status === 503) expect(response.body).toMatchObject({code: 'CACHE_UNAVAILABLE'});
    else expect(response.body).toEqual({ok: true});
    expect((await cache.get('p', '1', 'series', {id: 'x'}, load)).cache).toBe('MISS');
  });
});
