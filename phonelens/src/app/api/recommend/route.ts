import { NextResponse } from "next/server";
import { dataset } from "@/lib/data";
import { buildComparison } from "@/lib/recommend/compare";
import { explain } from "@/lib/recommend/service";
import { CompareInputSchema, needsOf } from "@/lib/query";
import { clientIp } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 个性化解释。只接受机型编号和偏好，服务端重新组装材料，不信任客户端传来的数据。
 * 失败时返回 mode=baseline 与原因，页面保留基础模式结果。
 */
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
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const c = buildComparison(dataset, parsed.data.a, parsed.data.b, needsOf(parsed.data), parsed.data.window);
  if ("error" in c) return NextResponse.json(c, { status: 404 });
  const res = await explain(c, { ip: clientIp(req.headers) });
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
