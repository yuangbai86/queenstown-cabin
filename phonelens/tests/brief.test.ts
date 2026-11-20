import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { buildComparison, type Comparison } from "@/lib/recommend/compare";
import { buildBrief, keyRows } from "@/lib/recommend/brief";
import { parseCompareParams } from "@/lib/query";
import type { Preference } from "@/lib/types";

const cmp = (a: string, b: string, prefs: Preference[], budget: number | null = null): Comparison => {
  const c = buildComparison(dataset, a, b, { budget, prefs, device: null, eco: [] }, "90d");
  if ("error" in c) throw new Error(c.error);
  return c;
};
const len = (s: string) => [...s].length;

const CASES: [string, string, Preference[], number | null][] = [
  ["demo-alpha", "demo-beta", ["handling", "battery"], 6000],
  ["demo-alpha", "demo-beta", ["battery"], null],
  ["demo-alpha", "demo-beta", ["handling"], null],
  ["demo-alpha", "demo-beta", ["camera"], 5000],
  ["demo-alpha", "demo-beta", [], null],
  ["demo-alpha", "demo-gamma", ["gaming"], null],
  ["demo-alpha", "xiaomi-17-256", ["battery"], null],
  ["demo-delta", "demo-alpha", ["handling"], null],
  ["demo-beta", "demo-epsilon", ["ecosystem", "camera"], null],
];

describe("结果摘要", () => {
  it("结论不超过 50 字，理由最多两条且不超过 40 字，最多一条取舍，每条带证据或为空证据的说明", () => {
    for (const [a, b, p, bud] of CASES) {
      const c = cmp(a, b, p, bud);
      const br = buildBrief(c);
      expect(len(br.headline.text), br.headline.text).toBeLessThanOrEqual(50);
      expect(br.reasons.length).toBeLessThanOrEqual(2);
      for (const r of br.reasons) {
        expect(len(r.text), r.text).toBeLessThanOrEqual(40);
        for (const id of r.evidence) expect(c.evidence[id], id).toBeDefined();
      }
      if (br.tradeoff) for (const id of br.tradeoff.evidence) expect(c.evidence[id], id).toBeDefined();
    }
  });

  it("未选需求：只做客观比较，不给胜者", () => {
    const c = cmp("demo-alpha", "demo-beta", []);
    expect(c.recommendation.objective).toBe(true);
    expect(c.recommendation.status).not.toMatch(/prefer/);
    const br = buildBrief(c);
    expect(br.eyebrow).toBe("客观比较");
    expect(br.reasons).toHaveLength(0);
    expect(br.rows.length).toBeGreaterThanOrEqual(3);
    expect(br.rows.every((r) => r.kind !== "reviews")).toBe(true);
  });

  it("URL 中不带偏好也能进入比较", () => {
    const r = parseCompareParams({ a: "demo-alpha", b: "demo-beta" });
    expect(r.ok).toBe(true);
  });

  it("证据不足时说明缺少什么，不拼凑推荐", () => {
    const br = buildBrief(cmp("demo-alpha", "demo-gamma", ["gaming"]));
    expect(br.eyebrow).toBe("证据不足");
    expect(br.missing).toContain("芯片");
    const none = buildBrief(cmp("demo-alpha", "xiaomi-17-256", ["battery"]));
    expect(none.headline.text).toContain("小米 17");
    expect(none.tradeoff).toBeNull();
  });

  it("只有评论倾向时，结论写成“略偏向”，取舍对应其他方面", () => {
    const br = buildBrief(cmp("demo-alpha", "demo-beta", ["battery"]));
    expect(br.eyebrow).toBe("各有取舍");
    expect(br.headline.text).toContain("略偏向 Beta");
    expect(br.tradeoff?.text).toContain("Alpha 更轻");
  });
});

describe("关键差异", () => {
  it("按偏好取 3–4 行，数值来自已有记录，评论行带分母", () => {
    const c = cmp("demo-alpha", "demo-beta", ["handling", "battery"]);
    const rows = keyRows(c);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.length).toBeLessThanOrEqual(4);
    expect(rows[0]).toMatchObject({ label: "重量", a: { text: "178 g" }, b: { text: "214 g" } });
    const rv = rows.find((r) => r.kind === "reviews")!;
    expect(rv.a.text).toMatch(/\/ \d+ 条$/);
    for (const r of rows) for (const id of r.evidence) expect(c.evidence[id], id).toBeDefined();
  });

  it("缺失值如实显示，不补齐", () => {
    const rows = keyRows(cmp("demo-alpha", "xiaomi-17-256", ["battery"]));
    const cap = rows.find((r) => r.label === "电池容量")!;
    expect(cap.b).toEqual({ text: "尚未核验", missing: true });
    expect(rows.find((r) => r.kind === "price")?.b).toEqual({ text: "暂无价格", missing: true });
  });
});
