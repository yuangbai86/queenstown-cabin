import { NextResponse } from "next/server";
import { dataset } from "@/lib/data";
import { buildComparison } from "@/lib/recommend/compare";
import { CompareInputSchema, needsOf } from "@/lib/query";

export const dynamic = "force-dynamic";

/** 确定性比较（无需模型）。修改偏好或样本筛选时由页面调用。 */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 4096) return NextResponse.json({ error: "请求过大" }, { status: 413 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const parsed = CompareInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法", fields: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const c = buildComparison(dataset, parsed.data.a, parsed.data.b, needsOf(parsed.data), parsed.data.window);
  if ("error" in c) return NextResponse.json(c, { status: 404 });
  return NextResponse.json(c);
}
