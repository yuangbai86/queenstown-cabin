/**
 * 结构化输入校验：URL 参数与 API 请求体都经过这里。
 */
import { z } from "zod";
import type { EcoDevice, Preference, SampleWindow, UserNeeds } from "./types";

export const PREF_VALUES = ["camera", "gaming", "battery", "handling", "ecosystem"] as const;
export const ECO_VALUES = ["ipad", "mac", "apple_watch", "android_tablet", "windows_pc", "android_watch"] as const;

export const CompareInputSchema = z.object({
  a: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  b: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  budget: z.number().int().min(500).max(50000).nullable(),
  prefs: z.array(z.enum(PREF_VALUES)).min(1).max(2).refine((p) => new Set(p).size === p.length, "偏好不能重复"),
  device: z.enum(["iphone", "android"]).nullable(),
  eco: z.array(z.enum(ECO_VALUES)).max(6),
  window: z.enum(["90d", "all"]),
});
export type CompareInput = z.infer<typeof CompareInputSchema>;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseCompareParams(sp: Params): { ok: true; input: CompareInput } | { ok: false; error: string } {
  const budgetRaw = one(sp.budget).trim();
  const budgetNum = budgetRaw ? Number(budgetRaw) : null;
  const raw = {
    a: one(sp.a),
    b: one(sp.b),
    budget: budgetNum !== null && Number.isFinite(budgetNum) ? Math.round(budgetNum) : null,
    prefs: one(sp.p).split(",").filter(Boolean),
    device: one(sp.dev) || null,
    eco: one(sp.eco).split(",").filter(Boolean),
    window: one(sp.win) || "90d",
  };
  const r = CompareInputSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.path.join(".")).join("、") };
  return { ok: true, input: r.data };
}

export function needsOf(i: CompareInput): UserNeeds {
  return { budget: i.budget, prefs: i.prefs as Preference[], device: i.device, eco: i.eco as EcoDevice[] };
}

export function toSearch(i: { a: string; b: string; budget: number | null; prefs: string[]; device: string | null; eco: string[]; window?: SampleWindow }): string {
  const q = new URLSearchParams();
  q.set("a", i.a);
  q.set("b", i.b);
  if (i.budget) q.set("budget", String(i.budget));
  q.set("p", i.prefs.join(","));
  if (i.device) q.set("dev", i.device);
  if (i.eco.length) q.set("eco", i.eco.join(","));
  if (i.window && i.window !== "90d") q.set("win", i.window);
  return q.toString();
}

export const EXAMPLE = { a: "demo-alpha", b: "demo-beta", budget: 6000, prefs: ["handling", "battery"], device: "android", eco: [] as string[] };
