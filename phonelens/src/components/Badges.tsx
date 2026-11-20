import type { DataKind } from "@/lib/types";
import { IconFlask } from "./Icons";

export function DataKindBadge({ kind }: { kind: DataKind }) {
  if (kind === "demo")
    return (
      <span className="badge badge-demo">
        <IconFlask /> 演示数据
      </span>
    );
  if (kind === "user") return <span className="badge badge-outline">用户提供，未核验</span>;
  return <span className="badge badge-outline">真实机型</span>;
}



/** 内容类型标签：事实 / 评论反馈 / 推荐 */
export function KindTag({ kind }: { kind: "fact" | "review" | "rec" }) {
  const text = kind === "fact" ? "事实" : kind === "review" ? "评论反馈" : "推荐";
  return <span className={`badge badge-${kind}`}>{text}</span>;
}
