import { describe, expect, it } from "vitest";
import { IMPORT_LIMITS, parseCsv, parseImportCsv, parsePasted, safeUrl } from "@/lib/csv";

describe("CSV 解析", () => {
  it("支持引号、逗号与字段内换行，并记录起始行号", () => {
    const r = parseCsv('a,b\n"x, y","多\n行"\nz,w\n');
    expect(r.rows).toEqual([["a", "b"], ["x, y", "多\n行"], ["z", "w"]]);
    expect(r.lines).toEqual([1, 2, 4]);
  });
  it("引号未闭合时报告行号", () => {
    expect(parseCsv('a,b\n"x,y\n').error?.line).toBe(2);
  });
});

describe("导入校验", () => {
  const ok = new Set(["demo-alpha"]);
  it("缺少必填表头时报错", () => {
    const r = parseImportCsv("phone_id,text\ndemo-alpha,好\n", ok);
    expect(r.errors[0].message).toContain("source_label");
  });
  it("逐行指出错误：机型不符、缺文本、日期格式、非 http 链接", () => {
    const csv = [
      "phone_id,text,source_label,review_date,source_url",
      "demo-beta,续航很好,我,,",
      "demo-alpha,,我,,",
      "demo-alpha,续航很好,我,2026/11/01,",
      "demo-alpha,续航很好,我,,javascript:alert(1)",
    ].join("\n");
    const r = parseImportCsv(csv, ok);
    const lines = r.errors.map((e) => e.line);
    expect(lines).toEqual([2, 3, 4, 5]);
    expect(r.errors[3].message).toContain("http");
  });
  it("列数不一致时报错", () => {
    const r = parseImportCsv("phone_id,text,source_label\ndemo-alpha,a,b,c\n", ok);
    expect(r.errors[0]).toMatchObject({ line: 2 });
  });
  it("超过条数、单条长度、总长度时提示，不静默截断", () => {
    const many = Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => `第${i}条：续航不错`).join("\n");
    expect(parsePasted(many, "demo-alpha", "").errors[0].message).toContain("超过单次上限");
    const long = "很".repeat(IMPORT_LIMITS.maxChars + 1);
    const r = parsePasted(long, "demo-alpha", "");
    expect(r.errors.some((e) => e.message.includes("单条上限"))).toBe(true);
    expect(r.rows[0].text.length).toBe(IMPORT_LIMITS.maxChars + 1);
    const total = Array.from({ length: 20 }, () => "好".repeat(700)).join("\n");
    expect(parsePasted(total, "demo-alpha", "").errors.some((e) => e.message.includes("总长"))).toBe(true);
  });
  it("只接受 http 与 https 链接", () => {
    expect(safeUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeUrl("ftp://a.com")).toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });
});
