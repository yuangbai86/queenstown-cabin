import type { Metadata } from "next";
import { catalog, dataset } from "@/lib/data";
import { ImportForm } from "@/components/ImportForm";

export const metadata: Metadata = { title: "导入评论 · PhoneLens" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ImportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.name) ? sp.name[0] : sp.name;
  const name = (raw ?? "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 40);
  return (
    <>
      <h1 className="page-title enter">导入你自己的评论</h1>
      <p className="page-lead enter" style={{ ["--i" as string]: 1 }}>
        这是一个次要入口：为已收录机型补充你有权使用的评论，或为目录外机型生成一份口碑摘要。导入结果只在本次页面中显示，不进入公共数据。
      </p>
      <ImportForm catalog={catalog(dataset)} initialName={name} />
    </>
  );
}
