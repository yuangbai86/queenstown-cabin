"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comparison } from "@/lib/recommend/compare";
import type { ExplainResponse } from "@/lib/recommend/service";
import type { SampleWindow } from "@/lib/types";
import { PRICE_TYPE_LABEL } from "@/lib/labels";
import { toSearch } from "@/lib/query";
import { EvidenceButton, EvidenceProvider } from "../EvidenceDrawer";
import { DataKindBadge, SaleBadge, SideTag } from "../Badges";
import { IconAlert, IconBack, IconFlask } from "../Icons";
import { NeedsFields, budgetError, type NeedsState } from "../NeedsFields";
import { saveForm } from "../CompareForm";
import { useToast } from "../Toast";
import { RecommendationCard, type AiState } from "./Recommendation";
import { Differences } from "./Differences";
import { SpecTable } from "./SpecTable";
import { ReviewDims } from "./ReviewDims";
import { SampleNotes } from "./SampleNotes";

const SECTIONS = [
  { id: "advice", label: "建议与取舍" },
  { id: "diffs", label: "与你有关的差异" },
  { id: "specs", label: "核心参数" },
  { id: "reviews", label: "口碑维度" },
  { id: "samples", label: "样本说明" },
];

function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav className="section-nav" aria-label="结果页章节">
      <ol>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(s.id);
                if (!el) return;
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                history.replaceState(null, "", `#${s.id}`);
                setActive(s.id);
                el.querySelector<HTMLElement>("h2")?.setAttribute("tabindex", "-1");
                el.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
              }}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PriceLine({ c, side }: { c: Comparison; side: "a" | "b" }) {
  const p = c[side].price;
  if (!p) return <span className="small muted">暂无价格记录</span>;
  return (
    <span className="small">
      <strong>¥{p.amount.toLocaleString("zh-CN")}</strong> · {PRICE_TYPE_LABEL[p.price_type]} · {p.storage} · {p.recorded_at} 记录
      {p.conditions ? ` · ${p.conditions}` : ""} <EvidenceButton ids={[p.evidence_id]} title={`${c[side].name} · 价格`} label="来源" />
    </span>
  );
}

interface Props {
  initial: Comparison;
  aiInitial: { available: boolean; reason: string | null };
  sourceNames: Record<string, string>;
}

export function ResultView({ initial, aiInitial, sourceNames }: Props) {
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [ai, setAi] = useState<AiState>(aiInitial.available ? { state: "loading" } : { state: "off", reason: aiInitial.reason });
  const [showBaseline, setShowBaseline] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState<null | "prefs" | "window">(null);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<NeedsState>({
    budget: initial.needs.budget ? String(initial.needs.budget) : "",
    prefs: initial.needs.prefs,
    device: initial.needs.device,
    eco: initial.needs.eco,
  });
  const [draftErr, setDraftErr] = useState<{ budget?: string | null; prefs?: string | null }>({});
  const editBtnRef = useRef<HTMLButtonElement>(null);

  const input = useMemo(
    () => ({ a: c.a.id, b: c.b.id, budget: c.needs.budget, prefs: c.needs.prefs, device: c.needs.device, eco: c.needs.eco, window: c.window }),
    [c],
  );
  const key = JSON.stringify(input);

  // 个性化解释：每次输入变化都重新请求；旧请求作废，避免旧理由与新数据混在一起
  useEffect(() => {
    if (!aiInitial.available) return;
    const ctrl = new AbortController();
    setAi({ state: "loading" });
    setShowBaseline(false);
    fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as ExplainResponse;
      })
      .then((res) => {
        if (res.mode === "ai") setAi({ state: "done", data: res });
        else setAi({ state: "fallback", message: res.message, retryable: res.retryable });
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setAi({ state: "fallback", message: "个性化解释请求失败，已保留基础模式结果。", retryable: true });
      });
    return () => ctrl.abort();
  }, [key, aiInitial.available, retry]);

  const refetch = useCallback(
    async (next: typeof input, kind: "prefs" | "window") => {
      setUpdating(kind);
      setUpdateFailed(false);
      try {
        const r = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as Comparison;
        if (!data || !("recommendation" in data)) throw new Error("bad");
        setC(data);
        history.replaceState(null, "", `/compare?${toSearch(next)}${location.hash}`);
        if (kind === "prefs") {
          saveForm({ a: next.a, b: next.b, budget: next.budget ? String(next.budget) : "", prefs: next.prefs, device: next.device, eco: next.eco });
          toast("已按新的偏好更新建议");
        }
        return true;
      } catch {
        setUpdateFailed(true);
        return false;
      } finally {
        setUpdating(null);
      }
    },
    [toast],
  );

  const applyPrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = { budget: budgetError(draft.budget), prefs: draft.prefs.length ? null : "请至少选择一项。" };
    setDraftErr(errs);
    if (errs.budget || errs.prefs) return;
    const ok = await refetch({ ...input, budget: draft.budget ? Number(draft.budget) : null, prefs: draft.prefs, device: draft.device, eco: draft.eco }, "prefs");
    if (ok) {
      setEditOpen(false);
      editBtnRef.current?.focus({ preventScroll: true });
    }
  };

  const warnings = c.warnings;
  const sideNotices = (["a", "b"] as const)
    .map((s) => {
      const st = c[s].state;
      if (st === "specs_only") return `${s.toUpperCase()}（${c[s].name}）只有参数，没有已收录的评论，不生成口碑判断。`;
      if (st === "reviews_only") return `${s.toUpperCase()}（${c[s].name}）只有评论，参数尚未核验，涉及硬件规格的判断会受限。`;
      if (st === "none") return `${s.toUpperCase()}（${c[s].name}）的参数与评论都还没有收录。`;
      return null;
    })
    .filter(Boolean) as string[];

  return (
    <EvidenceProvider evidence={c.evidence}>
      <div className="result-head enter" style={{ ["--i" as string]: 0 }}>
        <div>
          <div className="vs-line">
            <span className="vs-item">
              <SideTag side="a" /> {c.a.name}
            </span>
            <span className="vs">对比</span>
            <span className="vs-item">
              <SideTag side="b" /> {c.b.name}
            </span>
          </div>
          <div className="small muted" style={{ marginTop: 4, display: "grid", gap: 2 }}>
            {(["a", "b"] as const).map((s) => (
              <span key={s} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <SideTag side={s} /> {c[s].region} · {c[s].storage}
                <DataKindBadge kind={c[s].data_kind} /> <SaleBadge status={c[s].sale_status} /> <PriceLine c={c} side={s} />
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn-sm" href="/">
            <IconBack /> 重新选择机型
          </Link>
          <button
            ref={editBtnRef}
            type="button"
            className="btn btn-sm btn-primary"
            aria-expanded={editOpen}
            aria-controls="prefs-panel"
            onClick={() => setEditOpen((o) => !o)}
          >
            {editOpen ? "收起偏好设置" : "修改偏好"}
          </button>
        </div>
      </div>

      <div id="prefs-panel" className="prefs-panel" data-open={editOpen ? "true" : "false"}>
        <div className="inner" inert={!editOpen}>
          <form className="card content" onSubmit={applyPrefs} noValidate aria-label="修改偏好">
            <NeedsFields value={draft} onChange={setDraft} errors={draftErr} idPrefix="edit" />
            <div className="submit-row" style={{ marginTop: 18 }}>
              <button type="submit" className="btn btn-primary" disabled={updating !== null} aria-busy={updating === "prefs"}>
                <span className="btn-stack">
                  <span style={{ visibility: updating === "prefs" ? "hidden" : "visible" }}>更新建议</span>
                  <span style={{ visibility: updating === "prefs" ? "visible" : "hidden" }} aria-hidden={updating !== "prefs"}>
                    <span className="spinner" aria-hidden="true" /> 正在更新
                  </span>
                </span>
              </button>
              <span className="small muted" aria-live="polite">
                {updateFailed ? "更新失败，页面仍显示之前偏好的结果，可以再试一次。" : "当前阅读位置和已有资料会保留，新建议通过校验后才替换。"}
              </span>
            </div>
          </form>
        </div>
      </div>

      <SectionNav />

      {(c.demo || warnings.length > 0 || sideNotices.length > 0) && (
        <div className="warn-list">
          {c.demo && (
            <p className="notice notice-demo enter" style={{ ["--i" as string]: 1 }}>
              <IconFlask className="icon" /> 本次对比包含演示机型：参数、价格与评论均为开发者编写的虚构内容，只用于体验流程，不代表真实产品。
            </p>
          )}
          {warnings.map((w) => (
            <p key={w.code} className="notice notice-warn enter" style={{ ["--i" as string]: 1 }}>
              <IconAlert className="icon" /> {w.text}
            </p>
          ))}
          {sideNotices.map((t) => (
            <p key={t} className="notice notice-info enter" style={{ ["--i" as string]: 1 }}>
              <IconAlert className="icon" /> {t}
            </p>
          ))}
        </div>
      )}

      <section id="advice" className="result-section enter" style={{ ["--i" as string]: 1, marginTop: 0 }} aria-labelledby="advice-h">
        <div className="section-title">
          <h2 id="advice-h">建议与取舍</h2>
        </div>
        <RecommendationCard
          c={c}
          ai={ai}
          showBaseline={showBaseline}
          onToggleBaseline={() => setShowBaseline((v) => !v)}
          onRetry={() => setRetry((n) => n + 1)}
          updating={updating === "prefs"}
          updateFailed={updateFailed}
        />
      </section>

      <section id="diffs" className="result-section enter" style={{ ["--i" as string]: 2 }} aria-labelledby="diffs-h">
        <div className="section-title">
          <h2 id="diffs-h">与你有关的差异</h2>
        </div>
        <Differences c={c} updating={updating === "prefs"} />
      </section>

      <section id="specs" className="result-section enter" style={{ ["--i" as string]: 3 }} aria-label="核心参数">
        <SpecTable c={c} />
      </section>

      <section id="reviews" className="result-section enter" style={{ ["--i" as string]: 4 }} aria-label="口碑维度">
        <ReviewDims c={c} updating={updating === "window"} onWindow={(w: SampleWindow) => w !== c.window && refetch({ ...input, window: w }, "window")} />
      </section>

      <section id="samples" className="result-section enter" style={{ ["--i" as string]: 5 }} aria-labelledby="samples-h">
        <div className="section-title">
          <h2 id="samples-h">样本说明</h2>
        </div>
        <SampleNotes c={c} sourceNames={sourceNames} />
        <p className="small muted" style={{ marginTop: 14 }}>
          数据版本 {c.versions.data} · 标注版本 {c.versions.labels} · 价格版本 {c.versions.prices} · 整理日期 {c.versions.as_of}
        </p>
      </section>
    </EvidenceProvider>
  );
}
