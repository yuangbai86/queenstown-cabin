/**
 * 用户评论导入：CSV 与粘贴文本。错误定位到行号；超限时提示，不静默截断。
 * 必填：phone_id,text,source_label；可选：review_id,review_date,system_version,source_url
 */

export const IMPORT_LIMITS = { maxRows: 40, maxChars: 800, maxTotal: 12000 };

export interface ImportRow {
  line: number;
  review_id: string;
  phone_id: string;
  text: string;
  source_label: string;
  review_date: string | null;
  system_version: string | null;
  source_url: string | null;
}

export interface ImportError {
  line: number | null;
  message: string;
}

/** RFC 4180 风格解析，支持引号、转义引号和字段内换行；返回每行起始行号 */
export function parseCsv(input: string): { rows: string[][]; lines: number[]; error?: ImportError } {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field.length > 0) return { rows, lines, error: { line, message: "引号位置不正确：引号需包住整个字段" } };
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) {
        rows.push(row);
        lines.push(rowStart);
      }
      row = [];
      line++;
      rowStart = line;
    } else field += ch;
  }
  if (inQuotes) return { rows, lines, error: { line: rowStart, message: "引号没有闭合" } };
  row.push(field);
  if (row.some((c) => c.trim() !== "")) {
    rows.push(row);
    lines.push(rowStart);
  }
  return { rows, lines };
}

const REQUIRED = ["phone_id", "text", "source_label"] as const;
const OPTIONAL = ["review_id", "review_date", "system_version", "source_url"] as const;

export function safeUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function checkLimits(rows: ImportRow[], errors: ImportError[]) {
  if (rows.length > IMPORT_LIMITS.maxRows) {
    errors.push({ line: null, message: `共 ${rows.length} 条，超过单次上限 ${IMPORT_LIMITS.maxRows} 条，请分批导入。` });
  }
  let total = 0;
  for (const r of rows) {
    total += r.text.length;
    if (r.text.length > IMPORT_LIMITS.maxChars) {
      errors.push({ line: r.line, message: `第 ${r.line} 行评论有 ${r.text.length} 个字符，超过单条上限 ${IMPORT_LIMITS.maxChars}。` });
    }
  }
  if (total > IMPORT_LIMITS.maxTotal) {
    errors.push({ line: null, message: `文本总长 ${total} 个字符，超过上限 ${IMPORT_LIMITS.maxTotal}，请缩减范围或分批。` });
  }
}

export function parseImportCsv(input: string, allowedPhoneIds: Set<string> | null): { rows: ImportRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const { rows, lines, error } = parseCsv(input);
  if (error) return { rows: [], errors: [error] };
  if (rows.length === 0) return { rows: [], errors: [{ line: null, message: "文件为空" }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  for (const r of REQUIRED) if (!header.includes(r)) errors.push({ line: 1, message: `表头缺少必填字段 ${r}` });
  const unknown = header.filter((h) => h && !(REQUIRED as readonly string[]).includes(h) && !(OPTIONAL as readonly string[]).includes(h));
  if (unknown.length) errors.push({ line: 1, message: `表头包含无法识别的字段：${unknown.join("、")}` });
  if (errors.length) return { rows: [], errors };

  const idx = (k: string) => header.indexOf(k);
  const out: ImportRow[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const line = lines[i + 1];
    if (cells.length !== header.length) {
      errors.push({ line, message: `第 ${line} 行有 ${cells.length} 列，表头是 ${header.length} 列` });
      return;
    }
    const get = (k: string) => (idx(k) >= 0 ? cells[idx(k)].trim() : "");
    const phone_id = get("phone_id");
    const text = get("text");
    const source_label = get("source_label");
    if (!phone_id) errors.push({ line, message: `第 ${line} 行缺少 phone_id` });
    else if (allowedPhoneIds && !allowedPhoneIds.has(phone_id)) errors.push({ line, message: `第 ${line} 行的 phone_id「${phone_id.slice(0, 40)}」与所选机型不一致` });
    if (!text) errors.push({ line, message: `第 ${line} 行缺少评论文本 text` });
    if (!source_label) errors.push({ line, message: `第 ${line} 行缺少来源说明 source_label` });
    const date = get("review_date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({ line, message: `第 ${line} 行日期格式应为 YYYY-MM-DD` });
    const urlRaw = get("source_url");
    const url = urlRaw ? safeUrl(urlRaw) : null;
    if (urlRaw && !url) errors.push({ line, message: `第 ${line} 行链接只接受 http 或 https` });
    let review_id = get("review_id") || `u-${String(i + 1).padStart(3, "0")}`;
    if (!/^[\w-]{1,40}$/.test(review_id)) {
      errors.push({ line, message: `第 ${line} 行 review_id 只能包含字母、数字、下划线和连字符` });
      review_id = `u-${i + 1}`;
    }
    if (ids.has(review_id)) errors.push({ line, message: `第 ${line} 行 review_id 重复` });
    ids.add(review_id);
    out.push({ line, review_id, phone_id, text, source_label, review_date: date || null, system_version: get("system_version") || null, source_url: url });
  });
  checkLimits(out, errors);
  return { rows: out, errors };
}

/** 粘贴：每行一条评论 */
export function parsePasted(input: string, phoneId: string, sourceLabel: string): { rows: ImportRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const rows: ImportRow[] = [];
  input.split(/\r?\n/).forEach((t, i) => {
    const text = t.trim();
    if (!text) return;
    rows.push({ line: i + 1, review_id: `p-${String(rows.length + 1).padStart(3, "0")}`, phone_id: phoneId, text, source_label: sourceLabel || "用户粘贴", review_date: null, system_version: null, source_url: null });
  });
  if (rows.length === 0) errors.push({ line: null, message: "没有可导入的文本，请每行粘贴一条评论。" });
  checkLimits(rows, errors);
  return { rows, errors };
}

export const CSV_TEMPLATE = `phone_id,text,source_label,review_id,review_date,system_version,source_url
demo-alpha,"拍照很好，但玩游戏容易热。",我自己的使用记录,my-001,2026-11-01,,
demo-alpha,"续航一般，下午需要充电。",朋友授权提供,my-002,,,
`;
