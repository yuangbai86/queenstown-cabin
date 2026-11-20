/**
 * 评论清洗：程序负责格式统一、明显重复、可疑项标记；人工审核记录决定最终去留。
 * 每条被排除或待复核的样本都带原因，便于复核统计分母。
 */
import type {
  AnalysisRecord,
  AuditRecord,
  ExclusionReason,
  LabelDimension,
  PhoneRecord,
  ReviewLabel,
  ReviewRecord,
} from "../types";
import { LABEL_DIMENSIONS, SENTIMENTS } from "../types";

export function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
}

/** 用于判重：去掉标点与空白 */
export function dedupeKey(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function bigrams(s: string): Set<string> {
  const k = dedupeKey(s);
  const out = new Set<string>();
  for (let i = 0; i < k.length - 1; i++) out.add(k.slice(i, i + 2));
  if (k.length === 1) out.add(k);
  return out;
}

export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const NEAR_DUP_THRESHOLD = 0.7;

const AD_PATTERNS = [/加\s*(微信|v信|vx|薇)/i, /优惠券|领券|返现|代购|私聊|全网最低|刷单|招代理/];

export function looksLikeAd(text: string): boolean {
  return AD_PATTERNS.some((p) => p.test(text));
}

export function lacksUsageContent(text: string): boolean {
  const k = dedupeKey(text);
  if (k.length < 5) return true;
  if (/^(.{1,4})\1{2,}$/.test(k)) return true; // “很好很好很好”
  if (/^(好评|差评|不错|满意|很好|垃圾|还行|一般)+$/.test(k)) return true;
  return false;
}

/** 文本提到目录内其他机型、却没提到本机型时标记为疑似混入（需人工确认） */
export function mentionsOtherModel(text: string, own: PhoneRecord, catalog: PhoneRecord[]): string | null {
  const lower = normalizeText(text).toLowerCase();
  const names = (p: PhoneRecord) => [p.model, ...p.aliases].map((n) => n.toLowerCase()).filter((n) => n.length >= 3);
  const mentionsOwn = names(own).some((n) => lower.includes(n));
  if (mentionsOwn) return null;
  for (const other of catalog) {
    if (other.id === own.id) continue;
    if (names(other).some((n) => new RegExp(`(^|[^a-z0-9])${escapeRe(n)}($|[^a-z0-9])`).test(lower))) return other.id;
  }
  return null;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type CleanState =
  | { kind: "clean" }
  | { kind: "excluded"; reason: ExclusionReason; by: "program" | "audit"; note: string }
  | { kind: "flagged"; reason: ExclusionReason; note: string }; // 待人工复核，不进入统计

export interface CleanedReview {
  review: ReviewRecord;
  normalized: string;
  state: CleanState;
  /** 程序检测到的可疑项（即便审核后保留也记录） */
  flags: { reason: ExclusionReason; note: string }[];
}

export function cleanReviews(
  reviews: ReviewRecord[],
  phone: PhoneRecord,
  catalog: PhoneRecord[],
  audit: AuditRecord[],
): CleanedReview[] {
  const auditMap = new Map(audit.map((a) => [a.review_id, a]));
  const seen = new Map<string, string>(); // dedupeKey -> review id
  const kept: CleanedReview[] = [];
  const out: CleanedReview[] = [];

  for (const review of reviews) {
    const normalized = normalizeText(review.text);
    const flags: CleanedReview["flags"] = [];
    const key = dedupeKey(normalized);
    let state: CleanState = { kind: "clean" };

    const dupOf = seen.get(key);
    if (dupOf) {
      state = { kind: "excluded", reason: "duplicate", by: "program", note: `与 ${dupOf} 文本完全相同` };
      flags.push({ reason: "duplicate", note: `与 ${dupOf} 文本完全相同` });
    } else {
      const near = kept.find((k) => similarity(k.normalized, normalized) >= NEAR_DUP_THRESHOLD);
      if (near) flags.push({ reason: "near_duplicate", note: `与 ${near.review.id} 高度相似` });
      if (looksLikeAd(normalized)) flags.push({ reason: "ad", note: "包含引流或广告用语" });
      if (lacksUsageContent(normalized)) flags.push({ reason: "no_usage_content", note: "文本过短或无具体使用内容" });
      const other = mentionsOtherModel(normalized, phone, catalog);
      if (other) flags.push({ reason: "model_mismatch", note: `提到了其他机型（${other}）` });

      const decision = auditMap.get(review.id);
      if (decision?.decision === "exclude" && decision.reason) {
        state = { kind: "excluded", reason: decision.reason, by: "audit", note: decision.note };
      } else if (decision?.decision === "keep") {
        state = { kind: "clean" };
      } else if (flags.length > 0) {
        state = { kind: "flagged", reason: flags[0].reason, note: flags[0].note };
      }
      seen.set(key, review.id);
    }

    const item = { review, normalized, state, flags };
    out.push(item);
    if (state.kind === "clean") kept.push(item);
  }
  return out;
}

/* ---------------- 标签校验 ---------------- */

export interface LabelIssue {
  review_id: string;
  problem: "unknown_review" | "bad_dimension" | "bad_sentiment" | "excerpt_not_found" | "duplicate_dimension";
  detail: string;
}

/**
 * 校验模型或人工给出的维度标签：编号存在、维度与情绪合法、摘录确实来自该条原文。
 * 同一评论同一维度只保留第一条。
 */
export function validateLabels(
  labels: unknown[],
  textById: Map<string, string>,
): { valid: ReviewLabel[]; issues: LabelIssue[] } {
  const valid: ReviewLabel[] = [];
  const issues: LabelIssue[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const l = raw as Partial<ReviewLabel>;
    const id = String(l?.review_id ?? "");
    const text = textById.get(id);
    if (text === undefined) {
      issues.push({ review_id: id, problem: "unknown_review", detail: "评论编号不存在" });
      continue;
    }
    if (!LABEL_DIMENSIONS.includes(l.dimension as LabelDimension)) {
      issues.push({ review_id: id, problem: "bad_dimension", detail: `非法维度：${String(l.dimension)}` });
      continue;
    }
    if (!SENTIMENTS.includes(l.sentiment as (typeof SENTIMENTS)[number])) {
      issues.push({ review_id: id, problem: "bad_sentiment", detail: `非法情绪：${String(l.sentiment)}` });
      continue;
    }
    const excerpt = normalizeText(String(l.excerpt ?? ""));
    if (!excerpt || !normalizeText(text).includes(excerpt)) {
      issues.push({ review_id: id, problem: "excerpt_not_found", detail: `摘录不在原文中：${excerpt.slice(0, 40)}` });
      continue;
    }
    const k = `${id}::${l.dimension}`;
    if (seen.has(k)) {
      issues.push({ review_id: id, problem: "duplicate_dimension", detail: "同一评论同一维度重复标注，已合并" });
      continue;
    }
    seen.add(k);
    valid.push({
      review_id: id,
      dimension: l.dimension as LabelDimension,
      sentiment: l.sentiment as ReviewLabel["sentiment"],
      excerpt,
      explanation: String(l.explanation ?? "").slice(0, 120),
    });
  }
  return { valid, issues };
}

/** 把分析记录中的标签再校验一遍，防止数据文件被手工改坏 */
export function revalidateAnalysis(analysis: AnalysisRecord[], reviews: ReviewRecord[]) {
  const textById = new Map(reviews.map((r) => [r.id, r.text]));
  const allLabels = analysis.flatMap((a) => a.labels);
  return validateLabels(allLabels, textById);
}
