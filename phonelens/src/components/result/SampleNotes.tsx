"use client";
import type { Comparison } from "@/lib/recommend/compare";
import { EXCLUSION_LABEL } from "@/lib/labels";
import type { ExclusionReason } from "@/lib/types";
import { SideTag, DataKindBadge } from "../Badges";

export function SampleNotes({ c, sourceNames }: { c: Comparison; sourceNames: Record<string, string> }) {
  return (
    <div className="sample-grid">
      {(["a", "b"] as const).map((s) => {
        const st = c.stats[s];
        const ex = Object.entries(st.excluded) as [ExclusionReason, number][];
        return (
          <article key={s} className="card sample-card">
            <h3>
              <SideTag side={s} /> {c[s].name} <DataKindBadge kind={c[s].data_kind} />
            </h3>
            <dl className="kv">
              <dt>已收录</dt>
              <dd>{st.n_total} 条</dd>
              <dt>当前筛选</dt>
              <dd>
                {c.window === "90d" ? `最近九十天（${st.window_start} 至 ${st.as_of}）` : "全部样本"}，{st.n_in_window} 条
              </dd>
              <dt>清洗排除</dt>
              <dd>
                {st.n_excluded} 条
                {ex.length > 0 && <span className="muted">（{ex.map(([k, v]) => `${EXCLUSION_LABEL[k]} ${v}`).join("、")}）</span>}
              </dd>
              <dt>待复核 / 待分析</dt>
              <dd>
                {st.n_flagged + st.n_needs_review} / {st.n_pending} 条
              </dd>
              <dt>已分析有效（N）</dt>
              <dd>
                <strong>{st.n} 条</strong>
              </dd>
              <dt>时间范围</dt>
              <dd>{st.date_min ? `${st.date_min} 至 ${st.date_max}` : "—"}</dd>
              <dt>系统版本</dt>
              <dd>
                已知 {st.sysver_known} 条，未知 {st.sysver_unknown} 条
                {Object.keys(st.sysver_versions).length > 0 && (
                  <span className="muted">
                    （{Object.entries(st.sysver_versions)
                      .sort((x, y) => y[1] - x[1])
                      .map(([v, n]) => `${v} ${n}`)
                      .join("、")}）
                  </span>
                )}
              </dd>
              <dt>来源</dt>
              <dd>{st.source_ids.length ? st.source_ids.map((id) => sourceNames[id] ?? id).join("、") : "—"}</dd>
            </dl>
            <ul className="note-list">
              {c.sampleNotes[s].map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
