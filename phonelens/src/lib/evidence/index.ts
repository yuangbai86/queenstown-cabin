/**
 * 证据登记：每条判断引用的编号都必须能在这里找到，并能在证据面板展开核对。
 */
import type { Dataset } from "../data";
import { getSource } from "../data";
import type { DataKind, Dimension, PriceRecord, SampleWindow, SpecRecord } from "../types";
import { DIMENSION_LABEL, PRICE_TYPE_LABEL, SENTIMENT_LABEL, SPEC_FIELD_MAP } from "../labels";
import type { SampleStats } from "../stats";

export interface EvidenceSource {
  name: string;
  url: string | null;
  verification: string;
}

export type EvidenceItem =
  | {
      id: string;
      kind: "spec";
      phone_id: string;
      title: string;
      value: string;
      missing_reason: string | null;
      verified_at: string | null;
      source: EvidenceSource | null;
      data_kind: DataKind;
      caution?: string;
    }
  | {
      id: string;
      kind: "price";
      phone_id: string;
      title: string;
      value: string;
      price_type: string;
      storage: string;
      channel: string;
      conditions: string | null;
      recorded_at: string;
      source: EvidenceSource | null;
      data_kind: DataKind;
    }
  | {
      id: string;
      kind: "stat";
      phone_id: string;
      title: string;
      dimension: Dimension;
      window: SampleWindow;
      n: number;
      mentions: number;
      pos: number;
      neg: number;
      neu: number;
      mixed: number;
      review_ids: string[];
      filter_text: string;
      data_kind: DataKind;
    }
  | {
      id: string;
      kind: "review";
      phone_id: string;
      title: string;
      text: string;
      review_date: string | null;
      system_version: string | null;
      source: EvidenceSource | null;
      labels: { dimension: string; sentiment: string; excerpt: string }[];
      data_kind: DataKind;
      display: "full_text" | "excerpt" | "summary_only" | "none";
    };

export type EvidenceMap = Record<string, EvidenceItem>;

function src(ds: Dataset, id: string | null): EvidenceSource | null {
  const s = getSource(ds, id);
  if (!s) return null;
  const verification = s.verification === "fixture" ? "演示夹具" : s.verification === "human_verified" ? "已人工核验" : "尚未核验";
  return { name: s.name, url: s.url, verification };
}

export function formatSpecValue(s: SpecRecord): string {
  if (s.value === null) return s.missing_reason ?? "尚未核验";
  return s.unit ? `${s.value} ${s.unit}` : String(s.value);
}

export function specEvidence(ds: Dataset, s: SpecRecord, phoneName: string): EvidenceItem {
  const def = SPEC_FIELD_MAP[s.field];
  return {
    id: s.id,
    kind: "spec",
    phone_id: s.phone_id,
    title: `${phoneName} · ${def.label}`,
    value: formatSpecValue(s),
    missing_reason: s.missing_reason,
    verified_at: s.verified_at,
    source: src(ds, s.source_id),
    data_kind: s.data_kind,
    caution: def.caution,
  };
}

export function priceEvidence(ds: Dataset, p: PriceRecord, phoneName: string): EvidenceItem {
  return {
    id: p.id,
    kind: "price",
    phone_id: p.phone_id,
    title: `${phoneName} · 价格（${p.storage}）`,
    value: `¥${p.amount.toLocaleString("zh-CN")}`,
    price_type: PRICE_TYPE_LABEL[p.price_type],
    storage: p.storage,
    channel: p.channel,
    conditions: p.conditions,
    recorded_at: p.recorded_at,
    source: src(ds, p.source_id),
    data_kind: p.data_kind,
  };
}

export function statId(phoneId: string, dim: Dimension, window: SampleWindow) {
  return `stat:${phoneId}:${dim}:${window}`;
}

export function statEvidence(stats: SampleStats, dim: Dimension, phoneName: string, kind: DataKind): EvidenceItem {
  const d = stats.dims[dim];
  const ids = [...d.ids.neg, ...d.ids.mixed, ...d.ids.pos, ...d.ids.neu];
  return {
    id: statId(stats.phone_id, dim, stats.window),
    kind: "stat",
    phone_id: stats.phone_id,
    title: `${phoneName} · ${DIMENSION_LABEL[dim]}口碑统计`,
    dimension: dim,
    window: stats.window,
    n: stats.n,
    mentions: d.mentions,
    pos: d.pos,
    neg: d.neg,
    neu: d.neu,
    mixed: d.mixed,
    review_ids: ids,
    filter_text:
      stats.window === "90d"
        ? `${stats.window_start} 至 ${stats.as_of} 的已收录样本（最近九十天）`
        : `全部已收录样本${stats.date_min ? `（${stats.date_min} 至 ${stats.date_max}）` : ""}`,
    data_kind: kind,
  };
}

export function reviewEvidence(ds: Dataset, stats: SampleStats, phoneName: string): EvidenceItem[] {
  return stats.views.map((v) => {
    const s = getSource(ds, v.review.source_id);
    return {
      id: `review:${v.review.id}`,
      kind: "review" as const,
      phone_id: v.review.phone_id,
      title: `${phoneName} · 评论 ${v.review.id}`,
      text: s?.allowed_display === "none" ? "" : v.review.text,
      review_date: v.review.review_date,
      system_version: v.review.system_version,
      source: src(ds, v.review.source_id),
      labels: v.labels.map((l) => ({ dimension: DIMENSION_LABEL[l.dimension], sentiment: SENTIMENT_LABEL[l.sentiment], excerpt: l.excerpt })),
      data_kind: v.review.data_kind,
      display: s?.allowed_display ?? "none",
    };
  });
}
