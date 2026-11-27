import { CacheStore, CachedValue } from './cache.store';
export class MemoryCacheStore implements CacheStore {
  constructor(private readonly capacity = 1000) {}
  private epoch = 0;
  async getEpoch() { return this.epoch; }
  async incrementEpoch() { return ++this.epoch; }
  private readonly entries = new Map<string, {value: CachedValue; expires: number}>();
  async get(key: string) {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= Date.now()) { this.entries.delete(key); return undefined; }
    this.entries.delete(key); this.entries.set(key, entry);
    return { value: entry.value, ttlMs: entry.expires - Date.now() };
  }
  async set(key: string, value: CachedValue, ttlMs: number) {
    this.entries.delete(key); this.entries.set(key, {value, expires: Date.now() + Math.min(ttlMs, 30000)});
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value as string);
  }
  async purge(prefix: string) { for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key); }
}
