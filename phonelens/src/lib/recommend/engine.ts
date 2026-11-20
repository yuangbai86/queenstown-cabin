/**
 * 基础模式推荐引擎：只用已核验字段与程序统计，输出可追溯的判断。
 * 每条判断都带证据编号；没有证据时给出“证据不足”而不是猜测。
 */
import type { Dimension, Preference, RecStatus, UserNeeds } from "../types";
import { DIMENSION_LABEL, PREFERENCE_LABEL } from "../labels";
import type { Comparability, SampleStats } from "../stats";
import { statId } from "../evidence";
import type { BudgetFit } from "../rules";

export type Side = "a" | "b";
export type VerdictSide = Side | "even" | "unknown";

export interface Claim {
  text: string;
  evidence: string[];
}

export interface Verdict {
  pref: Preference;
  side: VerdictSide;
  strength: "strong" | "weak" | null;
  basis: "spec" | "reviews" | "mixed" | "none";
  claims: Claim[]; // 依据说明
  caveat: string | null;
}

export interface Recommendation {
  status: RecStatus;
  lean: Side | null;
  summary: Claim[]; // 三至五句
  reasons: Claim[];
  tradeoffs: Claim[];
  questions: string[];
  gaps: string[];
  verdicts: Verdict[]; // 用户所选偏好，按优先级
  otherVerdicts: Verdict[]; // 其余维度，用于找出“需要接受的代价”
}

export interface EngineSpecs {
  get(side: Side, field: string): { id: string; value: string | number | null; unit: string | null } | undefined;
}

export interface EngineInput {
  names: Record<Side, string>;
  hasSpecs: Record<Side, boolean>;
  hasReviews: Record<Side, boolean>;
  specs: EngineSpecs;
  stats: Record<Side, SampleStats>;
  comparability: Comparability;
  needs: UserNeeds;
  budget: Record<Side, BudgetFit>;
  priceIds: Record<Side, string | null>;
}

const other = (s: Side): Side => (s === "a" ? "b" : "a");
const tag = (s: Side) => (s === "a" ? "A" : "B");

/* ---------- 口碑信号：仅在样本可比时使用 ---------- */

interface ReviewSignal {
  side: VerdictSide;
  strength: "strong" | "weak" | null;
  claim: Claim;
}

/**
 * 口碑信号的保守规则：
 * - 只在两组样本可比（来源相同、数量足够、时间范围大体重叠、系统版本覆盖接近）时使用；
 * - 对“正面占比”“负面占比”分别做双比例 z 检验，|z| ≥ 1.96 才视为差异明显，且两个方向不得互相矛盾；
 * - 即使差异明显，口碑信号也只算“较弱”，不能单独让推荐变成“更值得考虑”。
 * 这是对已收录样本的描述，不是对总体体验的估计。
 */
export const MIN_MENTIONS = 3;
export const Z_THRESHOLD = 1.96;

export function twoPropZ(x1: number, n1: number, x2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return (x1 / n1 - x2 / n2) / se;
}

export function reviewSignal(input: EngineInput, dim: Dimension): ReviewSignal {
  const { stats, comparability, names } = input;
  const ev = [statId(stats.a.phone_id, dim, stats.a.window), statId(stats.b.phone_id, dim, stats.b.window)];
  const label = DIMENSION_LABEL[dim];
  if (!input.hasReviews.a || !input.hasReviews.b) {
    return {
      side: "unknown",
      strength: null,
      claim: { text: `至少一款没有可用的评论样本，暂不依据${label}口碑判断。`, evidence: ev.filter((_, i) => input.hasReviews[i === 0 ? "a" : "b"]) },
    };
  }
  const A = stats.a.dims[dim];
  const B = stats.b.dims[dim];
  const desc = (s: Side) => {
    const d = stats[s].dims[dim];
    return `${tag(s)} 有 ${d.pos} 条正面、${d.neg} 条负面、${d.mixed} 条褒贬混合（已分析 ${stats[s].n} 条）`;
  };
  const base = `已收录样本中提到${label}的评论：${desc("a")}；${desc("b")}。`;
  if (!comparability.comparable) {
    return {
      side: "unknown",
      strength: null,
      claim: { text: `${base}两款评论样本口径不同（${comparability.reasons[0]}），不据此比较优劣。`, evidence: ev },
    };
  }
  if (A.mentions < MIN_MENTIONS || B.mentions < MIN_MENTIONS) {
    return { side: "unknown", strength: null, claim: { text: `${base}至少一款提及少于 ${MIN_MENTIONS} 条，不足以判断。`, evidence: ev } };
  }
  const na = stats.a.n;
  const nb = stats.b.n;
  const zPos = twoPropZ(A.pos, na, B.pos, nb); // > 0：A 正面占比更高
  const zNeg = twoPropZ(A.neg, na, B.neg, nb); // > 0：A 负面占比更高
  const favorA = zPos >= Z_THRESHOLD || zNeg <= -Z_THRESHOLD;
  const favorB = zPos <= -Z_THRESHOLD || zNeg >= Z_THRESHOLD;
  if (favorA === favorB) {
    return {
      side: "even",
      strength: null,
      claim: { text: `${base}按当前样本量，两款的正负面占比差异不明显，不据此区分优劣。`, evidence: ev },
    };
  }
  const winner: Side = favorA ? "a" : "b";
  return {
    side: winner,
    strength: "weak",
    claim: {
      text: `${base}${tag(winner)}（${names[winner]}）的正面反馈占比相对较高，差异超出样本波动范围；但这只描述已收录样本，不能单独证明实际体验更好。`,
      evidence: ev,
    },
  };
}

/* ---------- 各偏好的判断 ---------- */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function handlingVerdict(input: EngineInput): Verdict {
  const wa = input.specs.get("a", "weight_g");
  const wb = input.specs.get("b", "weight_g");
  const a = num(wa?.value);
  const b = num(wb?.value);
  const sig = reviewSignal(input, "handling");
  if (a === null || b === null) {
    return {
      pref: "handling",
      side: sig.side,
      strength: sig.side === "a" || sig.side === "b" ? "weak" : null,
      basis: sig.side === "unknown" ? "none" : "reviews",
      claims: [
        { text: `${a === null ? "A" : "B"} 的重量尚未核验，无法按克数比较。`, evidence: [wa?.id, wb?.id].filter(Boolean) as string[] },
        sig.claim,
      ],
      caveat: "握持感还与宽度、重心和个人习惯有关。",
    };
  }
  const diff = Math.abs(a - b);
  const lighter: Side = a < b ? "a" : "b";
  const wIds = [wa!.id, wb!.id];
  const widthA = input.specs.get("a", "width_mm");
  const widthB = input.specs.get("b", "width_mm");
  const widthIds = [widthA?.id, widthB?.id].filter((x): x is string => !!x && true);
  const claims: Claim[] = [];
  if (diff < 8) {
    claims.push({ text: `两款重量接近（A ${a} g，B ${b} g，相差 ${diff} g）。`, evidence: wIds });
  } else {
    claims.push({
      text: `重量记录：A ${a} g，B ${b} g，${tag(lighter)} 轻 ${Math.round(diff * 10) / 10} g。`,
      evidence: wIds,
    });
  }
  const wa2 = num(widthA?.value);
  const wb2 = num(widthB?.value);
  if (wa2 !== null && wb2 !== null) {
    claims.push({ text: `机身宽度：A ${wa2} mm，B ${wb2} mm。`, evidence: widthIds });
  }
  if (sig.side !== "unknown") claims.push(sig.claim);
  return {
    pref: "handling",
    side: diff < 8 ? "even" : lighter,
    strength: diff >= 15 ? "strong" : diff >= 8 ? "weak" : null,
    basis: sig.side !== "unknown" ? "mixed" : "spec",
    claims,
    caveat: "握持感还与宽度、重心和个人习惯有关，重量差不等于所有人的手感差异。",
  };
}

function capacityClaim(input: EngineInput): Claim | null {
  const ba = input.specs.get("a", "battery_mah");
  const bb = input.specs.get("b", "battery_mah");
  const a = num(ba?.value);
  const b = num(bb?.value);
  if (a === null || b === null) return null;
  return {
    text: `电池容量规格：A ${a} mAh，B ${b} mAh。容量是规格事实，不能直接推出实际续航。`,
    evidence: [ba!.id, bb!.id],
  };
}

function batteryVerdict(input: EngineInput): Verdict {
  const sig = reviewSignal(input, "battery");
  const claims: Claim[] = [sig.claim];
  const cap = capacityClaim(input);
  if (cap) claims.push(cap);
  return {
    pref: "battery",
    side: sig.side,
    strength: sig.strength,
    basis: sig.side === "unknown" ? "none" : "reviews",
    claims,
    caveat: sig.side === "unknown" ? "目前没有可比的续航测试或足够的可比评论，不足以判断实际续航。" : "评论反映的是已收录用户的主观感受，与使用强度有关。",
  };
}

function cameraVerdict(input: EngineInput): Verdict {
  const sig = reviewSignal(input, "camera");
  const claims: Claim[] = [sig.claim];
  const ta = input.specs.get("a", "telephoto");
  const tb = input.specs.get("b", "telephoto");
  if (ta?.value && tb?.value) {
    const noA = String(ta.value) === "无";
    const noB = String(tb.value) === "无";
    if (noA !== noB) {
      claims.push({
        text: `长焦配置：A ${ta.value}，B ${tb.value}。这是功能差异（远距离拍摄），不代表整体成像更好。`,
        evidence: [ta.id, tb.id],
      });
    }
  }
  return {
    pref: "camera",
    side: sig.side,
    strength: sig.strength,
    basis: sig.side === "unknown" ? "none" : "reviews",
    claims,
    caveat: "像素和镜头数量不能直接推出成像质量。",
  };
}

function gamingVerdict(input: EngineInput): Verdict {
  const s = reviewSignal(input, "smoothness");
  const h = reviewSignal(input, "heat");
  const ca = input.specs.get("a", "chip");
  const cb = input.specs.get("b", "chip");
  const chipClaim: Claim | null =
    ca?.value && cb?.value
      ? { text: `处理器：A ${ca.value}，B ${cb.value}。芯片名称本身不足以判断实际游戏表现。`, evidence: [ca.id, cb.id] }
      : null;
  const known = [s, h].filter((x) => x.side === "a" || x.side === "b");
  let side: VerdictSide = "unknown";
  let strength: Verdict["strength"] = null;
  if (s.side === "unknown" && h.side === "unknown") side = "unknown";
  else if (known.length === 0) side = "even";
  else if (known.length === 2 && known[0].side !== known[1].side) side = "even";
  else {
    side = known[0].side;
    strength = "weak";
  }
  const claims: Claim[] = [s.claim, h.claim];
  if (chipClaim) claims.push(chipClaim);
  return {
    pref: "gaming",
    side,
    strength,
    basis: side === "unknown" ? "none" : "reviews",
    claims,
    caveat:
      side === "unknown"
        ? "目前不足以判断实际游戏表现。"
        : "流畅度与发热分开统计；发热反馈本身不能证明掉帧。没有同条件的游戏帧率测试。",
  };
}

function ecosystemVerdict(input: EngineInput): Verdict {
  const sig = reviewSignal(input, "stability");
  const oa = input.specs.get("a", "os");
  const ob = input.specs.get("b", "os");
  const claims: Claim[] = [];
  if (oa?.value && ob?.value) claims.push({ text: `出厂系统：A ${oa.value}，B ${ob.value}。`, evidence: [oa.id, ob.id] });
  claims.push(sig.claim);
  return {
    pref: "ecosystem",
    side: sig.side,
    strength: sig.side === "a" || sig.side === "b" ? "weak" : null,
    basis: sig.side === "unknown" ? "none" : "reviews",
    claims,
    caveat: "与你现有设备的兼容性没有可核验证据，需要你自行确认；这里只比较了系统稳定性相关评论。",
  };
}

const VERDICT_FN: Record<Preference, (i: EngineInput) => Verdict> = {
  handling: handlingVerdict,
  battery: batteryVerdict,
  camera: cameraVerdict,
  gaming: gamingVerdict,
  ecosystem: ecosystemVerdict,
};

/* ---------- 组合 ---------- */

function isSide(v: VerdictSide): v is Side {
  return v === "a" || v === "b";
}

/**
 * 推荐状态：
 * - 首要偏好证据不足 → 证据不足；
 * - 首要偏好只有口碑信号（basis = reviews）时，最多给出“各有取舍”及倾向，不给“更值得考虑”；
 * - 其次偏好方向相反（不论强弱）→ 各有取舍，保留首要偏好的倾向；
 * - 首要偏好由已记录参数给出较明确差异，且其次不反对 → 更值得考虑。
 */
export function decideStatus(primary: Verdict | undefined, secondary: Verdict | undefined): { status: RecStatus; lean: Side | null } {
  if (!primary) return { status: "insufficient", lean: null };
  const P = primary.side;
  const S = secondary?.side;
  if (P === "unknown") return { status: "insufficient", lean: S && isSide(S) ? S : null };
  if (P === "even") {
    if (S && isSide(S) && secondary!.strength === "strong" && secondary!.basis !== "reviews") return { status: `prefer_${S}` as RecStatus, lean: S };
    return { status: "tradeoff", lean: S && isSide(S) ? S : null };
  }
  if (S && isSide(S) && S !== P) return { status: "tradeoff", lean: P };
  const decisive = primary.strength === "strong" && primary.basis !== "reviews";
  return decisive ? { status: `prefer_${P}` as RecStatus, lean: P } : { status: "tradeoff", lean: P };
}

function shortReason(v: Verdict, names: Record<Side, string>): string {
  const label = PREFERENCE_LABEL[v.pref];
  if (v.side === "unknown") return `「${label}」方面证据不足`;
  if (v.side === "even") return `「${label}」方面两款差异不明显`;
  if (v.basis === "reviews") return `「${label}」方面已收录评论中 ${tag(v.side)}（${names[v.side]}）的正面反馈占比较高（仅供参考）`;
  return `「${label}」方面 ${tag(v.side)}（${names[v.side]}）${v.strength === "strong" ? "有较明确的差异" : "略有差异"}`;
}

function verdictEvidence(v: Verdict): string[] {
  return [...new Set(v.claims.flatMap((c) => c.evidence))];
}

export function recommend(input: EngineInput): Recommendation {
  const { needs, names } = input;
  const prefs = needs.prefs.slice(0, 2);
  const verdicts = prefs.map((p) => VERDICT_FN[p](input));
  const otherVerdicts = (Object.keys(VERDICT_FN) as Preference[]).filter((p) => !prefs.includes(p)).map((p) => VERDICT_FN[p](input));
  const gaps: string[] = [];
  const questions: string[] = [];

  // 数据完全缺失时直接返回证据不足
  const missingAll = (["a", "b"] as Side[]).filter((s) => !input.hasSpecs[s] && !input.hasReviews[s]);
  if (missingAll.length > 0) {
    const who = missingAll.map((s) => `${tag(s)}（${names[s]}）`).join("、");
    return {
      status: "insufficient",
      lean: null,
      summary: [
        { text: `${who}目前没有已核验的参数，也没有已收录的评论，无法给出比较建议。`, evidence: [] },
        { text: "你可以先查看目录中数据完整的机型，或导入自己有权使用的评论生成口碑摘要。", evidence: [] },
      ],
      reasons: [],
      tradeoffs: [],
      questions: [],
      gaps: [`${who} 的参数与评论尚未收录`],
      verdicts,
      otherVerdicts,
    };
  }

  let { status, lean } = decideStatus(verdicts[0], verdicts[1]);

  // 预算：被推荐的一款超预算而另一款在预算内时，降级为“各有取舍”
  const tradeoffs: Claim[] = [];
  if (needs.budget) {
    for (const s of ["a", "b"] as Side[]) {
      const f = input.budget[s];
      if (f.kind === "over") {
        tradeoffs.push({
          text: `${tag(s)}（${names[s]}）的已知价格 ${f.amount} 元，超出你的预算 ${needs.budget} 元（多 ${f.by} 元）。`,
          evidence: input.priceIds[s] ? [input.priceIds[s]!] : [],
        });
      }
      if (f.kind === "no_price") gaps.push(`${tag(s)} 缺少价格记录，无法判断是否在预算内`);
    }
    const chosen = status === "prefer_a" ? "a" : status === "prefer_b" ? "b" : null;
    if (chosen && input.budget[chosen].kind === "over" && input.budget[other(chosen)].kind === "within") {
      status = "tradeoff";
      lean = chosen;
    }
  }

  // 需要接受的代价：被倾向的一款在其他维度落后之处
  if (lean) {
    const against = [...verdicts.slice(1), ...otherVerdicts].filter((v) => v.side === other(lean!));
    against.sort((x, y) => (x.strength === "strong" ? -1 : 1) - (y.strength === "strong" ? -1 : 1));
    for (const v of against.slice(0, 2)) {
      tradeoffs.push({
        text: `选择 ${tag(lean)} 的代价：${shortReason(v, names)}。`,
        evidence: verdictEvidence(v),
      });
    }
  }

  for (const v of verdicts) {
    if (v.side === "unknown") gaps.push(`「${PREFERENCE_LABEL[v.pref]}」：${(v.caveat ?? "证据不足").replace(/。$/, "")}`);
  }
  if (!input.comparability.comparable && input.hasReviews.a && input.hasReviews.b) {
    gaps.push(`两款评论样本口径不同：${input.comparability.reasons.join("；")}`);
  }
  for (const s of ["a", "b"] as Side[]) {
    if (!input.hasSpecs[s]) gaps.push(`${tag(s)} 的参数尚未核验`);
    if (!input.hasReviews[s]) gaps.push(`${tag(s)} 没有已收录的评论样本`);
  }

  // 生态与设备：只提出需要确认的问题，不推定兼容性
  if (needs.eco.length > 0 || needs.device) {
    const eco = needs.eco.length ? `你已有的配套设备` : "你现在的手机";
    questions.push(`请确认${eco}与 A、B 的配合方式（如数据迁移、手表配对、文件互传），这里没有可核验的兼容性证据。`);
  }
  if (needs.device) {
    questions.push(`你现在使用${needs.device === "iphone" ? " iPhone" : "安卓手机"}，换到不同系统会有迁移成本，但这不代表你必须选择同一系统。`);
  }
  if (verdicts.some((v) => v.pref === "gaming")) {
    questions.push("你常玩的具体游戏是哪些？可以查找同条件的帧率或发热测评来补充判断。");
  }

  const reasons: Claim[] = verdicts.map((v) => ({
    text: `${shortReason(v, names)}。`,
    evidence: verdictEvidence(v),
  }));

  // 摘要（三至五句）
  const summary: Claim[] = [];
  const p1 = verdicts[0];
  const p1Label = p1 ? PREFERENCE_LABEL[p1.pref] : "";
  if (status === "prefer_a" || status === "prefer_b") {
    const s = status === "prefer_a" ? "a" : "b";
    summary.push({
      text: `按你以「${p1Label}」为先的需求，更值得考虑 ${tag(s)}（${names[s]}）。`,
      evidence: verdictEvidence(p1),
    });
  } else if (status === "tradeoff") {
    summary.push({
      text: lean
        ? `两款各有取舍；如果「${p1Label}」对你最重要，可以略偏向 ${tag(lean)}（${names[lean]}）${p1 && p1.side === lean && p1.basis === "reviews" ? "，但依据只是已收录评论的倾向，不足以说明实际体验更好" : ""}。`
        : `在你关心的方面，两款差异不明显，各有取舍。`,
      evidence: p1 ? verdictEvidence(p1) : [],
    });
  } else {
    summary.push({
      text: `现有证据不足以判断哪款更适合以「${p1Label}」为先的需求，暂不推荐其中一款。`,
      evidence: p1 ? verdictEvidence(p1) : [],
    });
  }
  for (const v of verdicts) {
    const main = v.claims[0];
    if (main) summary.push({ text: main.text, evidence: main.evidence });
  }
  if (tradeoffs[0]) summary.push(tradeoffs[0]);
  if (gaps[0] && summary.length < 5) summary.push({ text: `证据缺口：${gaps[0]}。`, evidence: [] });

  return { status, lean, summary: summary.slice(0, 5), reasons, tradeoffs, questions, gaps, verdicts, otherVerdicts };
}
