import "server-only";
import type { CounterStore } from "../ai/guard";

/**
 * 推荐结果缓存。有共享存储时跨实例共享；否则退化为进程内缓存（只影响命中率，不影响配额）。
 * 只缓存内置数据的结果；用户上传内容从不进入缓存。
 */
const TTL = 7 * 24 * 3600;
const g = globalThis as unknown as { __plCache?: Map<string, { v: string; exp: number }> };

export async function cacheGet<T>(store: CounterStore | null, key: string): Promise<T | null> {
  try {
    if (store) {
      const v = await store.get(key);
      return v ? (JSON.parse(v) as T) : null;
    }
  } catch {
    return null;
  }
  g.__plCache ??= new Map();
  const e = g.__plCache.get(key);
  if (!e || e.exp < Date.now()) return null;
  return JSON.parse(e.v) as T;
}

export async function cacheSet(store: CounterStore | null, key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  try {
    if (store) return await store.set(key, v, TTL);
  } catch {
    return;
  }
  g.__plCache ??= new Map();
  if (g.__plCache.size > 500) g.__plCache.clear();
  g.__plCache.set(key, { v, exp: Date.now() + TTL * 1000 });
}
