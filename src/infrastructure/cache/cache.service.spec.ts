import { spawnSync } from 'child_process';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;
  let savedUrl: string | undefined;
  beforeEach(() => { savedUrl = process.env.REDIS_URL; delete process.env.REDIS_URL; cache = new CacheService(new ConfigService()); });
  afterEach(() => { cache.onModuleDestroy(); if (savedUrl) process.env.REDIS_URL = savedUrl; });
  it('normaliza claves sin mezclar versiones y parámetros', () => {
    expect(cache.key('p', '1', 'search', { q: ' Foo ' })).toBe(cache.key('p', '1', 'search', { q: 'foo' }));
    expect(cache.key('p', '1', 'search', { q: 'foo' })).not.toBe(cache.key('p', '2', 'search', { q: 'foo' }));
  });
  it('cachea ok y deduplica simultáneos', async () => {
    const load = jest.fn(async () => ({status: 'ok' as const, data: 42}));
    await Promise.all([cache.get('p','1','latest',{page: 1},load),cache.get('p','1','latest',{page: 1},load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect((await cache.get('p','1','latest',{page: 1},load)).cache).toBe('HIT-L1');
    await cache.purge('p');
    expect((await cache.get('p','1','latest',{page: 1},load)).cache).toBe('MISS');
  });
  it('respeta la caducidad L1 y del TTL configurado', async () => {
    jest.useFakeTimers();
    process.env.CACHE_TTL_SERIES = '2';
    try {
      const load = jest.fn(async () => ({status: 'ok' as const, data: 1}));
      await cache.get('p','1','series',{id: 'x'},load);
      jest.advanceTimersByTime(2001);
      expect((await cache.get('p','1','series',{id: 'x'},load)).cache).toBe('MISS');
    } finally { delete process.env.CACHE_TTL_SERIES; jest.useRealTimers(); }
  });
  it('no cachea errores', async () => {
    const load = jest.fn(async () => ({status: 'error' as const, error: {code: 'FAIL', message: 'fail'}}));
    await cache.get('p','1','series',{id: 'a'},load);
    await cache.get('p','1','series',{id: 'a'},load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('Redis compartido opcional', () => {
  const redisTest = process.env.REDIS_URL ? it : it.skip;
  redisTest('comparte datos entre instancias', async () => {
    const config = new ConfigService({CACHE_EPOCH_CHECK_MS: 20});
    const first = new CacheService(config);
    const second = new CacheService(config);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const load = jest.fn(async () => ({status: 'ok' as const, data: 'redis'}));
    try {
      await first.purge('integration-test');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await first.get('integration-test', '1', 'series', {id: 'x'}, load);
      const result = await second.get('integration-test', '1', 'series', {id: 'x'}, load);
      expect(result.cache).toBe('HIT-L2');
      expect(load).toHaveBeenCalledTimes(1);
      expect((await second.get('integration-test', '1', 'series', {id: 'x'}, load)).cache).toBe('HIT-L1');
      await first.purge('integration-test');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect((await second.get('integration-test', '1', 'series', {id: 'x'}, load)).cache).toBe('MISS');
      expect(load).toHaveBeenCalledTimes(2);
      await first.purge('integration-test');
    } finally { first.onModuleDestroy(); second.onModuleDestroy(); }
  });
});

describe('adaptadores e invalidación distribuida', () => {
  const url = 'redis://127.0.0.1:6379';
  const redisTest = spawnSync('redis-cli', ['-h', '127.0.0.1', '-p', '6379', 'ping'], {encoding: 'utf8', timeout: 1000}).stdout?.trim() === 'PONG' ? it : it.skip;
  it('memoria respeta TTL, límite y prefijos', async () => {
    const store = new MemoryCacheStore(1);
    const value = {status: 'ok' as const, data: 1};
    await store.set('a:1', value, 20);
    await store.set('b:1', value, 1000);
    expect(await store.get('a:1')).toBeUndefined();
    await store.purge('b:');
    expect(await store.get('b:1')).toBeUndefined();
    await store.set('a:1', value, 1);
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(await store.get('a:1')).toBeUndefined();
  });
  redisTest('Redis guarda TTL, purga por prefijo y mantiene epoch', async () => {
    const prefix = `test-cache-${Date.now()}:`;
    const store = new RedisCacheStore(url, prefix);
    await new Promise(resolve => setTimeout(resolve, 150));
    try {
      await store.set(prefix + 'a:1', {status: 'ok', data: 1}, 1000);
      expect((await store.get(prefix + 'a:1'))?.value.status).toBe('ok');
      expect(await store.incrementEpoch()).toBe(1);
      await store.purge(prefix);
      expect(await store.get(prefix + 'a:1')).toBeUndefined();
      expect(await store.getEpoch()).toBe(1);
    } finally { store.close(); }
  });
  redisTest('invalida L1 tras purga de otra instancia y obtiene HIT-L2', async () => {
    const prefix = `test-epoch-${Date.now()}:`;
    const config = new ConfigService({REDIS_URL: url, CACHE_PREFIX: prefix, CACHE_EPOCH_CHECK_MS: 20});
    const first = new CacheService(config); const second = new CacheService(config);
    await new Promise(resolve => setTimeout(resolve, 150));
    const load = jest.fn(async () => ({status: 'ok' as const, data: 42}));
    try {
      await first.get('p','1','series',{id:'a'},load);
      expect((await second.get('p','1','series',{id:'a'},load)).cache).toBe('HIT-L2');
      expect((await second.get('p','1','series',{id:'a'},load)).cache).toBe('HIT-L1');
      await first.purge('p');
      await new Promise(resolve => setTimeout(resolve, 30));
      expect((await second.get('p','1','series',{id:'a'},load)).cache).toBe('MISS');
      expect(load).toHaveBeenCalledTimes(2);
      await first.purge();
    } finally { first.onModuleDestroy(); second.onModuleDestroy(); }
  });
});
