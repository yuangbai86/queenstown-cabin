/**
 * 组装一次对比：参数行、价格口径、口碑统计、证据登记、基础模式推荐。
 * 输出可直接序列化给页面，评论原文只包含允许展示的部分。
 */
import type { Dataset } from "../data";
import { getPhone, pricesFor, specsFor } from "../data";
import type { DataKind, Dimension, PhoneRecord, PriceRecord, SampleWindow, SpecField, UserNeeds } from "../types";
import { DIMENSIONS } from "../types";
import { SPEC_FIELDS, SPEC_FIELD_MAP } from "../labels";
import { computeStats, compareSamples, MIN_SAMPLE, type Comparability, type SampleStats } from "../stats";
import { budgetFit, fairnessWarnings, pickPrice, type RuleWarning } from "../rules";
import { formatSpecValue, priceEvidence, reviewEvidence, specEvidence, statEvidence, statId, type EvidenceMap } from "../evidence";
import { recommend, type Recommendation, type Side } from "./engine";

export type DataState = "full" | "specs_only" | "reviews_only" | "none";

export interface PhoneSide {
  id: string;
  brand: string;
  model: string;
  name: string;
  region: string;
  storage: string;
  ram: string | null;
  sale_status: PhoneRecord["sale_status"];
  data_kind: DataKind;
  price: (PriceRecord & { evidence_id: string }) | null;
  state: DataState;
}

export interface SpecRow {
  field: SpecField;
  label: string;
  group: string;
  caution: string | null;
  a: { text: string; missing: boolean; evidence: string };
  b: { text: string; missing: boolean; evidence: string };
  differs: boolean;
}

export type StatsSummary = Omit<SampleStats, "views"> & { excluded_ids: { id: string; reason: string; by: string }[] };

export interface Comparison {
  a: PhoneSide;
  b: PhoneSide;
  needs: UserNeeds;
  window: SampleWindow;
  versions: { data: string; labels: string; prices: string; as_of: string };
  warnings: RuleWarning[];
  comparability: Comparability;
  specRows: SpecRow[];
  stats: Record<Side, StatsSummary>;
  evidence: EvidenceMap;
  recommendation: Recommendation;
  sampleNotes: Record<Side, string[]>;
  demo: boolean; // 任一侧使用演示夹具
  coverageHint: Record<Side, boolean>; // 九十天内样本不足、全部样本更多时提示
}

export function phoneName(p: PhoneRecord) {
  return `${p.brand} ${p.model}`;
}

function summarize(s: SampleStats): StatsSummary {
  const { views, ...rest } = s;
  return {
    ...rest,
    excluded_ids: views
      .filter((v) => v.status.kind === "excluded" || v.status.kind === "flagged")
      .map((v) => ({
        id: v.review.id,
        reason: v.status.kind === "excluded" || v.status.kind === "flagged" ? v.status.reason : "",
        by: v.status.kind === "excluded" ? v.status.by : "待复核",
      })),
  };
}

export function buildComparison(
  ds: Dataset,
  aId: string,
  bId: string,
  needs: UserNeeds,
  window: SampleWindow = "90d",
): Comparison | { error: "unknown_phone"; which: Side[] } | { error: "same_phone" } {
  const pa = getPhone(ds, aId);
  const pb = getPhone(ds, bId);
  const missing: Side[] = [];
  if (!pa) missing.push("a");
  if (!pb) missing.push("b");
  if (missing.length) return { error: "unknown_phone", which: missing };
  if (pa!.id === pb!.id) return { error: "same_phone" };
  const phones: Record<Side, PhoneRecord> = { a: pa!, b: pb! };
  const names: Record<Side, string> = { a: phoneName(pa!), b: phoneName(pb!) };

  const evidence: EvidenceMap = {};
  const specMaps = {} as Record<Side, Map<SpecField, ReturnType<typeof specsFor>[number]>>;
  const stats = {} as Record<Side, SampleStats>;
  const allStats = {} as Record<Side, SampleStats>;
  const sides: Side[] = ["a", "b"];

  for (const s of sides) {
    const p = phones[s];
    const sp = specsFor(ds, p.id);
    specMaps[s] = new Map(sp.map((x) => [x.field, x]));
    for (const rec of sp) evidence[rec.id] = specEvidence(ds, rec, names[s]);
    const common = { phone: p, catalog: ds.phones, reviews: ds.reviews, analysis: ds.analysis, audit: ds.audit, asOf: ds.meta.as_of };
    stats[s] = computeStats({ ...common, window });
    allStats[s] = window === "all" ? stats[s] : computeStats({ ...common, window: "all" });
    for (const d of DIMENSIONS) {
      const e = statEvidence(stats[s], d, names[s], p.data_kind);
      evidence[e.id] = e;
    }
    for (const r of reviewEvidence(ds, stats[s], names[s])) evidence[r.id] = r;
  }

  const prices: Record<Side, PriceRecord | null> = {
    a: pickPrice(pricesFor(ds, pa!.id), pa!),
    b: pickPrice(pricesFor(ds, pb!.id), pb!),
  };
  for (const s of sides) {
    const pr = prices[s];
    if (pr) evidence[pr.id] = priceEvidence(ds, pr, names[s]);
  }

  const hasSpecs = { a: [...specMaps.a.values()].some((x) => x.value !== null), b: [...specMaps.b.values()].some((x) => x.value !== null) };
  const hasReviews = { a: stats.a.n > 0, b: stats.b.n > 0 };
  const hasAnyReviews = { a: allStats.a.n > 0, b: allStats.b.n > 0 };
  const state = (s: Side): DataState =>
    hasSpecs[s] && hasAnyReviews[s] ? "full" : hasSpecs[s] ? "specs_only" : hasAnyReviews[s] ? "reviews_only" : "none";

  const specRows: SpecRow[] = SPEC_FIELDS.map((def) => {
    const ra = specMaps.a.get(def.field);
    const rb = specMaps.b.get(def.field);
    const cell = (r: typeof ra, s: Side) => ({
      text: r ? formatSpecValue(r) : "尚未核验",
      missing: !r || r.value === null,
      evidence: r?.id ?? `spec:${phones[s].id}:${def.field}`,
    });
    const a = cell(ra, "a");
    const b = cell(rb, "b");
    return {
      field: def.field,
      label: def.label,
      group: def.group,
      caution: def.caution ?? null,
      a,
      b,
      differs: a.missing || b.missing ? a.text !== b.text : a.text !== b.text,
    };
  });

  const comparability = compareSamples(stats.a, stats.b);
  const warnings = fairnessWarnings(pa!, pb!, prices.a, prices.b);

  const recommendation = recommend({
    names,
    hasSpecs,
    hasReviews,
    specs: {
      get: (s, field) => {
        const r = specMaps[s].get(field as SpecField);
        return r ? { id: r.id, value: r.value, unit: r.unit } : undefined;
      },
    },
    stats,
    comparability,
    needs,
    budget: { a: budgetFit(needs.budget, prices.a), b: budgetFit(needs.budget, prices.b) },
    priceIds: { a: prices.a?.id ?? null, b: prices.b?.id ?? null },
  });

  const sampleNotes = {} as Record<Side, string[]>;
  const coverageHint = {} as Record<Side, boolean>;
  for (const s of sides) {
    const st = stats[s];
    const notes: string[] = [];
    if (phones[s].data_kind === "demo") notes.push("这些评论是开发者编写的演示样本，不是真实用户评论。");
    if (st.n_total === 0) notes.push("尚未收录评论。");
    else {
      if (st.n < MIN_SAMPLE) notes.push(`已分析有效评论只有 ${st.n} 条，结论强度已降低。`);
      if (st.sysver_unknown > 0) notes.push(`${st.sysver_unknown} 条评论系统版本未知，不推断为最新系统。`);
      if (st.n_pending + st.n_needs_review > 0) notes.push(`${st.n_pending} 条待分析、${st.n_needs_review} 条待复核，未计入统计分母，也不视为“未提及”。`);
      if (st.window === "all" && st.older_than_window > 0) notes.push(`其中 ${st.older_than_window} 条早于最近九十天，旧版本问题不一定仍然存在。`);
      if (st.window === "90d" && st.n_undated > 0) notes.push(`${st.n_undated} 条没有评论日期，未纳入九十天筛选。`);
    }
    notes.push("提及比例只描述已收录样本，不代表购买者遇到问题的概率。");
    sampleNotes[s] = notes;
    coverageHint[s] = window === "90d" && st.n < MIN_SAMPLE && allStats[s].n > st.n;
  }

  const side = (s: Side): PhoneSide => ({
    id: phones[s].id,
    brand: phones[s].brand,
    model: phones[s].model,
    name: names[s],
    region: phones[s].region,
    storage: phones[s].storage,
    ram: phones[s].ram,
    sale_status: phones[s].sale_status,
    data_kind: phones[s].data_kind,
    price: prices[s] ? { ...prices[s]!, evidence_id: prices[s]!.id } : null,
    state: state(s),
  });

  return {
    a: side("a"),
    b: side("b"),
    needs,
    window,
    versions: { data: ds.meta.data_version, labels: ds.meta.label_version, prices: ds.meta.price_version, as_of: ds.meta.as_of },
    warnings,
    comparability,
    specRows,
    stats: { a: summarize(stats.a), b: summarize(stats.b) },
    evidence,
    recommendation,
    sampleNotes,
    demo: pa!.data_kind === "demo" || pb!.data_kind === "demo",
    coverageHint,
  };
}

export function isComparison(x: unknown): x is Comparison {
  return !!x && typeof x === "object" && "recommendation" in x;
}

export { statId, SPEC_FIELD_MAP };
export type { Dimension };
