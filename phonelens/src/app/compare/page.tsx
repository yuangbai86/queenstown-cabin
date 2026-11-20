import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/data";
import { buildComparison } from "@/lib/recommend/compare";
import { needsOf, parseCompareParams } from "@/lib/query";
import { aiUnavailableReason, readAiConfig, UNAVAILABLE_TEXT } from "@/lib/ai/config";
import { ResultView } from "@/components/result/ResultView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "对比结果 · PhoneLens" };

type SP = Promise<Record<string, string | string[] | undefined>>;

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <section className="card empty-state enter">
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/">
          返回选择机型
        </Link>
        <Link className="btn" href="/data">
          查看已收录目录
        </Link>
        <Link className="btn btn-ghost" href="/import">
          导入自己的评论
        </Link>
      </div>
    </section>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const parsed = parseCompareParams(sp);
  if (!parsed.ok) {
    return <Empty title="对比条件不完整" body="需要从目录中选择两款手机，并至少选择一项偏好。请返回首页重新设置。" />;
  }
  const c = buildComparison(dataset, parsed.input.a, parsed.input.b, needsOf(parsed.input), parsed.input.window);
  if ("error" in c) {
    if (c.error === "same_phone") return <Empty title="两款机型相同" body="请选择两款不同的手机进行对比。" />;
    return <Empty title="暂未收录该机型" body="链接中的机型不在当前目录里。我们不会自动替换为名称相近的机型，你可以从目录中重新选择。" />;
  }
  const cfg = readAiConfig();
  const reason = aiUnavailableReason(cfg);
  const sourceNames = Object.fromEntries(dataset.sources.map((s) => [s.id, s.name]));
  return (
    <ResultView
      key={`${c.a.id}:${c.b.id}`}
      initial={c}
      aiInitial={{ available: reason === null, reason: reason ? UNAVAILABLE_TEXT[reason].replace(/，?以下为基础模式结果。$/, "") : null }}
      sourceNames={sourceNames}
    />
  );
}
