import "server-only";
import { createHash } from "node:crypto";
import type { AiConfig } from "./config";

/**
 * 共享限流与配额：通过 Upstash Redis REST 实现，跨实例生效。
 * 任何存储错误都“关闭付费路径”，不会放开调用。
 * 仅在本地开发且显式允许时，使用进程内计数（明确不可靠，只用于调试）。
 */

export type GuardResult = { ok: true } | { ok: false; reason: "quota_exhausted" | "rate_limited" | "quota_store_error" };

export interface CounterStore {
  incr(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export class UpstashStore implements CounterStore {
  constructor(private url: string, private token: string) {}
  private async pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`quota store http ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(data) || data.some((d) => d.error)) throw new Error("quota store error");
    return data.map((d) => d.result);
  }
  async incr(key: string, ttl: number) {
    const [n] = await this.pipeline([["INCR", key], ["EXPIRE", key, ttl, "NX"]]);
    const v = Number(n);
    if (!Number.isFinite(v)) throw new Error("bad counter");
    return v;
  }
  async get(key: string) {
    const [v] = await this.pipeline([["GET", key]]);
    return typeof v === "string" ? v : null;
  }
  async set(key: string, value: string, ttl: number) {
    await this.pipeline([["SET", key, value, "EX", ttl]]);
  }
}

/** 进程内存储：只用于本地调试，不可作为全站配额 */
export class LocalDevStore implements CounterStore {
  private m = new Map<string, { v: string; exp: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (e && e.exp < Date.now()) this.m.delete(key);
    return this.m.get(key);
  }
  async incr(key: string, ttl: number) {
    const e = this.live(key);
    const v = (e ? Number(e.v) : 0) + 1;
    this.m.set(key, { v: String(v), exp: e?.exp ?? Date.now() + ttl * 1000 });
    return v;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttl: number) {
    this.m.set(key, { v: value, exp: Date.now() + ttl * 1000 });
  }
}

const g = globalThis as unknown as { __plLocalStore?: LocalDevStore };

export function storeFor(c: AiConfig): CounterStore | null {
  if (c.redisUrl && c.redisToken) return new UpstashStore(c.redisUrl, c.redisToken);
  if (c.allowLocalWithoutQuota || (c.provider === "fixture" && c.isDev)) {
    g.__plLocalStore ??= new LocalDevStore();
    return g.__plLocalStore;
  }
  return null;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`phonelens:${ip}`).digest("hex").slice(0, 16);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const today = () => new Date().toISOString().slice(0, 10);

/** 限流检查（每 IP 十分钟窗口） */
export async function checkRate(store: CounterStore, c: AiConfig, ipHash: string): Promise<GuardResult> {
  try {
    const bucket = Math.floor(Date.now() / 600_000);
    const n = await store.incr(`pl:rl:${ipHash}:${bucket}`, 660);
    return n > c.ratePerIp ? { ok: false, reason: "rate_limited" } : { ok: true };
  } catch {
    return { ok: false, reason: "quota_store_error" };
  }
}

/** 消耗一次全站日配额。每次实际调用（包括重试）都要先调用这里。 */
export async function consumeQuota(store: CounterStore, c: AiConfig): Promise<GuardResult> {
  try {
    const n = await store.incr(`pl:quota:${today()}`, 26 * 3600);
    return n > c.dailyQuota ? { ok: false, reason: "quota_exhausted" } : { ok: true };
  } catch {
    return { ok: false, reason: "quota_store_error" };
  }
}

export async function quotaRemaining(store: CounterStore, c: AiConfig): Promise<number | null> {
  try {
    const v = await store.get(`pl:quota:${today()}`);
    return Math.max(0, c.dailyQuota - Number(v ?? 0));
  } catch {
    return null;
  }
}
