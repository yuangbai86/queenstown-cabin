import { describe, expect, it } from "vitest";
import { computeStats, compareSamples } from "@/lib/stats";
import { cleanReviews, validateLabels, similarity } from "@/lib/clean";
import type { AnalysisRecord, PhoneRecord, ReviewRecord, ReviewLabel } from "@/lib/types";

const phone: PhoneRecord = {
  id: "p1", brand: "测", model: "Alpha", aliases: ["alpha"], region: "演示", storage: "256GB", ram: null,
  sale_status: "demo", verified_at: null, data_kind: "demo", note: "",
};
const other: PhoneRecord = { ...phone, id: "p2", model: "Beta", aliases: ["beta"] };

function rv(id: string, text: string, date = "2026-11-01", v: string | null = "OS 1"): ReviewRecord {
  return { id, phone_id: "p1", text, source_id: "s1", review_date: date, collected_at: "2026-11-20", system_version: v, usage_scope: "", data_kind: "demo" };
}
function an(id: string, labels: Omit<ReviewLabel, "review_id" | "explanation">[], status: AnalysisRecord["status"] = "analyzed"): AnalysisRecord {
  return { review_id: id, status, labels: labels.map((l) => ({ ...l, review_id: id, explanation: "" })), labeler: "t", prompt_version: null, reviewed_by: null };
}
const run = (reviews: ReviewRecord[], analysis: AnalysisRecord[], window: "90d" | "all" = "all") =>
  computeStats({ phone, catalog: [phone, other], reviews, analysis, audit: [], asOf: "2026-11-20", window });

describe("多维计数与分母", () => {
  it("同一评论可计入多个维度，但同一维度只计一次", () => {
    const s = run(
      [rv("r1", "拍照很好，但玩游戏容易热。")],
      [an("r1", [
        { dimension: "camera", sentiment: "pos", excerpt: "拍照很好" },
        { dimension: "heat", sentiment: "neg", excerpt: "玩游戏容易热" },
        { dimension: "heat", sentiment: "neg", excerpt: "容易热" },
      ])],
    );
    expect(s.n).toBe(1);
    expect(s.dims.camera.mentions).toBe(1);
    expect(s.dims.heat.mentions).toBe(1);
    expect(s.dims.heat.neg).toBe(1);
    // 发热负面不会被推成流畅度
    expect(s.dims.smoothness.mentions).toBe(0);
    // 各维度提及之和可以超过 N
    const sum = Object.values(s.dims).reduce((a, d) => a + d.mentions, 0);
    expect(sum).toBeGreaterThan(s.n);
  });

  it("褒贬混合与明确负面分开统计", () => {
    const s = run(
      [rv("r1", "续航一般，重度用要充两次。"), rv("r2", "电池撑不到晚上，不过充电挺快。")],
      [an("r1", [{ dimension: "battery", sentiment: "neg", excerpt: "续航一般" }]), an("r2", [{ dimension: "battery", sentiment: "mixed", excerpt: "不过充电挺快" }])],
    );
    expect(s.dims.battery.neg).toBe(1);
    expect(s.dims.battery.mixed).toBe(1);
    expect(s.dims.battery.mentions).toBe(2);
  });

  it("待分析、待复核不进入分母，也不当成未提及", () => {
    const s = run(
      [rv("r1", "屏幕看着舒服，续航还行。"), rv("r2", "刚买还在适应中，暂时说不好。"), rv("r3", "手机还行吧，没什么特别感觉。")],
      [an("r1", [{ dimension: "battery", sentiment: "neu", excerpt: "续航还行" }]), an("r2", [], "pending"), an("r3", [], "needs_review")],
    );
    expect(s.n).toBe(1);
    expect(s.n_pending).toBe(1);
    expect(s.n_needs_review).toBe(1);
    expect(s.n_clean).toBe(3);
  });

  it("已分析但没有任何维度的评论进入分母", () => {
    const s = run([rv("r1", "整体用起来还可以，没有特别的地方。")], [an("r1", [])]);
    expect(s.n).toBe(1);
    expect(s.dims.battery.mentions).toBe(0);
  });

  it("只有购物体验的评论排除出性能统计，并记录原因", () => {
    const s = run([rv("r1", "快递第二天就到了，包装很严实。"), rv("r2", "续航很好，一天一充足够。")], [
      an("r1", [{ dimension: "shopping", sentiment: "pos", excerpt: "快递第二天就到了" }]),
      an("r2", [{ dimension: "battery", sentiment: "pos", excerpt: "一天一充足够" }]),
    ]);
    expect(s.n).toBe(1);
    expect(s.excluded.shopping_only).toBe(1);
    expect(s.shopping_mentions).toBe(1);
  });

  it("九十天窗口：旧样本与无日期样本不进入筛选", () => {
    const s = run(
      [rv("r1", "续航很好，一天一充足够。", "2026-11-01"), rv("r2", "续航差，下午就要充电了。", "2026-05-01"), rv("r3", "拍照清楚，色彩自然。", null as unknown as string)].map((r, i) =>
        i === 2 ? { ...r, review_date: null } : r,
      ),
      [
        an("r1", [{ dimension: "battery", sentiment: "pos", excerpt: "续航很好" }]),
        an("r2", [{ dimension: "battery", sentiment: "neg", excerpt: "续航差" }]),
        an("r3", [{ dimension: "camera", sentiment: "pos", excerpt: "拍照清楚" }]),
      ],
      "90d",
    );
    expect(s.n).toBe(1);
    expect(s.n_out_of_window).toBe(2);
    expect(s.n_undated).toBe(1);
    const all = run(
      [rv("r1", "续航很好，一天一充足够。", "2026-11-01"), rv("r2", "续航差，下午就要充电了。", "2026-05-01")],
      [an("r1", [{ dimension: "battery", sentiment: "pos", excerpt: "续航很好" }]), an("r2", [{ dimension: "battery", sentiment: "neg", excerpt: "续航差" }])],
    );
    expect(all.n).toBe(2);
    expect(all.older_than_window).toBe(1);
  });

  it("未知系统版本单独计数", () => {
    const s = run([rv("r1", "续航很好，一天一充足够。", "2026-11-01", null)], [an("r1", [{ dimension: "battery", sentiment: "pos", excerpt: "续航很好" }])]);
    expect(s.sysver_unknown).toBe(1);
    expect(s.sysver_known).toBe(0);
  });
});

describe("清洗：去重、机型混入、广告", () => {
  it("完全重复（忽略标点与空白）由程序排除并记录原因", () => {
    const s = run(
      [rv("r1", "拍照很好，但玩游戏容易热。"), rv("r2", "拍照很好 但玩游戏容易热")],
      [an("r1", [{ dimension: "camera", sentiment: "pos", excerpt: "拍照很好" }]), an("r2", [{ dimension: "camera", sentiment: "pos", excerpt: "拍照很好" }])],
    );
    expect(s.n).toBe(1);
    expect(s.excluded.duplicate).toBe(1);
    expect(s.dims.camera.mentions).toBe(1);
  });

  it("近似重复只标记待复核，不自动删除；人工审核后才排除", () => {
    const reviews = [rv("r1", "拍照很好，但玩游戏容易热。"), rv("r2", "拍照很好，但是玩游戏容易热！")];
    const c = cleanReviews(reviews, phone, [phone, other], []);
    expect(c[1].state).toMatchObject({ kind: "flagged", reason: "near_duplicate" });
    const c2 = cleanReviews(reviews, phone, [phone, other], [{ review_id: "r2", decision: "exclude", reason: "near_duplicate", note: "", reviewed_at: "x" }]);
    expect(c2[1].state).toMatchObject({ kind: "excluded", by: "audit" });
    expect(similarity("拍照很好，但玩游戏容易热。", "续航真的很强")).toBeLessThan(0.2);
  });

  it("提到其他机型的评论标记为疑似机型混入", () => {
    const c = cleanReviews([rv("r1", "这台 Beta 续航真的顶，两天一充。")], phone, [phone, other], []);
    expect(c[0].state).toMatchObject({ kind: "flagged", reason: "model_mismatch" });
    const ok = cleanReviews([rv("r1", "比我之前的 Beta 轻，Alpha 手感更好。")], phone, [phone, other], []);
    expect(ok[0].state.kind).toBe("clean");
  });

  it("广告与无使用内容被标记", () => {
    const c = cleanReviews([rv("r1", "加微信领优惠券，私聊发链接"), rv("r2", "好评。"), rv("r3", "很好很好很好很好")], phone, [phone, other], []);
    expect(c[0].flags.map((f) => f.reason)).toContain("ad");
    expect(c[1].flags.map((f) => f.reason)).toContain("no_usage_content");
    expect(c[2].flags.map((f) => f.reason)).toContain("no_usage_content");
  });
});

describe("标签校验", () => {
  const texts = new Map([["r1", "拍照很好，但玩游戏容易热。"]]);
  it("摘录必须来自原文，编号必须存在，维度和情绪必须合法", () => {
    const { valid, issues } = validateLabels(
      [
        { review_id: "r1", dimension: "camera", sentiment: "pos", excerpt: "拍照很好", explanation: "" },
        { review_id: "r1", dimension: "smoothness", sentiment: "neg", excerpt: "游戏卡顿", explanation: "" },
        { review_id: "r9", dimension: "heat", sentiment: "neg", excerpt: "热", explanation: "" },
        { review_id: "r1", dimension: "price", sentiment: "neg", excerpt: "热", explanation: "" },
        { review_id: "r1", dimension: "heat", sentiment: "angry", excerpt: "热", explanation: "" },
      ],
      texts,
    );
    expect(valid).toHaveLength(1);
    expect(issues.map((i) => i.problem).sort()).toEqual(["bad_dimension", "bad_sentiment", "excerpt_not_found", "unknown_review"].sort());
  });

  it("未通过校验的标签不进入统计", () => {
    const s = run([rv("r1", "拍照很好，但玩游戏容易热。")], [
      an("r1", [
        { dimension: "camera", sentiment: "pos", excerpt: "拍照很好" },
        { dimension: "smoothness", sentiment: "neg", excerpt: "游戏掉帧严重" },
      ]),
    ]);
    expect(s.dims.smoothness.mentions).toBe(0);
    expect(s.label_issues).toBe(1);
  });
});

describe("样本可比性", () => {
  it("样本过少时不可比", () => {
    const a = run([rv("r1", "续航很好，一天一充足够。")], [an("r1", [{ dimension: "battery", sentiment: "pos", excerpt: "续航很好" }])]);
    const r = compareSamples(a, a);
    expect(r.comparable).toBe(false);
    expect(r.reasons[0]).toContain("少于");
  });
});
