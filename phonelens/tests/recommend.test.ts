import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { buildComparison, type Comparison } from "@/lib/recommend/compare";
import { decideStatus, type Verdict } from "@/lib/recommend/engine";
import { budgetFit, fairnessWarnings, pickPrice } from "@/lib/rules";
import { buildPack, cacheKey, statusAllowed, validateExplanation, allowedNumbers } from "@/lib/recommend/ai-explain";
import type { PhoneRecord, PriceRecord, UserNeeds } from "@/lib/types";

const needs = (n: Partial<UserNeeds>): UserNeeds => ({ budget: null, prefs: ["handling"], device: null, eco: [], ...n });
const cmp = (a: string, b: string, n: Partial<UserNeeds>, w: "90d" | "all" = "90d") => {
  const c = buildComparison(dataset, a, b, needs(n), w);
  if ("error" in c) throw new Error(c.error);
  return c;
};

const v = (side: Verdict["side"], strength: Verdict["strength"] = "strong"): Verdict => ({ pref: "handling", side, strength, basis: "spec", claims: [], caveat: null });

describe("推荐状态规则", () => {
  it("首要偏好证据不足时返回证据不足", () => {
    expect(decideStatus(v("unknown", null), v("a")).status).toBe("insufficient");
  });
  it("首要明确且其次不反对时推荐", () => {
    expect(decideStatus(v("a"), undefined).status).toBe("prefer_a");
    expect(decideStatus(v("b"), v("even", null)).status).toBe("prefer_b");
  });
  it("首要与其次方向相反且其次明确时为各有取舍，并保留倾向", () => {
    expect(decideStatus(v("a"), v("b"))).toEqual({ status: "tradeoff", lean: "a" });
  });
  it("首要优势较弱时不强行选出胜者", () => {
    expect(decideStatus(v("a", "weak"), undefined).status).toBe("tradeoff");
  });
});

describe("演示数据完整流程", () => {
  it("轻便优先、续航其次：各有取舍，倾向更轻的一款，每条判断都有有效证据", () => {
    const c = cmp("demo-alpha", "demo-beta", { prefs: ["handling", "battery"], budget: 6000 });
    expect(c.recommendation.status).toBe("tradeoff");
    expect(c.recommendation.lean).toBe("a");
    const claims = [...c.recommendation.summary, ...c.recommendation.reasons, ...c.recommendation.tradeoffs, ...c.recommendation.verdicts.flatMap((x) => x.claims)];
    for (const cl of claims) for (const id of cl.evidence) expect(c.evidence[id], id).toBeDefined();
  });

  it("修改偏好后推荐理由随之变化", () => {
    const a = cmp("demo-alpha", "demo-beta", { prefs: ["handling", "battery"] });
    const b = cmp("demo-alpha", "demo-beta", { prefs: ["battery"] });
    expect(b.recommendation.status).toBe("prefer_b");
    expect(b.recommendation.summary[0].text).not.toBe(a.recommendation.summary[0].text);
  });

  it("游戏偏好不从芯片名称推出结论，并写明测试缺口", () => {
    const c = cmp("demo-alpha", "demo-gamma", { prefs: ["gaming"] });
    expect(c.recommendation.status).toBe("insufficient");
    expect(c.recommendation.verdicts[0].caveat).toContain("不足以判断");
  });

  it("只有参数的机型：不生成口碑判断", () => {
    const c = cmp("demo-alpha", "demo-gamma", { prefs: ["camera"] });
    expect(c.b.state).toBe("specs_only");
    expect(c.recommendation.verdicts[0].side).toBe("unknown");
  });

  it("只有评论的机型：硬件判断受限", () => {
    const c = cmp("demo-delta", "demo-alpha", { prefs: ["handling"] }, "all");
    expect(c.a.state).toBe("reviews_only");
    expect(c.specRows.find((r) => r.field === "weight_g")?.a.missing).toBe(true);
    expect(c.recommendation.status).not.toBe("prefer_b");
  });

  it("两者都没有数据：证据不足，并提供下一步", () => {
    const c = cmp("demo-alpha", "xiaomi-17-256", { prefs: ["battery"] });
    expect(c.b.state).toBe("none");
    expect(c.recommendation.status).toBe("insufficient");
    expect(c.recommendation.summary.map((s) => s.text).join("")).toContain("导入");
  });

  it("真实候选机型没有任何被补齐的参数值", () => {
    for (const s of dataset.specs.filter((x) => x.data_kind === "real")) {
      expect(s.value).toBeNull();
      expect(s.missing_reason).not.toBeNull();
    }
    expect(dataset.prices.filter((p) => p.data_kind === "real")).toHaveLength(0);
    expect(dataset.reviews.filter((r) => r.data_kind === "real")).toHaveLength(0);
  });

  it("同一机型或未知机型返回错误，不做相似名称替换", () => {
    expect(buildComparison(dataset, "demo-alpha", "demo-alpha", needs({}))).toEqual({ error: "same_phone" });
    expect(buildComparison(dataset, "demo-alpha", "iphone-99", needs({}))).toMatchObject({ error: "unknown_phone" });
  });
});

describe("价格口径", () => {
  const ph = (id: string, storage = "256GB"): PhoneRecord => ({ id, brand: "x", model: id, aliases: [], region: "", storage, ram: null, sale_status: "demo", verified_at: null, data_kind: "demo", note: "" });
  const pr = (phone_id: string, amount: number, price_type: PriceRecord["price_type"], storage = "256GB"): PriceRecord => ({
    id: `price:${phone_id}`, phone_id, storage, amount, currency: "CNY", price_type, channel: "", conditions: null, recorded_at: "2026-11-01", source_id: null, data_kind: "demo",
  });
  it("价格类型不同、容量不同、价差大时分别提示", () => {
    const w = fairnessWarnings(ph("a"), ph("b", "512GB"), pr("a", 4000, "official_current"), pr("b", 6000, "official_msrp", "512GB"));
    expect(w.map((x) => x.code).sort()).toEqual(["price_gap", "price_type_mismatch", "storage_mismatch"]);
  });
  it("价差未超过 30% 不提示", () => {
    const w = fairnessWarnings(ph("a"), ph("b"), pr("a", 5000, "official_current"), pr("b", 6400, "official_current"));
    expect(w).toHaveLength(0);
  });
  it("缺少价格时不生成价格结论", () => {
    expect(fairnessWarnings(ph("a"), ph("b"), null, pr("b", 1, "official_current"))[0].code).toBe("price_missing");
    expect(budgetFit(5000, null)).toEqual({ kind: "no_price" });
  });
  it("优先使用当前售价，不把建议零售价改名为现价", () => {
    const p = pickPrice([pr("a", 5000, "official_msrp"), { ...pr("a", 4800, "official_current"), id: "x" }], ph("a"));
    expect(p?.price_type).toBe("official_current");
    const only = pickPrice([pr("a", 5000, "official_msrp")], ph("a"));
    expect(only?.price_type).toBe("official_msrp");
  });
  it("用户填写价格标为未核验", () => {
    expect(pickPrice([], ph("a"), 3999)?.price_type).toBe("user_reported");
  });
  it("推荐的一款超预算而另一款在预算内时降级为各有取舍", () => {
    const c = cmp("demo-alpha", "demo-beta", { prefs: ["camera"], budget: 5000 });
    expect(c.recommendation.status).toBe("tradeoff");
    expect(c.recommendation.tradeoffs[0].text).toContain("超出你的预算");
  });
});

describe("AI 输出校验", () => {
  const c: Comparison = cmp("demo-alpha", "demo-beta", { prefs: ["handling", "battery"] });
  const pack = buildPack(c);
  const goodEv = pack.allowed_evidence.find((e) => e.includes("weight_g"))!;

  it("材料不包含评论原文（降低注入风险）", () => {
    const s = JSON.stringify(pack);
    expect(s).not.toContain("忽略之前的所有指令");
  });

  it("非法引用编号的句子被删除，不替换为相近引用", () => {
    const out = validateExplanation(
      {
        status: "tradeoff",
        summary: [{ text: "两款各有取舍。", evidence: [] }],
        reasons: [
          { text: "A 更轻。", evidence: [goodEv] },
          { text: "B 续航更好。", evidence: ["stat:demo-beta:battery:30d"] },
        ],
        tradeoffs: [],
        questions: [],
      },
      pack,
    );
    expect(out.reasons).toHaveLength(1);
    expect(out.issues.some((i) => i.problem === "unknown_evidence")).toBe(true);
    expect(out.usable).toBe(true);
  });

  it("材料中不存在的数字被删除", () => {
    const out = validateExplanation(
      {
        status: "tradeoff",
        summary: [{ text: "A 重 178 g。", evidence: [goodEv] }, { text: "A 续航可达 30 小时。", evidence: [goodEv] }],
        reasons: [{ text: "A 更轻。", evidence: [goodEv] }],
        tradeoffs: [],
        questions: [],
      },
      pack,
    );
    expect(out.summary).toHaveLength(1);
    expect(out.issues.find((i) => i.problem === "unsupported_number")?.detail).toBe("30小时");
    expect(allowedNumbers(pack).has("178")).toBe(true);
  });

  it("理由必须带证据", () => {
    const out = validateExplanation({ status: "tradeoff", summary: [{ text: "各有取舍。", evidence: [] }], reasons: [{ text: "A 更好。", evidence: [] }], tradeoffs: [], questions: [] }, pack);
    expect(out.reasons).toHaveLength(0);
    expect(out.usable).toBe(false);
  });

  it("不得比基础模式更激进或翻转方向", () => {
    expect(statusAllowed("tradeoff", "prefer_a")).toBe(false);
    expect(statusAllowed("prefer_a", "prefer_b")).toBe(false);
    expect(statusAllowed("prefer_a", "insufficient")).toBe(true);
    const out = validateExplanation({ status: "prefer_a", summary: [{ text: "推荐 A。", evidence: [goodEv] }], reasons: [{ text: "A 更轻。", evidence: [goodEv] }], tradeoffs: [], questions: [] }, pack);
    expect(out.status).toBe("tradeoff");
    expect(out.issues[0].problem).toBe("status_upgrade");
  });

  it("结构不合法时不可用", () => {
    expect(validateExplanation({ hello: 1 }, pack).usable).toBe(false);
    expect(validateExplanation("not json", pack).usable).toBe(false);
  });
});

describe("缓存键", () => {
  const base = {
    a: "demo-alpha", b: "demo-beta", storage: ["256GB", "256GB"] as [string, string], priceVersion: "p1", dataVersion: "d1", labelVersion: "l1",
    window: "90d", prefs: ["handling", "battery"], budget: 6000, device: null, eco: ["mac", "ipad"], promptVersion: "r1", model: "m",
  };
  it("偏好、顺序、数据、标签、价格、提示词、模型、样本筛选任一变化都使缓存失效", () => {
    const k = cacheKey(base);
    expect(cacheKey({ ...base, prefs: ["battery", "handling"] })).not.toBe(k);
    expect(cacheKey({ ...base, prefs: ["handling"] })).not.toBe(k);
    expect(cacheKey({ ...base, dataVersion: "d2" })).not.toBe(k);
    expect(cacheKey({ ...base, labelVersion: "l2" })).not.toBe(k);
    expect(cacheKey({ ...base, priceVersion: "p2" })).not.toBe(k);
    expect(cacheKey({ ...base, promptVersion: "r2" })).not.toBe(k);
    expect(cacheKey({ ...base, model: "m2" })).not.toBe(k);
    expect(cacheKey({ ...base, window: "all" })).not.toBe(k);
    expect(cacheKey({ ...base, budget: 5000 })).not.toBe(k);
    expect(cacheKey({ ...base, storage: ["256GB", "512GB"] })).not.toBe(k);
  });
  it("配套设备顺序不影响缓存键", () => {
    expect(cacheKey({ ...base, eco: ["ipad", "mac"] })).toBe(cacheKey(base));
  });
});
