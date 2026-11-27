import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OperationResult } from '../../domain/provider';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';

type Op = 'search' | 'latest' | 'series' | 'chapters';
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly memory = new MemoryCacheStore();
  private readonly pending = new Map<string, Promise<OperationResult<unknown>>>();
  private readonly prefix: string;
  private epoch?: number;
  private lastEpochCheck = 0;
  private epochCheck?: Promise<void>;
  private readonly redis?: RedisCacheStore;
  private generation = 0;
  constructor(private readonly config: ConfigService) {
    this.prefix = config.get<string>('CACHE_PREFIX') || 'mangatown:';
    const url = config.get<string>('REDIS_URL');
    if (url) this.redis = new RedisCacheStore(url, this.prefix);
    else new Logger(CacheService.name).warn('REDIS_URL no configurado; usando L1');
  }
  private invalidate(prefix: string) {
    this.generation++;
    this.pending.clear();
    void this.memory.purge(prefix);
  }
  key(provider: string, version: string, op: Op, params: Record<string, string | number>): string {
    const p = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k, k === 'q' && typeof v === 'string' ? v.trim().toLowerCase() : v]));
    return `${this.prefix}${encodeURIComponent(provider)}:${encodeURIComponent(version)}:${op}:${encodeURIComponent(JSON.stringify(p))}`;
  }
  private ttl(op: Op): number {
    const defaults = { search: 600, latest: 120, series: 3600, chapters: 1800 };
    const n = Number(this.config.get(`CACHE_TTL_${op.toUpperCase()}`));
    return (Number.isSafeInteger(n) && n > 0 ? n : defaults[op]) * 1000;
  }
  private async checkEpoch() {
    if (!this.redis) return;
    if (this.epochCheck) return this.epochCheck;
    const interval = Number(this.config.get('CACHE_EPOCH_CHECK_MS') ?? 5000);
    if (this.lastEpochCheck && Date.now() - this.lastEpochCheck < interval) return;
    this.lastEpochCheck = Date.now();
    this.epochCheck = (async () => {
      const current = await this.redis?.getEpoch();
      if (current === undefined) { this.epoch = undefined; return; }
      if (this.epoch === undefined || this.epoch !== current) this.invalidate(this.prefix);
      this.epoch = current;
    })();
    try { await this.epochCheck; } finally { this.epochCheck = undefined; }
  }
  async get<T>(provider: string, version: string, op: Op, params: Record<string, string | number>, load: () => Promise<OperationResult<T>>): Promise<{result: OperationResult<T>; cache: 'HIT-L1' | 'HIT-L2' | 'MISS'}> {
    await this.checkEpoch();
    const key = this.key(provider, version, op, params);
    const entry = await this.memory.get(key);
    if (entry) return {result: entry.value as OperationResult<T>, cache: 'HIT-L1'};
    const existing = this.pending.get(key);
    if (existing) return {result: await existing as OperationResult<T>, cache: 'MISS'};
    let cache: 'HIT-L2' | 'MISS' = 'MISS';
    const generation = this.generation;
    const task = (async (): Promise<OperationResult<T>> => {
      const remote = await this.redis?.get(key);
      if (remote) {
        if (generation === this.generation) await this.memory.set(key, remote.value, remote.ttlMs);
        cache = 'HIT-L2'; return remote.value as OperationResult<T>;
      }
      const value = await load();
      if (value.status === 'ok' && generation === this.generation) {
        await this.memory.set(key, value, this.ttl(op));
        if (generation === this.generation) await this.redis?.set(key, value, this.ttl(op));
      }
      return value;
    })();
    this.pending.set(key, task);
    try { return {result: await task, cache}; } finally { if (this.pending.get(key) === task) this.pending.delete(key); }
  }
  async purge(provider?: string): Promise<void> {
    const prefix = this.prefix + (provider ? `${encodeURIComponent(provider)}:` : '');
    const inflight = [...this.pending.values()];
    this.invalidate(prefix);
    await Promise.allSettled(inflight);
    await this.memory.purge(prefix);
    if (this.redis) {
      await this.redis.purge(prefix);
      this.epoch = await this.redis.incrementEpoch();
      this.lastEpochCheck = Date.now();
    }
  }
  onModuleDestroy() { this.redis?.close(); }
}
