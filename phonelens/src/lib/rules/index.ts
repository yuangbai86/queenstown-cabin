/**
 * 公平比较规则（第 5 节）。阈值均为可配置的界面提示规则，不是科学结论。
 */
import type { PhoneRecord, PriceRecord, PriceType } from "../types";
import { PRICE_TYPE_LABEL } from "../labels";

export const PRICE_GAP_THRESHOLD = 0.3;

export interface RuleWarning {
  code: "storage_mismatch" | "price_type_mismatch" | "price_missing" | "price_gap" | "user_price" | "region_unclear";
  text: string;
  evidence: string[];
}

/** 选择用于比较的价格：优先与机型存储一致的官方当前售价，其次建议零售价 */
export function pickPrice(prices: PriceRecord[], phone: PhoneRecord, userPrice?: number | null): PriceRecord | null {
  if (userPrice && userPrice > 0) {
    return {
      id: `price:user:${phone.id}`,
      phone_id: phone.id,
      storage: phone.storage,
      amount: userPrice,
      currency: "CNY",
      price_type: "user_reported",
      channel: "用户填写",
      conditions: "用户填写，未核验",
      recorded_at: new Date().toISOString().slice(0, 10),
      source_id: null,
      data_kind: "user",
    };
  }
  const rank: Record<PriceType, number> = { official_current: 0, official_msrp: 1, user_reported: 2 };
  const same = prices.filter((p) => p.phone_id === phone.id && p.storage === phone.storage);
  same.sort((a, b) => rank[a.price_type] - rank[b.price_type] || b.recorded_at.localeCompare(a.recorded_at));
  return same[0] ?? null;
}

/** 页面上的短名称：演示机型用型号，真实机型在型号只有数字时补上品牌 */
export function phoneShortName(p: PhoneRecord): string {
  if (p.data_kind === "demo") return p.model;
  return /^[\d\s]+$/.test(p.model) ? `${p.brand} ${p.model}` : p.model;
}

export function fairnessWarnings(a: PhoneRecord, b: PhoneRecord, pa: PriceRecord | null, pb: PriceRecord | null): RuleWarning[] {
  const w: RuleWarning[] = [];
  const A = phoneShortName(a);
  const B = phoneShortName(b);
  if (a.storage !== b.storage) {
    w.push({
      code: "storage_mismatch",
      text: `两款存储容量不同（${A} ${a.storage}，${B} ${b.storage}），价格不能直接比较，不判断谁更划算。`,
      evidence: [],
    });
  }
  if (!pa || !pb) {
    w.push({
      code: "price_missing",
      text: `${!pa && !pb ? "两款都" : !pa ? `${A} ` : `${B} `}缺少价格记录，不比较价格。`,
      evidence: [pa?.id, pb?.id].filter(Boolean) as string[],
    });
  } else {
    if (pa.price_type !== pb.price_type) {
      w.push({
        code: "price_type_mismatch",
        text: `价格口径不同（${A} 为${PRICE_TYPE_LABEL[pa.price_type]}，${B} 为${PRICE_TYPE_LABEL[pb.price_type]}），不比较谁更便宜。`,
        evidence: [pa.id, pb.id],
      });
    }
    if (pa.price_type === "user_reported" || pb.price_type === "user_reported") {
      w.push({ code: "user_price", text: "包含用户填写的价格，未经核验。", evidence: [pa.id, pb.id] });
    }
    const low = Math.min(pa.amount, pb.amount);
    const gap = Math.abs(pa.amount - pb.amount);
    if (low > 0 && gap / low > PRICE_GAP_THRESHOLD) {
      w.push({
        code: "price_gap",
        text: `两款价格相差 ${gap} 元，超过较低价的 ${Math.round(PRICE_GAP_THRESHOLD * 100)}%，注意定位与配置差异。`,
        evidence: [pa.id, pb.id],
      });
    }
  }
  return w;
}

export type BudgetFit = { kind: "unknown" } | { kind: "no_price" } | { kind: "within"; amount: number } | { kind: "over"; amount: number; by: number };

export function budgetFit(budget: number | null, price: PriceRecord | null): BudgetFit {
  if (!budget) return { kind: "unknown" };
  if (!price) return { kind: "no_price" };
  if (price.amount <= budget) return { kind: "within", amount: price.amount };
  return { kind: "over", amount: price.amount, by: price.amount - budget };
}
