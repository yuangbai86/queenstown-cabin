/**
 * 结果页摘要：把基础模式的判断压缩成“一句结论 + 最多两条理由 + 一条主要取舍”，
 * 并挑出与偏好最相关的 3–4 项关键差异。
 * 只重新组织已有判断和记录，不产生新的结论；每条文字仍带证据编号。
 */
import type { Comparison } from "./compare";
import type { Claim, Side, Verdict } from "./engine";
import type { Dimension, Preference, SpecField } from "../types";
import { DIMENSION_LABEL } from "../labels";

export const SHORT_PREF: Record<Preference, string> = {
  camera: "拍照",
  gaming: "游戏",
  battery: "续航",
  handling: "轻便",
  ecosystem: "系统",
};

export interface KeyRow {
  key: string;
  label: string;
  kind: "spec" | "reviews" | "price";
  a: { text: string; missing: boolean };
  b: { text: string; missing: boolean };
  evidence: string[];
  note: string | null;
}

export interface Brief {
  eyebrow: string;
  headline: Claim;
  reasons: Claim[];
  tradeoff: Claim | null;
  missing: string | null;
  rows: KeyRow[];
}

/** 页面上的短名称：演示机型用型号，真实机型在型号只有数字时补上品牌 */
export function shortName(c: Comparison, s: Side): string {
  const p = c[s];
  if (p.data_kind === "demo") return p.model;
  return /^[\d\s]+$/.test(p.model) ? `${p.brand} ${p.model}` : p.model;
}

function specRow(c: Comparison, field: SpecField, note: string | null = null): KeyRow | null {
  const r = c.specRows.find((x) => x.field === field);
  if (!r) return null;
  if (r.a.missing && r.b.missing) return null;
  return {
    key: `spec:${field}`,
    label: r.label,
    kind: "spec",
    a: { text: r.a.text, missing: r.a.missing },
    b: { text: r.b.text, missing: r.b.missing },
    evidence: [r.a.evidence, r.b.evidence],
    note,
  };
}

function reviewRow(c: Comparison, dim: Dimension): KeyRow | null {
  if (c.stats.a.n_total === 0 && c.stats.b.n_total === 0) return null;
  const cell = (s: Side) => {
    const st = c.stats[s];
    if (st.n === 0) return { text: st.n_total === 0 ? "暂无样本" : "当前范围无样本", missing: true };
    const d = st.dims[dim];
    return { text: `正面 ${d.pos} · 负面 ${d.neg} / ${st.n} 条`, missing: false };
  };
  return {
    key: `reviews:${dim}`,
    label: DIMENSION_LABEL[dim],
    kind: "reviews",
    a: cell("a"),
    b: cell("b"),
    evidence: [`stat:${c.a.id}:${dim}:${c.window}`, `stat:${c.b.id}:${dim}:${c.window}`],
    note: !c.comparability.comparable && c.stats.a.n > 0 && c.stats.b.n > 0 ? "两款样本口径不同，不据此比较优劣" : null,
  };
}

function priceRow(c: Comparison): KeyRow | null {
  if (!c.a.price && !c.b.price) return null;
  const cell = (s: Side) => {
    const p = c[s].price;
    return p ? { text: `¥${p.amount.toLocaleString("zh-CN")}`, missing: false } : { text: "暂无价格", missing: true };
  };
  return {
    key: "price",
    label: "参考价",
    kind: "price",
    a: cell("a"),
    b: cell("b"),
    evidence: [c.a.price?.evidence_id, c.b.price?.evidence_id].filter(Boolean) as string[],
    note: null,
  };
}

const PREF_ROWS: Record<Preference, (c: Comparison) => (KeyRow | null)[]> = {
  handling: (c) => [specRow(c, "weight_g", "握持感还与宽度、重心和习惯有关"), specRow(c, "width_mm"), reviewRow(c, "handling")],
  battery: (c) => [specRow(c, "battery_mah", "容量不等于实际续航"), reviewRow(c, "battery")],
  camera: (c) => [specRow(c, "telephoto"), reviewRow(c, "camera")],
  gaming: (c) => [specRow(c, "chip", "芯片名称不能说明实际游戏表现"), reviewRow(c, "smoothness"), reviewRow(c, "heat")],
  ecosystem: (c) => [specRow(c, "os"), reviewRow(c, "stability")],
};

const OBJECTIVE_FIELDS: SpecField[] = ["weight_g", "battery_mah", "display_size_in", "telephoto", "wired_charging_w", "main_camera_mp", "chip"];

export function keyRows(c: Comparison, max = 4): KeyRow[] {
  const rows: KeyRow[] = [];
  const push = (r: KeyRow | null) => {
    if (r && rows.length < max && !rows.some((x) => x.key === r.key)) rows.push(r);
  };
  const prefs = c.needs.prefs;
  if (prefs.length > 0) {
    // 首要偏好最多占三行，留位置给其次偏好
    const first = PREF_ROWS[prefs[0]](c).filter(Boolean);
    first.slice(0, prefs[1] ? 2 : 3).forEach(push);
    if (prefs[1]) PREF_ROWS[prefs[1]](c).forEach(push);
    first.slice(2).forEach(push);
  } else {
    for (const f of OBJECTIVE_FIELDS) {
      const r = specRow(c, f);
      if (r && c.specRows.find((x) => x.field === f)?.differs) push(r);
    }
  }
  push(priceRow(c));
  return rows;
}

/* ---------------- 简短文字 ---------------- */

function num(c: Comparison, s: Side, field: SpecField): number | null {
  const r = c.specRows.find((x) => x.field === field);
  if (!r || r[s].missing) return null;
  const v = Number.parseFloat(r[s].text);
  return Number.isFinite(v) ? v : null;
}

const ev = (v: Verdict) => [...new Set(v.claims.flatMap((x) => x.evidence))];

/** 取舍短句：说明被倾向的一款在哪方面落后 */
export function tradeoffText(c: Comparison, v: Verdict): string {
  const n = { a: shortName(c, "a"), b: shortName(c, "b") };
  if (v.side !== "a" && v.side !== "b") return shortReason(c, v).text;
  if (v.pref === "handling" && v.basis !== "reviews") {
    const wa = num(c, "a", "weight_g");
    const wb = num(c, "b", "weight_g");
    if (wa !== null && wb !== null) return `代价：${n[v.side]} 更轻（${wa} g 对 ${wb} g）`;
  }
  return `代价：${SHORT_PREF[v.pref]}方面，${n[v.side]} 的样本反馈更正面`;
}

/** 单条判断的短句（尽量不超过 40 个汉字） */
export function shortReason(c: Comparison, v: Verdict): Claim {
  const n = { a: shortName(c, "a"), b: shortName(c, "b") };
  const label = SHORT_PREF[v.pref];
  if (v.pref === "handling" && v.basis !== "reviews" && v.basis !== "none") {
    const wa = num(c, "a", "weight_g");
    const wb = num(c, "b", "weight_g");
    if (wa !== null && wb !== null) {
      if (v.side === "a" || v.side === "b") {
        const diff = Math.round(Math.abs(wa - wb) * 10) / 10;
        return { text: `${n[v.side]} 轻 ${diff} g（${wa} g 对 ${wb} g）`, evidence: ev(v) };
      }
      return { text: `两款重量接近（${wa} g 对 ${wb} g）`, evidence: ev(v) };
    }
  }
  if (v.side === "unknown") {
    if (v.pref === "gaming") return { text: "游戏：只有芯片名称，无法判断实际表现", evidence: ev(v) };
    if (v.pref === "handling") return { text: "轻便：重量尚未核验，无法比较", evidence: ev(v) };
    return { text: `${label}：缺少可比的样本反馈`, evidence: ev(v) };
  }
  if (v.side === "even") return { text: `${label}：样本反馈差异不明显`, evidence: ev(v) };
  return { text: `${label}：${n[v.side]} 的样本反馈更正面`, evidence: ev(v) };
}

function sideGaps(c: Comparison, n: Record<Side, string>): string | null {
  const parts: string[] = [];
  for (const s of ["a", "b"] as Side[]) {
    if (c[s].state === "specs_only") parts.push(`${n[s]} 暂无评论样本`);
    if (c[s].state === "reviews_only") parts.push(`${n[s]} 参数尚未核验`);
    if (c[s].state === "none") parts.push(`${n[s]} 尚未收录数据`);
  }
  return parts.length ? parts.join("；") : null;
}

export function buildBrief(c: Comparison): Brief {
  const rec = c.recommendation;
  const n = { a: shortName(c, "a"), b: shortName(c, "b") };
  const rows = keyRows(c);

  if (rec.objective) {
    return {
      eyebrow: "客观比较",
      headline: { text: "未选择需求，只列出可核验的差异。", evidence: [] },
      reasons: [],
      tradeoff: null,
      missing: sideGaps(c, n),
      rows,
    };
  }

  const [p1, p2] = rec.verdicts;
  const p1Label = p1 ? SHORT_PREF[p1.pref] : "";
  const reasons = rec.verdicts.slice(0, 2).map((v) => shortReason(c, v));

  // 数据完全缺失
  if (rec.status === "insufficient" && rec.verdicts.every((v) => v.claims.length === 0 || v.side === "unknown") && (c.a.state === "none" || c.b.state === "none")) {
    const who = (["a", "b"] as Side[]).filter((s) => c[s].state === "none").map((s) => n[s]).join("、");
    return {
      eyebrow: "证据不足",
      headline: { text: `${who} 还没有收录参数和评论，暂不推荐。`, evidence: [] },
      reasons: [],
      tradeoff: null,
      missing: `${who} 的参数与评论尚未收录`,
      rows,
    };
  }

  const budgetOver = (s: Side) => {
    const p = c[s].price;
    return c.needs.budget && p && p.amount > c.needs.budget ? p.amount - c.needs.budget : null;
  };

  let headline: string;
  let eyebrow: string;
  const lean = rec.lean;
  if (rec.status === "prefer_a" || rec.status === "prefer_b") {
    const s = rec.status === "prefer_a" ? "a" : "b";
    eyebrow = `更值得考虑 ${n[s]}`;
    headline = `看重${p1Label}，${n[s]} 更值得考虑。`;
  } else if (rec.status === "tradeoff") {
    eyebrow = "各有取舍";
    if (lean && budgetOver(lean) && p1?.side === lean) headline = `看重${p1Label}可偏向 ${n[lean]}，但它超出预算。`;
    else if (lean && p1?.side === lean && p1.basis === "reviews") headline = `看重${p1Label}，可略偏向 ${n[lean]}。`;
    else if (lean && p1?.side === lean) headline = `看重${p1Label}，可偏向 ${n[lean]}。`;
    else headline = "在你在意的方面，两款差异不明显。";
  } else {
    eyebrow = "证据不足";
    headline = "证据不足，暂不推荐其中一款。";
  }

  // 主要取舍：其次偏好方向相反 > 超预算 > 其他方面方向相反
  let tradeoff: Claim | null = null;
  if (lean) {
    const other: Side = lean === "a" ? "b" : "a";
    const opp = [p2, ...rec.otherVerdicts].find((v) => v && v.side === other);
    const over = budgetOver(lean);
    if (p2 && p2.side === other) tradeoff = { text: tradeoffText(c, p2), evidence: ev(p2) };
    else if (over) tradeoff = { text: `代价：${n[lean]} 超出预算 ${over} 元`, evidence: c[lean].price ? [c[lean].price!.evidence_id] : [] };
    else if (opp) tradeoff = { text: tradeoffText(c, opp), evidence: ev(opp) };
  }

  const missing = rec.status === "insufficient" ? (p1 ? shortReason(c, p1).text : sideGaps(c, n)) : null;

  return {
    eyebrow,
    headline: { text: headline, evidence: p1 ? ev(p1) : [] },
    // 与倾向方向相反的判断只作为“取舍”出现一次，不再重复列在理由里
    reasons:
      rec.status === "insufficient"
        ? reasons.slice(1)
        : rec.verdicts
            .slice(0, 2)
            .filter((v) => !(lean && (v.side === "a" || v.side === "b") && v.side !== lean))
            .map((v) => shortReason(c, v)),
    tradeoff,
    missing,
    rows,
  };
}
