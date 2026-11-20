"use client";
import type { Comparison } from "@/lib/recommend/compare";
import type { Verdict } from "@/lib/recommend/engine";
import { PREFERENCE_LABEL } from "@/lib/labels";
import { EvidenceButton } from "../EvidenceDrawer";
import { KindTag, SideTag } from "../Badges";
import { IconChevron, IconInfo } from "../Icons";

function kindsOf(ids: string[]): ("fact" | "review")[] {
  const out = new Set<"fact" | "review">();
  for (const id of ids) {
    if (id.startsWith("spec:") || id.startsWith("price:")) out.add("fact");
    else out.add("review");
  }
  return [...out];
}

function VerdictPill({ v }: { v: Verdict }) {
  if (v.side === "a" || v.side === "b")
    return (
      <span className={`verdict-pill ${v.side}`}>
        <SideTag side={v.side} /> {v.strength === "strong" ? "较明确占优" : "略占优"}
      </span>
    );
  if (v.side === "even") return <span className="verdict-pill">＝ 差异不明显</span>;
  return <span className="verdict-pill unknown">？ 证据不足</span>;
}

function VerdictCard({ v, order }: { v: Verdict; order?: "首要" | "其次" }) {
  return (
    <article className="card verdict">
      <div className="verdict-head">
        <h3>
          {PREFERENCE_LABEL[v.pref]}
          {order && <span className={`badge ${order === "首要" ? "badge-blue" : "badge-outline"}`}>{order}</span>}
        </h3>
        <VerdictPill v={v} />
      </div>
      <ul className="claim-list">
        {v.claims.map((cl, i) => (
          <li key={i}>
            {kindsOf(cl.evidence).map((k) => (
              <KindTag key={k} kind={k} />
            ))}{" "}
            {cl.text} <EvidenceButton ids={cl.evidence} title={`${PREFERENCE_LABEL[v.pref]} · 依据`} />
          </li>
        ))}
      </ul>
      {v.caveat && (
        <p className="caveat">
          <IconInfo size={14} /> {v.caveat}
        </p>
      )}
    </article>
  );
}

export function Differences({ c, updating }: { c: Comparison; updating: boolean }) {
  const rec = c.recommendation;
  return (
    <div className={updating ? "is-updating" : undefined} style={{ position: "relative" }}>
      <div className="update-veil" aria-hidden={!updating} style={{ borderRadius: 16 }}>
        <span className="label">
          <span className="spinner" aria-hidden="true" /> 更新中
        </span>
      </div>
      <div className={`verdict-grid${rec.verdicts.length === 1 ? " single" : ""}`}>
        {rec.verdicts.map((v, i) => (
          <div key={v.pref} className="enter" style={{ ["--i" as string]: i }}>
            <VerdictCard v={v} order={i === 0 ? "首要" : "其次"} />
          </div>
        ))}
      </div>
      <details className="more">
        <summary>
          <IconChevron className="chev" /> 其他方面的差异（{rec.otherVerdicts.length} 项，未计入你的偏好）
        </summary>
        <div className="more-body verdict-grid" style={{ marginTop: 10 }}>
          {rec.otherVerdicts.map((v) => (
            <VerdictCard key={v.pref} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}
