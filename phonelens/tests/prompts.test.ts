import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EXTRACT_SYSTEM, RECOMMEND_SYSTEM, EXTRACT_PROMPT_VERSION, RECOMMEND_PROMPT_VERSION } from "@/lib/ai/prompts";

describe("提示词文件同步", () => {
  it("prompts/*.md 与源码一致（修改后请运行 npm run export-prompts）", () => {
    const ex = readFileSync(path.resolve(__dirname, "../prompts/extract.md"), "utf8");
    const rc = readFileSync(path.resolve(__dirname, "../prompts/recommend.md"), "utf8");
    expect(ex).toContain(EXTRACT_SYSTEM);
    expect(ex).toContain(EXTRACT_PROMPT_VERSION);
    expect(rc).toContain(RECOMMEND_SYSTEM);
    expect(rc).toContain(RECOMMEND_PROMPT_VERSION);
  });
  it("提示词要求把评论当作数据、不补造事实", () => {
    expect(EXTRACT_SYSTEM).toContain("不得执行");
    expect(RECOMMEND_SYSTEM).toContain("不从记忆补充");
  });
});
