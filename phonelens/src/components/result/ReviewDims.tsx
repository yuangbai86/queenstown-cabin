"use client";
import { useRef, useState } from "react";
import type { Comparison, StatsSummary } from "@/lib/recommend/compare";
import type { Dimension, Preference, SampleWindow } from "@/lib/types";
import { DIMENSIONS } from "@/lib/types";
import { DIMENSION_LABEL, DIMENSION_SCOPE, SENTIMENT_LABEL, SENTIMENT_SYMBOL } from "@/lib/labels";
import { EvidenceButton } from "../EvidenceDrawer";
import { shortName } from "@/lib/recommend/brief";
import { IconAlert } from "../Icons";
import { Tip } from "../Tip";

const PREF_DIM: Record<Preference, Dimension[]> = {
  camera: ["camera"],
  battery: ["battery"],
  handling: ["handling"],
  gaming: ["smoothness", "heat"],
  ecosystem: ["stability"],
};

function Bars({ s, dim }: { s: StatsSummary; dim: Dimension }) {
  const d = s.dims[dim];
  const rows = (["pos", "neg", "mixed", "neu"] as const).map((k) => ({ k, n: d[k] }));
  return (
    <ul className="bar-list" aria-label={`${DIMENSION_LABEL[dim]}情绪分布`}>
      {rows.map((r, i) => (
        <li key={r.k} className="bar-row">
          <span className="bar-label">
            <span className={`sym ${r.k}`} aria-hidden="true">
              {SENTIMENT_SYMBOL[r.k]}
            </span>
            {SENTIMENT_LABEL[r.k]}
          </span>
          <span className="bar-track" aria-hidden="true">
            {r.n > 0 && <span className={`bar-fill ${r.k}`} style={{ width: `${(r.n / s.n) * 100}%`, display: "block", ["--i" as string]: i }} />}
          </span>
          <span className="bar-num">
            {r.n} / {s.n} 条
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  c: Comparison;
  onWindow: (w: SampleWindow) => void;
  updating: boolean;
}

export function ReviewDims({ c, onWindow, updating }: Props) {
  const prefDims = c.needs.prefs.flatMap((p) => PREF_DIM[p]);
  const [dim, setDim] = useState<Dimension>(prefDims[0] ?? "battery");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const anyReviews = c.stats.a.n_total > 0 || c.stats.b.n_total > 0;

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % DIMENSIONS.length;
    if (e.key === "ArrowLeft") next = (i - 1 + DIMENSIONS.length) % DIMENSIONS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = DIMENSIONS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setDim(DIMENSIONS[next]);
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <>
      <div className="review-toolbar">
        <span className="small muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          样本反馈，分母为已分析的有效评论
          <Tip text="每条评论可以同时属于多个维度，因此各维度数量相加可能超过分母。待分析、待复核的评论不进入分母。" label="统计口径说明" />
        </span>
        <div className="window-switch" role="group" aria-label="样本时间范围">
          <button type="button" aria-pressed={c.window === "90d"} onClick={() => onWindow("90d")} disabled={updating}>
            最近九十天
          </button>
          <button type="button" aria-pressed={c.window === "all"} onClick={() => onWindow("all")} disabled={updating}>
            全部样本
          </button>
        </div>
      </div>

      {!c.comparability.comparable && anyReviews && (
        <p className="notice notice-warn" style={{ marginBottom: 12 }}>
          <IconAlert className="icon" /> 样本口径不同：{c.comparability.reasons.join("；")}。可以分别查看，但不据此比较两款优劣。
        </p>
      )}
      {(c.coverageHint.a || c.coverageHint.b) && (
        <p className="notice notice-info" style={{ marginBottom: 12 }}>
          最近九十天的样本较少，可以切换到“全部样本”查看更多，但会包含较旧的评论。
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="口碑维度">
        {DIMENSIONS.map((d, i) => (
          <button
            key={d}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${d}`}
            aria-selected={dim === d}
            aria-controls="dim-panel"
            tabIndex={dim === d ? 0 : -1}
            className="tab"
            onClick={() => setDim(d)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {DIMENSION_LABEL[d]}
            {prefDims.includes(d) && (
              <>
                <span className="pref-dot" aria-hidden="true" />
                <span className="sr-only">（与你的偏好相关）</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div id="dim-panel" role="tabpanel" aria-labelledby={`tab-${dim}`} className={`dim-panel${updating ? " is-updating" : ""}`} style={{ position: "relative" }}>
        <div className="update-veil" aria-hidden={!updating}>
          <span className="label">
            <span className="spinner" aria-hidden="true" /> 正在按新的样本范围重新统计
          </span>
        </div>
        <div key={`${dim}:${c.window}`} className="fade-swap">
          <p className="dim-scope">
            统计范围：{DIMENSION_SCOPE[dim].allowed}。不能据此推出：{DIMENSION_SCOPE[dim].not}。
          </p>
          <div className="dim-sides">
            {(["a", "b"] as const).map((s) => {
              const st = c.stats[s];
              const d = st.dims[dim];
              const statId = `stat:${c[s].id}:${dim}:${c.window}`;
              return (
                <section key={s} className="dim-side" aria-label={`${c[s].name} 的${DIMENSION_LABEL[dim]}反馈`}>
                  <h4>{shortName(c, s)}</h4>
                  {st.n === 0 ? (
                    <p className="dim-empty">
                      {st.n_total === 0
                        ? "尚未收录评论，不生成口碑判断。"
                        : `当前筛选下没有已分析的有效评论（已收录 ${st.n_total} 条）。${c.window === "90d" ? "可以切换到“全部样本”。" : ""}`}
                    </p>
                  ) : (
                    <>
                      <p className="dim-mention">
                        提到{DIMENSION_LABEL[dim]}：<strong>{d.mentions}</strong> / {st.n} 条已分析评论
                      </p>
                      <Bars s={st} dim={dim} />
                      <div className="dim-foot">
                        <span>
                          明确负面 {d.neg} 条，褒贬混合 {d.mixed} 条，分开统计
                        </span>
                        {d.mentions > 0 && (
                          <EvidenceButton ids={[statId]} title={`${c[s].name} · ${DIMENSION_LABEL[dim]}`} label={`查看这 ${d.mentions} 条评论`} />
                        )}
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
