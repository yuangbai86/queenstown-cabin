/**
 * 口碑统计 —— 所有数量和比例由程序计算。
 * N = 当前筛选下“已完成分析且通过校验”的有效评论数。
 * 同一评论在同一维度只计一次；待分析、待复核样本不进入 N，也不当成“未提及”。
 */
import type {
  AnalysisRecord,
  AuditRecord,
  Dimension,
  ExclusionReason,
  PhoneRecord,
  ReviewLabel,
  ReviewRecord,
  SampleWindow,
  Sentiment,
} from "../types";
import { DIMENSIONS } from "../types";
import { cleanReviews, validateLabels, type CleanedReview } from "../clean";

export const WINDOW_DAYS = 90;
export const MIN_SAMPLE = 15;
export const MIN_TIME_OVERLAP = 0.5; // 时间范围重叠至少占较短区间的一半 // 低于此数提示“样本过少”，降低推荐强度（可配置的产品规则）

export interface DimStat {
  dimension: Dimension;
  mentions: number; // M：提到该维度的不同评论数
  pos: number;
  neg: number;
  neu: number;
  mixed: number;
  ids: Record<Sentiment, string[]>;
}

export type ReviewFinalStatus =
  | { kind: "counted" } // 进入 N
  | { kind: "excluded"; reason: ExclusionReason; by: "program" | "audit"; note: string }
  | { kind: "flagged"; reason: ExclusionReason; note: string }
  | { kind: "needs_review" }
  | { kind: "pending" }
  | { kind: "out_of_window"; why: "older" | "undated" };

export interface ReviewView {
  review: ReviewRecord;
  status: ReviewFinalStatus;
  labels: ReviewLabel[];
  flags: CleanedReview["flags"];
}

export interface SampleStats {
  phone_id: string;
  window: SampleWindow;
  window_start: string | null;
  as_of: string;
  n_total: number; // 该机型全部已收录样本
  n_in_window: number; // 筛选后样本
  n_out_of_window: number;
  n_undated: number;
  n_clean: number; // N_clean：清洗后（排除与待复核之外）的样本
  excluded: Partial<Record<ExclusionReason, number>>;
  n_excluded: number;
  n_flagged: number;
  n_needs_review: number;
  n_pending: number;
  n: number; // N：已分析且通过校验
  dims: Record<Dimension, DimStat>;
  shopping_mentions: number;
  date_min: string | null;
  date_max: string | null;
  sysver_known: number;
  sysver_unknown: number;
  sysver_versions: Record<string, number>;
  source_ids: string[];
  older_than_window: number; // 仅在 window=all 时有意义：超过 90 天的样本
  label_issues: number;
  views: ReviewView[];
}

export function windowStart(asOf: string, days = WINDOW_DAYS): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function emptyDim(dimension: Dimension): DimStat {
  return { dimension, mentions: 0, pos: 0, neg: 0, neu: 0, mixed: 0, ids: { pos: [], neg: [], neu: [], mixed: [] } };
}

export interface StatsInput {
  phone: PhoneRecord;
  catalog: PhoneRecord[];
  reviews: ReviewRecord[];
  analysis: AnalysisRecord[];
  audit: AuditRecord[];
  asOf: string;
  window: SampleWindow;
}

export function computeStats(input: StatsInput): SampleStats {
  const { phone, catalog, asOf, window } = input;
  const reviews = input.reviews.filter((r) => r.phone_id === phone.id);
  const start = window === "90d" ? windowStart(asOf) : null;

  // 清洗在全部样本上进行，保证判重顺序与筛选无关
  const cleaned = cleanReviews(reviews, phone, catalog, input.audit);
  const analysisById = new Map(input.analysis.map((a) => [a.review_id, a]));
  const textById = new Map(reviews.map((r) => [r.id, r.text]));

  const dims = Object.fromEntries(DIMENSIONS.map((d) => [d, emptyDim(d)])) as Record<Dimension, DimStat>;
  const excluded: SampleStats["excluded"] = {};
  const views: ReviewView[] = [];
  const versions: Record<string, number> = {};
  const sourceIds = new Set<string>();
  let n = 0,
    nClean = 0,
    nFlagged = 0,
    nNeeds = 0,
    nPending = 0,
    nOut = 0,
    nUndated = 0,
    nInWindow = 0,
    shopping = 0,
    sysKnown = 0,
    sysUnknown = 0,
    older = 0,
    labelIssues = 0;
  let dmin: string | null = null,
    dmax: string | null = null;
  const olderStart = windowStart(asOf);

  for (const c of cleaned) {
    const r = c.review;
    const a = analysisById.get(r.id);
    const { valid, issues } = validateLabels(a?.labels ?? [], textById);
    labelIssues += issues.length;

    // 时间筛选
    if (start) {
      if (!r.review_date) {
        nUndated++;
        nOut++;
        views.push({ review: r, status: { kind: "out_of_window", why: "undated" }, labels: valid, flags: c.flags });
        continue;
      }
      if (r.review_date < start) {
        nOut++;
        views.push({ review: r, status: { kind: "out_of_window", why: "older" }, labels: valid, flags: c.flags });
        continue;
      }
    } else if (!r.review_date) {
      nUndated++;
    }
    nInWindow++;

    let status: ReviewFinalStatus;
    if (c.state.kind === "excluded") {
      status = { kind: "excluded", reason: c.state.reason, by: c.state.by, note: c.state.note };
    } else if (c.state.kind === "flagged") {
      status = { kind: "flagged", reason: c.state.reason, note: c.state.note };
    } else if (!a || a.status === "pending") {
      status = { kind: "pending" };
    } else if (a.status === "needs_review") {
      status = { kind: "needs_review" };
    } else {
      const perf = valid.filter((l) => l.dimension !== "shopping");
      const shop = valid.filter((l) => l.dimension === "shopping");
      if (perf.length === 0 && shop.length > 0) {
        status = { kind: "excluded", reason: "shopping_only", by: "program", note: "只涉及物流、客服或包装，不计入性能口碑" };
        shopping++;
      } else {
        status = { kind: "counted" };
        if (shop.length > 0) shopping++;
      }
    }

    if (status.kind === "excluded") {
      excluded[status.reason] = (excluded[status.reason] ?? 0) + 1;
    } else if (status.kind === "flagged") {
      nFlagged++;
    } else {
      nClean++;
      if (status.kind === "pending") nPending++;
      if (status.kind === "needs_review") nNeeds++;
    }

    if (status.kind === "counted") {
      n++;
      sourceIds.add(r.source_id);
      if (r.system_version) {
        sysKnown++;
        versions[r.system_version] = (versions[r.system_version] ?? 0) + 1;
      } else sysUnknown++;
      if (r.review_date) {
        if (!dmin || r.review_date < dmin) dmin = r.review_date;
        if (!dmax || r.review_date > dmax) dmax = r.review_date;
        if (r.review_date < olderStart) older++;
      }
      const counted = new Set<Dimension>();
      for (const l of valid) {
        if (l.dimension === "shopping") continue;
        const d = l.dimension as Dimension;
        if (counted.has(d)) continue; // 同一评论同一维度只计一次
        counted.add(d);
        dims[d].mentions++;
        dims[d][l.sentiment]++;
        dims[d].ids[l.sentiment].push(r.id);
      }
    }
    views.push({ review: r, status, labels: valid, flags: c.flags });
  }

  const nExcluded = Object.values(excluded).reduce((s, x) => s + (x ?? 0), 0);

  return {
    phone_id: phone.id,
    window,
    window_start: start,
    as_of: asOf,
    n_total: reviews.length,
    n_in_window: nInWindow,
    n_out_of_window: nOut,
    n_undated: nUndated,
    n_clean: nClean,
    excluded,
    n_excluded: nExcluded,
    n_flagged: nFlagged,
    n_needs_review: nNeeds,
    n_pending: nPending,
    n,
    dims,
    shopping_mentions: shopping,
    date_min: dmin,
    date_max: dmax,
    sysver_known: sysKnown,
    sysver_unknown: sysUnknown,
    sysver_versions: versions,
    source_ids: [...sourceIds],
    older_than_window: older,
    label_issues: labelIssues,
    views,
  };
}

/** 两组样本是否可以并列解读：来源一致、数量足够、时间区间有重叠 */
export interface Comparability {
  comparable: boolean;
  reasons: string[];
}

export function compareSamples(a: SampleStats, b: SampleStats): Comparability {
  const reasons: string[] = [];
  if (a.n < MIN_SAMPLE || b.n < MIN_SAMPLE) {
    reasons.push(`至少一款的已分析有效评论少于 ${MIN_SAMPLE} 条（A：${a.n}，B：${b.n}）`);
  }
  const srcA = [...a.source_ids].sort().join(",");
  const srcB = [...b.source_ids].sort().join(",");
  if (a.n > 0 && b.n > 0 && srcA !== srcB) reasons.push("两款评论来源不同");
  if (a.date_min && a.date_max && b.date_min && b.date_max) {
    const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
    const start = Math.max(day(a.date_min), day(b.date_min));
    const end = Math.min(day(a.date_max), day(b.date_max));
    const shorter = Math.min(day(a.date_max) - day(a.date_min), day(b.date_max) - day(b.date_min)) + 1;
    const overlap = Math.max(0, end - start + 1);
    if (overlap === 0) reasons.push("两款评论的时间范围没有重叠");
    else if (overlap / shorter < MIN_TIME_OVERLAP) reasons.push("两款评论的时间范围重叠不足一半");
  } else if (a.n > 0 && b.n > 0) {
    reasons.push("至少一款评论缺少日期，无法确认时间范围");
  }
  if (a.window !== b.window) reasons.push("两款使用了不同的样本筛选范围");
  const knownShare = (s: SampleStats) => (s.n ? s.sysver_known / s.n : 0);
  if (a.n > 0 && b.n > 0 && Math.abs(knownShare(a) - knownShare(b)) > 0.4) {
    reasons.push("两款已知系统版本的样本比例差异较大");
  }
  return { comparable: reasons.length === 0, reasons };
}

export function pct(m: number, n: number): string {
  if (n === 0) return "—";
  return `${Math.round((m / n) * 100)}%`;
}
