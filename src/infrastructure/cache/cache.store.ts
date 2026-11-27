import type { OperationResult } from '../../domain/provider';
export type CachedValue = OperationResult<unknown>;
export interface CacheStore {
  get(key: string): Promise<{ value: CachedValue; ttlMs: number } | undefined>;
  set(key: string, value: CachedValue, ttlMs: number): Promise<void>;
  purge(prefix: string): Promise<void>;
  getEpoch(): Promise<number | undefined>;
  incrementEpoch(): Promise<number | undefined>;
}
