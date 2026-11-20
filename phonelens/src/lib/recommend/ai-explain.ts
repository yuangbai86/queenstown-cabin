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
  /** 句中每个数字对应的事实编号（见材料 facts） */
  figures: z.array(z.string().max(60)).max(12),
});
export type AiClaim = z.infer<typeof ClaimSchema>;

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
  facts: Fact[];
  allowed_evidence: string[];
}

/* ---------------- 数字事实表 ---------------- */

/**
 * 每个可以在解释里出现的数字都是一条“事实”：属于哪款（A/B）或用户/规则、哪个字段、值、单位，
 * 以及在句子里必须伴随的措辞。模型必须在 figures 中逐一引用。
 */
export interface Fact {
  id: string;
  subject: "A" | "B" | "user" | "rule" | "AB";
  label: string;
  value: number;
  unit: string;
  evidence: string[];
  /** 句子（以句号分隔）中必须出现其一 */
  context: string[];
  /** 数字前 6 个字符内必须出现其一（可选） */
  before?: string[];
  /** 单位后 6 个字符内必须出现其一（可选） */
  after?: string[];
}

const FIELD_FACT: Record<string, { unit: string; context: string[] }> = {
  ram_gb: { unit: "gb", context: ["内存", "RAM"] },
  weight_g: { unit: "g", context: ["重", "克", "轻"] },
  height_mm: { unit: "mm", context: ["高"] },
  width_mm: { unit: "mm", context: ["宽"] },
  thickness_mm: { unit: "mm", context: ["厚"] },
  display_size_in: { unit: "英寸", context: ["屏"] },
  display_refresh_hz: { unit: "hz", context: ["刷新"] },
  battery_mah: { unit: "mah", context: ["电池", "容量"] },
  wired_charging_w: { unit: "w", context: ["有线", "充电"] },
  wireless_charging_w: { unit: "w", context: ["无线"] },
  rear_camera_count: { unit: "颗", context: ["摄像头", "镜头"] },
  main_camera_mp: { unit: "mp", context: ["主摄", "像素"] },
  front_camera_mp: { unit: "mp", context: ["前置", "像素"] },
};

const SENT_WORD: Record<string, string> = { pos: "正面", neg: "负面", mixed: "褒贬混合", neu: "中性" };

export function buildFacts(c: Comparison): Fact[] {
  const facts: Fact[] = [];
  const S = { a: "A", b: "B" } as const;
  for (const side of ["a", "b"] as const) {
    const T = S[side];
    for (const r of c.specRows) {
      const def = FIELD_FACT[r.field];
      const ev = c.evidence[r[side].evidence];
      if (!def || !ev || ev.kind !== "spec" || r[side].missing) continue;
      const v = Number.parseFloat(ev.value);
      if (!Number.isFinite(v)) continue;
      facts.push({ id: `${T}.${r.field}`, subject: T, label: `${T} ${r.label}`, value: v, unit: def.unit, evidence: [r[side].evidence], context: def.context });
    }
    const p = c[side].price;
    if (p) facts.push({ id: `${T}.price`, subject: T, label: `${T} 价格（${p.storage}）`, value: p.amount, unit: "元", evidence: [p.evidence_id], context: ["价", "¥", "元", "预算"] });
    const st = c.stats[side];
    facts.push({ id: `${T}.analyzed_n`, subject: T, label: `${T} 已分析有效评论数`, value: st.n, unit: "条", evidence: DIMENSIONS.map((d) => `stat:${c[side].id}:${d}:${c.window}`), context: ["分析", "评论", "样本"], before: ["分析", "共", "评论"] });
    for (const d of DIMENSIONS) {
      const x = st.dims[d];
      const ev = [`stat:${c[side].id}:${d}:${c.window}`];
      const ctx = [DIMENSION_LABEL[d]];
      facts.push({ id: `${T}.${d}.mentions`, subject: T, label: `${T} 提到${DIMENSION_LABEL[d]}的评论数`, value: x.mentions, unit: "条", evidence: ev, context: ctx, before: ["提到", "提及"], after: ["提到", "提及", "评论"] });
      for (const k of ["pos", "neg", "mixed", "neu"] as const) {
        facts.push({ id: `${T}.${d}.${k}`, subject: T, label: `${T} ${DIMENSION_LABEL[d]}${SENT_WORD[k]}评论数`, value: x[k], unit: "条", evidence: ev, context: ctx, after: [SENT_WORD[k]] });
      }
    }
  }
  // 派生事实
  const wa = c.evidence[`spec:${c.a.id}:weight_g`];
  const wb = c.evidence[`spec:${c.b.id}:weight_g`];
  const fa = facts.find((f) => f.id === "A.weight_g");
  const fb = facts.find((f) => f.id === "B.weight_g");
  if (fa && fb && wa && wb && fa.value !== fb.value) {
    const lighter = fa.value < fb.value ? "A" : "B";
    facts.push({ id: "diff.weight_g", subject: lighter, label: `${lighter} 比另一款轻的克数`, value: Math.round(Math.abs(fa.value - fb.value) * 10) / 10, unit: "g", evidence: [wa.id, wb.id], context: ["轻", "重"], before: ["轻", "相差", "差"] });
  }
  if (c.needs.budget) {
    facts.push({ id: "user.budget", subject: "user", label: "用户预算", value: c.needs.budget, unit: "元", evidence: [], context: ["预算"] });
    for (const side of ["a", "b"] as const) {
      const p = c[side].price;
      if (p && p.amount > c.needs.budget) {
        facts.push({ id: `${S[side]}.over_budget`, subject: S[side], label: `${S[side]} 超出预算的金额`, value: p.amount - c.needs.budget, unit: "元", evidence: [p.evidence_id], context: ["预算", "超"] });
      }
    }
  }
  if (c.a.price && c.b.price) {
    facts.push({ id: "diff.price", subject: "AB", label: "两款已知价格差", value: Math.abs(c.a.price.amount - c.b.price.amount), unit: "元", evidence: [c.a.price.evidence_id, c.b.price.evidence_id], context: ["相差", "价差", "差"] });
  }
  facts.push({ id: "rule.window_days", subject: "rule", label: "评论筛选窗口", value: 90, unit: "天", evidence: [], context: ["最近", "天"] });
  facts.push({ id: "rule.price_gap_pct", subject: "rule", label: "价差提示阈值", value: 30, unit: "%", evidence: [], context: ["价差", "相差", "超过"] });
  return facts;
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
    facts: buildFacts(c).map((f) => ({ ...f, evidence: f.evidence.filter((e) => e in c.evidence) })),
    allowed_evidence: [...used].filter((id) => id in c.evidence).sort(),
  };
}

/* ---------------- 数字校验（对应机型、字段、单位与措辞） ---------------- */

const UNIT_ALIASES: Record<string, string> = { 克: "g", 毫米: "mm", 瓦: "w", 块: "元", 个: "颗", 万像素: "mp" };
const NUM_RE = /(¥|￥)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(mah|mm|gb|tb|g|w|hz|mp|元|块|条|颗|个|英寸|%|倍|天|小时|分钟|克|毫米|瓦)?/gi;

function normUnit(u: string | undefined, yen: boolean): string {
  if (!u) return yen ? "元" : "";
  const l = u.toLowerCase();
  return UNIT_ALIASES[l] ?? l;
}

export interface NumberToken {
  value: number;
  unit: string;
  raw: string;
  start: number;
  end: number;
}

/** 先遮蔽机型名称、日期和文字型参数（如芯片名），再提取“数字＋单位” */
export function maskText(text: string, names: Record<"A" | "B", string>, stringFacts: string[]): string {
  let t = text;
  const mask = (needle: string, ch: string) => {
    if (!needle) return;
    t = t.split(needle).join(ch.repeat(needle.length));
  };
  // 名称替换为等长的标记，保留字符位置；用 A/B 字母填充以便识别主体
  mask(names.A, "Ａ");
  mask(names.B, "Ｂ");
  for (const sf of [...stringFacts].sort((x, y) => y.length - x.length)) mask(sf, "＊");
  t = t.replace(/\d{4}-\d{1,2}-\d{1,2}/g, (m) => "＊".repeat(m.length));
  return t;
}

export function numberTokens(masked: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of masked.matchAll(NUM_RE)) {
    const value = Number(m[2].replace(/,/g, ""));
    out.push({ value, unit: normUnit(m[3], !!m[1]), raw: m[0].trim(), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

/** 数字之前最近出现的主体：独立的 A / B 字母或被遮蔽的机型名称 */
export function subjectBefore(masked: string, pos: number): "A" | "B" | null {
  const head = masked.slice(0, pos);
  const re = /(?<![A-Za-z])([AB])(?![A-Za-z])|([ＡＢ])/g;
  let last: "A" | "B" | null = null;
  for (const m of head.matchAll(re)) {
    const ch = m[1] ?? m[2];
    last = ch === "A" || ch === "Ａ" ? "A" : "B";
  }
  return last;
}

function sentenceAt(text: string, pos: number): string {
  const startIdx = Math.max(text.lastIndexOf("。", pos - 1), text.lastIndexOf("！", pos - 1), text.lastIndexOf("？", pos - 1)) + 1;
  const ends = ["。", "！", "？"].map((c) => text.indexOf(c, pos)).filter((i) => i >= 0);
  return text.slice(startIdx, ends.length ? Math.min(...ends) : text.length);
}

export interface NumberProblem {
  token: string;
  reason: "no_figure" | "unknown_figure" | "value_or_unit_mismatch" | "subject_mismatch" | "subject_missing" | "context_missing" | "evidence_missing";
}

/**
 * 校验一句话中的每个数字：
 * 1. 必须能在本句 figures 引用的事实中找到同值同单位的一条；
 * 2. 该事实属于 A/B 时，数字前最近提到的主体必须是同一款（不能把 B 的重量写成 A 的）；
 * 3. 句子里必须出现该事实要求的措辞（如重量要伴随“重/轻/克”，评论数要紧跟“正面/负面”等）；
 * 4. 该事实的证据编号必须出现在本句的 evidence 里。
 */
export function checkNumbers(claim: { text: string; evidence: string[]; figures?: string[] }, pack: Pick<RecommendPack, "facts" | "phones" | "specs">): NumberProblem[] {
  const factMap = new Map(pack.facts.map((f) => [f.id, f]));
  const stringFacts = pack.specs.flatMap((r) => [r.A, r.B]).filter((v) => !/^\d+(\.\d+)?\s*[a-zA-Z英寸]*$/.test(v));
  const masked = maskText(claim.text, { A: pack.phones.A.name, B: pack.phones.B.name }, stringFacts);
  const problems: NumberProblem[] = [];
  const cited = (claim.figures ?? []).map((id) => ({ id, f: factMap.get(id) }));
  for (const c of cited) if (!c.f) problems.push({ token: c.id, reason: "unknown_figure" });
  for (const tok of numberTokens(masked)) {
    const candidates = cited.filter((c) => c.f && Math.abs(c.f.value - tok.value) < 1e-9 && c.f.unit === tok.unit).map((c) => c.f!);
    if (cited.length === 0) {
      problems.push({ token: tok.raw, reason: "no_figure" });
      continue;
    }
    if (candidates.length === 0) {
      problems.push({ token: tok.raw, reason: "value_or_unit_mismatch" });
      continue;
    }
    const subj = subjectBefore(masked, tok.start);
    const sentence = sentenceAt(claim.text, tok.start);
    const before = claim.text.slice(Math.max(0, tok.start - 6), tok.start);
    const after = claim.text.slice(tok.end, tok.end + 6);
    let lastReason: NumberProblem["reason"] = "subject_mismatch";
    const ok = candidates.some((f) => {
      if (f.subject === "A" || f.subject === "B") {
        if (!subj) return (lastReason = "subject_missing"), false;
        if (subj !== f.subject) return (lastReason = "subject_mismatch"), false;
      }
      if (!f.context.some((k) => sentence.includes(k))) return (lastReason = "context_missing"), false;
      if (f.before && !f.before.some((k) => before.includes(k)) && !(f.after && f.after.some((k) => after.includes(k)))) return (lastReason = "context_missing"), false;
      if (!f.before && f.after && !f.after.some((k) => after.includes(k))) return (lastReason = "context_missing"), false;
      if (f.evidence.length && !f.evidence.some((e) => claim.evidence.includes(e))) return (lastReason = "evidence_missing"), false;
      return true;
    });
    if (!ok) problems.push({ token: tok.raw, reason: lastReason });
  }
  return problems;
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
 * - 文字里的每个数字都要引用对应机型、字段、单位一致的事实，且措辞与证据相符
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

  let status = out.status;
  if (!statusAllowed(baseline, status)) {
    issues.push({ where: "status", problem: "status_upgrade", detail: `模型给出 ${status}，基础模式为 ${baseline}` });
    status = baseline;
  }

  const check = (where: ValidationIssue["where"], list: AiClaim[], requireEvidence: boolean): Claim[] =>
    list.filter((cl) => {
      const unknown = cl.evidence.filter((e) => !allowed.has(e));
      if (unknown.length) {
        issues.push({ where, problem: "unknown_evidence", detail: unknown.join(",") });
        return false;
      }
      const bad = checkNumbers(cl, pack);
      if (bad.length) {
        issues.push({ where, problem: "unsupported_number", detail: bad.map((b) => `${b.token}:${b.reason}`).join(",") });
        return false;
      }
      if ((requireEvidence || (cl.figures ?? []).length > 0) && cl.evidence.length === 0) {
        issues.push({ where, problem: "missing_evidence", detail: cl.text.slice(0, 30) });
        return false;
      }
      return true;
    }).map(({ text, evidence }) => ({ text, evidence }));

  const summary = check("summary", out.summary, false);
  const reasons = check("reasons", out.reasons, true);
  const tradeoffs = check("tradeoffs", out.tradeoffs, true);
  // 问题不带引用，因此不允许出现数字
  const questions = out.questions.filter((q) => {
    const bad = checkNumbers({ text: q, evidence: [], figures: [] }, pack);
    if (bad.length) issues.push({ where: "questions", problem: "unsupported_number", detail: bad.map((b) => b.token).join(",") });
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

/**
 * 测试夹具输出（仅本地开发）：模拟一个“守规矩”的模型，按事实表为句中数字补上引用。
 * 这只是夹具的生成方式；校验仍由 checkNumbers 独立完成。
 */
function fixtureFigures(text: string, pack: RecommendPack): string[] {
  const stringFacts = pack.specs.flatMap((r) => [r.A, r.B]).filter((v) => !/^\d+(\.\d+)?\s*[a-zA-Z英寸]*$/.test(v));
  const masked = maskText(text, { A: pack.phones.A.name, B: pack.phones.B.name }, stringFacts);
  const ids: string[] = [];
  for (const tok of numberTokens(masked)) {
    const subj = subjectBefore(masked, tok.start);
    const after = text.slice(tok.end, tok.end + 6);
    const f = pack.facts.find(
      (x) =>
        x.value === tok.value &&
        x.unit === tok.unit &&
        (x.subject === subj || x.subject === "AB" || x.subject === "user" || x.subject === "rule") &&
        (!x.after || x.after.some((k) => after.includes(k)) || !!x.before),
    );
    if (f) ids.push(f.id);
  }
  return [...new Set(ids)];
}

export function fixtureExplanation(pack: RecommendPack, mode: string): AiRecommendation {
  const b = pack.baseline;
  const first = b.verdicts[0];
  const withFig = (cl: Claim): AiClaim => ({ ...cl, figures: fixtureFigures(cl.text, pack) });
  const summary: AiClaim[] = [
    { text: `【测试夹具】基础结论为“${b.status}”，以下句子由夹具根据基础材料拼接，不是模型生成。`, evidence: [], figures: [] },
    ...(first ? first.claims.slice(0, 2).map(withFig) : []),
  ];
  const reasons: AiClaim[] = b.verdicts.map((v) => ({
    text: `${v.preference}：${v.side}${v.strength ? `（${v.strength === "strong" ? "较明确" : "较弱"}）` : ""}。`,
    evidence: v.claims.flatMap((c) => c.evidence).slice(0, 4),
    figures: [],
  }));
  if (mode === "bad_citation") {
    reasons.push({ text: "这条理由引用了不存在的证据编号。", evidence: ["spec:not-a-phone:weight_g"], figures: [] });
    const wB = pack.facts.find((f) => f.id === "B.weight_g");
    if (wB) summary.push({ text: `A 重 ${wB.value} g，握持更累。`, evidence: wB.evidence, figures: ["B.weight_g"] });
    summary.push({ text: "这句话包含一个材料中不存在的数字 12345 小时。", evidence: [], figures: [] });
  }
  return { status: b.status, summary, reasons, tradeoffs: b.tradeoffs.slice(0, 2).map(withFig), questions: b.questions.slice(0, 2) };
}
