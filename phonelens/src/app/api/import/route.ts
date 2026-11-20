import { NextResponse } from "next/server";
import { z } from "zod";
import { dataset, getPhone } from "@/lib/data";
import { parseImportCsv, parsePasted } from "@/lib/csv";
import { analyzeImport } from "@/lib/import/service";
import { clientIp } from "@/lib/ai/guard";
import type { PhoneRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  format: z.enum(["csv", "paste"]),
  content: z.string().max(40000),
  phone_id: z.string().max(64).nullable(),
  outside_name: z.string().max(40).nullable(),
  source_label: z.string().max(60).nullable(),
  consent: z.literal(true),
});

/**
 * 用户评论导入。内容仅在本次请求内处理：不持久化、不进入公共缓存、不记录原文日志。
 */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 60000) return NextResponse.json({ errors: [{ line: null, message: "提交内容过大，请分批导入。" }] }, { status: 413 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: [{ line: null, message: "请求格式错误" }] }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const consent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return NextResponse.json(
      { errors: [{ line: null, message: consent ? "请先确认你有权提交这些文本。" : "提交内容不完整或超出长度限制。" }] },
      { status: 400 },
    );
  }
  const b = parsed.data;
  let phone: PhoneRecord;
  let inCatalog = true;
  if (b.phone_id) {
    const p = getPhone(dataset, b.phone_id);
    if (!p) return NextResponse.json({ errors: [{ line: null, message: "所选机型不在目录中" }] }, { status: 400 });
    phone = p;
  } else {
    const name = (b.outside_name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim();
    if (!name) return NextResponse.json({ errors: [{ line: null, message: "请选择目录内机型，或填写目录外机型名称。" }] }, { status: 400 });
    inCatalog = false;
    phone = {
      id: "custom",
      brand: "",
      model: name,
      aliases: [],
      region: "未知",
      storage: "未知",
      ram: null,
      sale_status: "unverified",
      verified_at: null,
      data_kind: "user",
      note: "目录外机型，只生成口碑摘要",
    };
  }
  const { rows, errors } =
    b.format === "csv" ? parseImportCsv(b.content, new Set([phone.id])) : parsePasted(b.content, phone.id, b.source_label ?? "用户粘贴");
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  const result = await analyzeImport(rows, phone, inCatalog, dataset.phones, { ip: clientIp(req.headers) });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
