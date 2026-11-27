import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheStore, CachedValue } from './cache.store';
export class RedisCacheStore implements CacheStore {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly epochKey: string;
  private unavailable = false;
  constructor(url: string, prefix: string) {
    this.epochKey = prefix + 'epoch';
    this.client = new Redis(url, {lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 1000});
    this.client.on('error', () => this.markUnavailable());
    this.client.on('ready', () => { this.unavailable = false; });
    this.client.on('close', () => this.markUnavailable());
    void this.client.connect().catch(() => this.markUnavailable());
  }
  private markUnavailable() {
    if (this.unavailable) return;
    this.unavailable = true;
    this.logger.warn('Redis no disponible; usando L1');
  }
  async get(key: string) {
    if (this.client.status !== 'ready') return undefined;
    try {
      const [raw, ttlMs] = await Promise.all([this.client.get(key), this.client.pttl(key)]);
      if (!raw || ttlMs <= 0) return undefined;
      const value = JSON.parse(raw) as CachedValue;
      return value.status === 'ok' ? {value, ttlMs} : undefined;
    } catch { return undefined; }
  }
  async set(key: string, value: CachedValue, ttlMs: number) {
    if (this.client.status !== 'ready') return;
    try { await this.client.set(key, JSON.stringify(value), 'PX', Math.max(1, Math.floor(ttlMs))); } catch { this.markUnavailable(); }
  }
  async getEpoch() {
    if (this.client.status !== 'ready') return undefined;
    try { return Number(await this.client.get(this.epochKey) ?? 0); } catch { return undefined; }
  }
  async incrementEpoch() {
    if (this.client.status !== 'ready') throw new Error('Redis purge unavailable');
    return this.client.incr(this.epochKey);
  }
  async purge(prefix: string) {
    if (this.client.status !== 'ready') throw new Error('Redis purge unavailable');
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix.replace(/[\\*?[\]]/g, '\\$&')}*`, 'COUNT', 100);
      cursor = next;
      const dataKeys = keys.filter(key => key !== this.epochKey);
      if (dataKeys.length) await this.client.del(...dataKeys);
    } while (cursor !== '0');
  }
  close() { this.client.removeAllListeners('close'); this.client.disconnect(); }
}
