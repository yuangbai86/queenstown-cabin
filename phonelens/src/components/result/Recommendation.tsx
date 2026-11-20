"use client";
import type { Comparison } from "@/lib/recommend/compare";
import type { Claim } from "@/lib/recommend/engine";
import type { ExplainResponse } from "@/lib/recommend/service";
import type { RecStatus } from "@/lib/types";
import { REC_STATUS_LABEL } from "@/lib/labels";
import { EvidenceButton } from "../EvidenceDrawer";
import { KindTag, SideTag } from "../Badges";
import { IconAlert, IconFlask, IconRule, IconSpark } from "../Icons";

export type AiState =
  | { state: "off"; reason: string | null }
  | { state: "loading" }
  | { state: "done"; data: Extract<ExplainResponse, { mode: "ai" }> }
  | { state: "fallback"; message: string; retryable: boolean };

function StatusPill({ status }: { status: RecStatus }) {
  if (status === "prefer_a" || status === "prefer_b") {
    const side = status === "prefer_a" ? "a" : "b";
    return (
      <span className="status-pill prefer">
        <span aria-hidden="true">→</span> 更值得考虑 <SideTag side={side} />
      </span>
    );
  }
  if (status === "tradeoff")
    return (
      <span className="status-pill tradeoff">
        <span aria-hidden="true">⇄</span> {REC_STATUS_LABEL.tradeoff}
      </span>
    );
  return (
    <span className="status-pill insufficient">
      <span aria-hidden="true">…</span> {REC_STATUS_LABEL.insufficient}
    </span>
  );
}

function ClaimItems({ items, title }: { items: Claim[]; title: string }) {
  return (
    <>
      {items.map((c, i) => (
        <li key={i}>
          {c.text} <EvidenceButton ids={c.evidence} title={title} />
        </li>
      ))}
    </>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

interface Props {
  c: Comparison;
  ai: AiState;
  showBaseline: boolean;
  onToggleBaseline: () => void;
  onRetry: () => void;
  updating: boolean;
  updateFailed: boolean;
}

export function RecommendationCard({ c, ai, showBaseline, onToggleBaseline, onRetry, updating, updateFailed }: Props) {
  const base = c.recommendation;
  const useAi = ai.state === "done" && !showBaseline;
  const ex = ai.state === "done" ? ai.data.explanation : null;
  const status = useAi && ex ? ex.status : base.status;
  const summary = useAi && ex ? ex.summary : base.summary;
  const tradeoffs = useAi && ex && ex.tradeoffs.length ? ex.tradeoffs : base.tradeoffs;
  const questions = useAi && ex && ex.questions.length ? ex.questions : base.questions;
  const viewKey = `${useAi ? "ai" : "base"}:${status}:${summary.map((s) => s.text).join("|").length}`;

  return (
    <div className={`card rec-card${updating ? " is-updating" : ""}`} aria-busy={updating}>
      <div className="update-veil" aria-hidden={!updating}>
        <span className="label">
          <span className="spinner" aria-hidden="true" /> 正在按新偏好更新建议
        </span>
      </div>
      <div className="rec-top">
        <StatusPill status={status} />
        <div className="mode-line">
          <KindTag kind="rec" />
          {useAi && ai.state === "done" ? (
            ai.data.fixture ? (
              <span className="badge badge-demo">
                <IconFlask /> 测试夹具输出（非模型生成）
              </span>
            ) : (
              <span className="badge badge-blue">
                <IconSpark /> 本次 AI 生成 · 引用已校验
              </span>
            )
          ) : (
            <span className="badge">
              <IconRule /> 基础模式 · 规则生成
            </span>
          )}
          {useAi && ai.state === "done" && ai.data.cached && <span>缓存结果，生成于 {fmtTime(ai.data.generated_at)}</span>}
          {useAi && ai.state === "done" && !ai.data.cached && <span>生成于 {fmtTime(ai.data.generated_at)}</span>}
          {c.demo && (
            <span className="badge badge-demo">
              <IconFlask /> 基于演示数据
            </span>
          )}
        </div>
      </div>

      {updateFailed && (
        <p className="notice notice-error" style={{ marginBottom: 12 }}>
          <IconAlert className="icon" /> 尚未更新：新偏好的结果获取失败，下方仍是之前偏好的建议。
        </p>
      )}

      <div key={viewKey} className="fade-swap">
        <ul className="summary-list">
          {summary.map((s, i) => (
            <li key={i}>
              {s.text} <EvidenceButton ids={s.evidence} title="建议依据" />
            </li>
          ))}
        </ul>
      </div>

      <div className="ai-progress" aria-live="polite">
        {ai.state === "loading" && (
          <>
            <span className="spinner" aria-hidden="true" /> 正在生成个性化解释，完成并通过引用校验后替换上面的基础结果。
          </>
        )}
        {ai.state === "fallback" && (
          <>
            <IconAlert /> {ai.message}
            {ai.retryable && (
              <button type="button" className="btn btn-sm" onClick={onRetry}>
                重试
              </button>
            )}
          </>
        )}
        {ai.state === "off" && (
          <span className="muted">
            {ai.reason ?? "当前为基础模式"}：结论由参数记录与程序统计按固定规则得出，未使用模型。
          </span>
        )}
        {ai.state === "done" && (
          <>
            {ai.data.explanation.removed > 0 && !showBaseline && (
              <span className="muted">{ai.data.explanation.removed} 处未通过引用或数字校验的内容已删除。</span>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={onToggleBaseline}>
              {showBaseline ? "查看 AI 解释" : "对照基础模式结果"}
            </button>
          </>
        )}
      </div>

      <div className="rec-cols">
        <div className="col">
          <h3>需要接受的取舍</h3>
          {tradeoffs.length ? (
            <ul>
              <ClaimItems items={tradeoffs} title="取舍依据" />
            </ul>
          ) : (
            <p className="small muted">在已选偏好之外，没有发现被倾向一方明显落后的方面。</p>
          )}
        </div>
        <div className="col">
          <h3>证据不足之处</h3>
          {base.gaps.length ? (
            <ul>
              {base.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">所选偏好都有可引用的参数或评论统计。</p>
          )}
        </div>
        <div className="col">
          <h3>建议你确认</h3>
          {questions.length ? (
            <ul>
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">暂无。</p>
          )}
        </div>
      </div>
    </div>
  );
}
