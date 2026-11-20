/**
 * AI 个性化解释：输入压缩材料，输出再经过程序校验。
 * 纯函数，不访问网络，便于测试。
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { RecStatus } from "../types";
import { DIMENSIONS } from "../types";
import { DIMENSION_LABEL, ECO_LABEL, PREFERENCE_LABEL } from "../labels";
import type { Comparison } from "./compare";
import type { Claim } from "./engine";

export const ClaimSchema = z.object({
  text: z.string().min(1).max(220),
  evidence: z.array(z.string().max(80)).max(8),
});

export const AiRecommendationSchema = z.object({
  status: z.enum(["prefer_a", "prefer_b", "tradeoff", "insufficient"]),
  summary: z.array(ClaimSchema).min(1).max(5),
  reasons: z.array(ClaimSchema).max(5),
  tradeoffs: z.array(ClaimSchema).max(5),
  questions: z.array(z.string().max(160)).max(4),
});
export type AiRecommendation = z.infer<typeof AiRecommendationSchema>;

interface SideStat {
  analyzed_n: number;
  mentions: number;
  positive: number;
  negative: number;
  mixed: number;
  neutral: number;
  evidence: string;
}

export interface RecommendPack {
  phones: Record<"A" | "B", { name: string; region: string; storage: string; price: string | null; price_evidence: string | null }>;
  user: { first_priority: string | null; second_priority: string | null; budget_cny: number | null; current_device: string | null; other_devices: string[] };
  baseline: {
    status: RecStatus;
    lean: "A" | "B" | null;
    verdicts: { preference: string; side: string; strength: string | null; claims: Claim[]; caveat: string | null }[];
    other_dimensions: { preference: string; side: string; strength: string | null }[];
    tradeoffs: Claim[];
    gaps: string[];
    questions: string[];
  };
  specs: { field: string; A: string; B: string; evidence: string[] }[];
  review_stats: { dimension: string; A: SideStat; B: SideStat }[];
  sample_scope: string;
  warnings: string[];
  allowed_evidence: string[];
}

const SIDE_TEXT: Record<string, string> = { a: "A", b: "B", even: "接近", unknown: "证据不足" };

export function buildPack(c: Comparison): RecommendPack {
  const rec = c.recommendation;
  const used = new Set<string>();
  const add = (ids: string[]) => ids.forEach((i) => used.add(i));
  const verdicts = rec.verdicts.map((v) => {
    v.claims.forEach((cl) => add(cl.evidence));
    return { preference: PREFERENCE_LABEL[v.pref], side: SIDE_TEXT[v.side], strength: v.strength, claims: v.claims, caveat: v.caveat };
  });
  rec.tradeoffs.forEach((t) => add(t.evidence));
  const specs = c.specRows
    .filter((r) => !(r.a.missing && r.b.missing))
    .map((r) => {
      add([r.a.evidence, r.b.evidence]);
      return { field: r.label, A: r.a.text, B: r.b.text, evidence: [r.a.evidence, r.b.evidence] };
    });
  const review_stats = DIMENSIONS.map((d) => {
    const ids = { A: `stat:${c.a.id}:${d}:${c.window}`, B: `stat:${c.b.id}:${d}:${c.window}` };
    add([ids.A, ids.B]);
    const pick = (s: "a" | "b") => {
      const st = c.stats[s];
      const x = st.dims[d];
      return { analyzed_n: st.n, mentions: x.mentions, positive: x.pos, negative: x.neg, mixed: x.mixed, neutral: x.neu };
    };
    return { dimension: DIMENSION_LABEL[d], A: { ...pick("a"), evidence: ids.A }, B: { ...pick("b"), evidence: ids.B } };
  });
  const priceText = (s: "a" | "b") => {
    const p = c[s].price;
    return p ? `${p.amount} 元（${p.storage}，${p.price_type === "official_current" ? "官方当前售价" : p.price_type === "official_msrp" ? "官方建议零售价" : "用户填写，未核验"}，${p.recorded_at}）` : null;
  };
  for (const s of ["a", "b"] as const) if (c[s].price) used.add(c[s].price!.evidence_id);
  return {
    phones: {
      A: { name: c.a.name, region: c.a.region, storage: c.a.storage, price: priceText("a"), price_evidence: c.a.price?.evidence_id ?? null },
      B: { name: c.b.name, region: c.b.region, storage: c.b.storage, price: priceText("b"), price_evidence: c.b.price?.evidence_id ?? null },
    },
    user: {
      first_priority: c.needs.prefs[0] ? PREFERENCE_LABEL[c.needs.prefs[0]] : null,
      second_priority: c.needs.prefs[1] ? PREFERENCE_LABEL[c.needs.prefs[1]] : null,
      budget_cny: c.needs.budget,
      current_device: c.needs.device === "iphone" ? "iPhone" : c.needs.device === "android" ? "安卓手机" : null,
      other_devices: c.needs.eco.map((e) => ECO_LABEL[e]),
    },
    baseline: {
      status: rec.status,
      lean: rec.lean ? (rec.lean === "a" ? "A" : "B") : null,
      verdicts,
      other_dimensions: rec.otherVerdicts.map((v) => ({ preference: PREFERENCE_LABEL[v.pref], side: SIDE_TEXT[v.side], strength: v.strength })),
      tradeoffs: rec.tradeoffs,
      gaps: rec.gaps,
      questions: rec.questions,
    },
    specs,
    review_stats,
    sample_scope:
      c.window === "90d"
        ? `评论统计只包含 ${c.stats.a.window_start} 至 ${c.versions.as_of} 的已收录样本。`
        : "评论统计包含全部已收录样本，部分样本较旧。",
    warnings: c.warnings.map((w) => w.text),
    allowed_evidence: [...used].filter((id) => id in c.evidence).sort(),
  };
}

/**
 * 数字校验：文字里的“数字＋单位”必须原样出现在材料中（如 178 g、26 条、6000 元）。
 * 不带单位的数字只要求数字本身出现过。
 */
const UNIT_ALIASES: Record<string, string> = { 克: "g", 毫米: "mm", 瓦: "w", 块: "元", 元: "元" };
const UNIT_RE = "(mah|mm|g|w|元|块|条|英寸|hz|%|倍|天|小时|mp|gb|tb|克|毫米|瓦)?";
const NUM_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}`, "gi");
const COUNT_KEYS = new Set(["analyzed_n", "mentions", "positive", "negative", "mixed", "neutral"]);

function normNum(s: string) {
  return String(Number(s));
}
function normUnit(u: string | undefined) {
  if (!u) return "";
  const l = u.toLowerCase();
  return UNIT_ALIASES[l] ?? l;
}

export function numberTokens(text: string): { num: string; unit: string }[] {
  const out: { num: string; unit: string }[] = [];
  for (const m of text.matchAll(NUM_RE)) out.push({ num: normNum(m[1]), unit: normUnit(m[2]) });
  return out;
}

export interface AllowedNumbers {
  plain: Set<string>;
  pairs: Set<string>;
  has(num: string): boolean;
}

export function allowedNumbers(pack: RecommendPack): AllowedNumbers {
  const plain = new Set<string>(["90"]);
  const pairs = new Set<string>(["90|天"]);
  const walk = (v: unknown, key = "") => {
    if (typeof v === "number") {
      const n = normNum(String(v));
      plain.add(n);
      if (COUNT_KEYS.has(key)) pairs.add(`${n}|条`);
      if (key === "budget_cny") pairs.add(`${n}|元`);
    } else if (typeof v === "string") {
      for (const t of numberTokens(v)) {
        plain.add(t.num);
        if (t.unit) pairs.add(`${t.num}|${t.unit}`);
      }
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => k !== "allowed_evidence" && walk(x, k));
  };
  walk(pack);
  return { plain, pairs, has: (n: string) => plain.has(normNum(n)) };
}

function unsupported(text: string, allowed: AllowedNumbers): string[] {
  return numberTokens(text)
    .filter((t) => (t.unit ? !allowed.pairs.has(`${t.num}|${t.unit}`) : !allowed.plain.has(t.num)))
    .map((t) => `${t.num}${t.unit}`);
}

export interface ValidationIssue {
  where: "status" | "summary" | "reasons" | "tradeoffs" | "questions" | "schema";
  problem: "status_upgrade" | "unknown_evidence" | "missing_evidence" | "unsupported_number" | "invalid_schema";
  detail: string;
}

const STRICTNESS: Record<RecStatus, number> = { prefer_a: 0, prefer_b: 0, tradeoff: 1, insufficient: 2 };

export function statusAllowed(baseline: RecStatus, proposed: RecStatus): boolean {
  if (proposed === baseline) return true;
  if (STRICTNESS[proposed] > STRICTNESS[baseline]) return true; // 更保守
  return false;
}

export interface ValidatedExplanation {
  status: RecStatus;
  summary: Claim[];
  reasons: Claim[];
  tradeoffs: Claim[];
  questions: string[];
  issues: ValidationIssue[];
  usable: boolean;
}

/**
 * 校验模型输出：
 * - 结构合法；状态不得比基础模式更激进或翻转方向
 * - 引用编号必须存在于 allowed_evidence；理由与取舍至少一条引用
 * - 文字里的数字必须出现在材料中
 * 不合格的句子直接删除，不替换为“看起来相近”的引用。
 */
export function validateExplanation(raw: unknown, pack: RecommendPack): ValidatedExplanation {
  const issues: ValidationIssue[] = [];
  const parsed = AiRecommendationSchema.safeParse(raw);
  const baseline = pack.baseline.status;
  if (!parsed.success) {
    return { status: baseline, summary: [], reasons: [], tradeoffs: [], questions: [], issues: [{ where: "schema", problem: "invalid_schema", detail: parsed.error.issues[0]?.message ?? "结构不合法" }], usable: false };
  }
  const out = parsed.data;
  const allowed = new Set(pack.allowed_evidence);
  const nums = allowedNumbers(pack);

  let status = out.status;
  if (!statusAllowed(baseline, status)) {
    issues.push({ where: "status", problem: "status_upgrade", detail: `模型给出 ${status}，基础模式为 ${baseline}` });
    status = baseline;
  }

  const check = (where: ValidationIssue["where"], list: Claim[], requireEvidence: boolean): Claim[] =>
    list.filter((cl) => {
      const unknown = cl.evidence.filter((e) => !allowed.has(e));
      if (unknown.length) {
        issues.push({ where, problem: "unknown_evidence", detail: unknown.join(",") });
        return false;
      }
      const numbers = numberTokens(cl.text);
      const bad = unsupported(cl.text, nums);
      if (bad.length) {
        issues.push({ where, problem: "unsupported_number", detail: bad.join(",") });
        return false;
      }
      if ((requireEvidence || numbers.length > 0) && cl.evidence.length === 0) {
        issues.push({ where, problem: "missing_evidence", detail: cl.text.slice(0, 30) });
        return false;
      }
      return true;
    });

  const summary = check("summary", out.summary, false);
  const reasons = check("reasons", out.reasons, true);
  const tradeoffs = check("tradeoffs", out.tradeoffs, true);
  const questions = out.questions.filter((q) => {
    const bad = unsupported(q, nums);
    if (bad.length) issues.push({ where: "questions", problem: "unsupported_number", detail: bad.join(",") });
    return bad.length === 0;
  });

  // 摘要至少保留一句，且理由至少一条带证据，才视为可用
  const usable = summary.length > 0 && (reasons.length > 0 || pack.baseline.verdicts.length === 0 || status === "insufficient");
  return { status, summary, reasons, tradeoffs, questions, issues, usable };
}

export function buildUserMessage(pack: RecommendPack): string {
  return `以下是程序整理好的比较材料（JSON）。请按要求输出解释。\n\n${JSON.stringify(pack)}`;
}

export interface CacheKeyParts {
  a: string;
  b: string;
  storage: [string, string];
  priceVersion: string;
  dataVersion: string;
  labelVersion: string;
  window: string;
  prefs: string[];
  budget: number | null;
  device: string | null;
  eco: string[];
  promptVersion: string;
  model: string;
}

export function cacheKey(p: CacheKeyParts): string {
  const canonical = JSON.stringify({ ...p, eco: [...p.eco].sort() });
  return `pl:rec:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

/** 测试夹具输出：根据基础模式生成，可模拟非法引用以检查回退 */
export function fixtureExplanation(pack: RecommendPack, mode: string): AiRecommendation {
  const b = pack.baseline;
  const first = b.verdicts[0];
  const summary: Claim[] = [
    { text: `【测试夹具】基础结论为“${b.status}”，以下句子由夹具根据基础材料拼接，不是模型生成。`, evidence: [] },
    ...(first ? first.claims.slice(0, 2) : []),
  ];
  const reasons: Claim[] = b.verdicts.map((v) => ({ text: `${v.preference}：${v.side}${v.strength ? `（${v.strength === "strong" ? "较明确" : "较弱"}）` : ""}。`, evidence: v.claims.flatMap((c) => c.evidence).slice(0, 4) }));
  if (mode === "bad_citation") {
    reasons.push({ text: "这条理由引用了不存在的证据编号。", evidence: ["spec:not-a-phone:weight_g"] });
    summary.push({ text: "这句话包含一个材料中不存在的数字 12345。", evidence: [] });
  }
  return { status: b.status, summary, reasons, tradeoffs: b.tradeoffs.slice(0, 2), questions: b.questions.slice(0, 2) };
}
