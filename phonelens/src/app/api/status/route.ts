import { NextResponse } from "next/server";
import { aiUnavailableReason, readAiConfig } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

/** 只返回是否可用及原因，不暴露任何配置值 */
export async function GET() {
  const c = readAiConfig();
  const reason = aiUnavailableReason(c);
  return NextResponse.json({ ai: reason === null, reason, fixture: c.provider === "fixture" && reason === null });
}
