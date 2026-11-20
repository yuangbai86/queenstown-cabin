"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EvidenceItem, EvidenceMap } from "@/lib/evidence";
import { DIMENSION_LABEL, SENTIMENT_SYMBOL } from "@/lib/labels";
import { IconClose, IconExternal, IconFlask } from "./Icons";
import { KindTag } from "./Badges";

interface OpenRequest {
  ids: string[];
  title: string;
  subtitle?: string;
}

interface Ctx {
  open: (req: OpenRequest, trigger: HTMLElement) => void;
  activeKey: string | null;
}

const EvidenceCtx = createContext<Ctx>({ open: () => {}, activeKey: null });

const keyOf = (ids: string[]) => ids.join("|");

/** 只接受 http / https 链接 */
function safeHref(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function EvidenceProvider({ evidence, children }: { evidence: EvidenceMap; children: React.ReactNode }) {
  const [req, setReq] = useState<OpenRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const scrollYRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  const open = useCallback((r: OpenRequest, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    scrollYRef.current = window.scrollY;
    setReq(r);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 打开：锁定背景、背景不可交互、焦点移入面板；关闭：恢复滚动位置并把焦点还给触发按钮
  useEffect(() => {
    const outside = [document.getElementById("main"), document.querySelector(".site-header"), document.querySelector(".site-footer")].filter(
      Boolean,
    ) as HTMLElement[];
    if (isOpen) {
      document.body.classList.add("scroll-locked");
      outside.forEach((el) => el.setAttribute("inert", ""));
      const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }), 20);
      return () => window.clearTimeout(t);
    }
    document.body.classList.remove("scroll-locked");
    outside.forEach((el) => el.removeAttribute("inert"));
    if (triggerRef.current) {
      if (Math.abs(window.scrollY - scrollYRef.current) > 1) window.scrollTo({ top: scrollYRef.current, behavior: "instant" as ScrollBehavior });
      const t = triggerRef.current;
      if (t.isConnected) t.focus({ preventScroll: true });
      triggerRef.current = null;
    }
  }, [isOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = [...panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.offsetParent !== null,
    );
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const ctx = useMemo(() => ({ open, activeKey: isOpen && req ? keyOf(req.ids) : null }), [open, isOpen, req]);

  return (
    <EvidenceCtx.Provider value={ctx}>
      {children}
      {mounted &&
        createPortal(
          <div className="drawer-root" data-open={isOpen ? "true" : "false"} aria-hidden={!isOpen}>
            <div className="drawer-overlay" onClick={close} />
            <div
              ref={panelRef}
              className="drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onKeyDown}
              tabIndex={-1}
            >
              <div className="drawer-header">
                <div>
                  <h2 id={titleId}>{req?.title ?? "依据"}</h2>
                  {req?.subtitle && <p className="sub">{req.subtitle}</p>}
                </div>
                <button type="button" className="close-btn" onClick={close} aria-label="关闭依据面板" data-autofocus>
                  <IconClose />
                </button>
              </div>
              <div className="drawer-body">{req && <EvidenceList ids={req.ids} evidence={evidence} />}</div>
            </div>
          </div>,
          document.body,
        )}
    </EvidenceCtx.Provider>
  );
}

export function useEvidence() {
  return useContext(EvidenceCtx);
}

export function EvidenceButton({ ids, title, subtitle, label = "查看依据" }: { ids: string[]; title: string; subtitle?: string; label?: string }) {
  const { open, activeKey } = useEvidence();
  if (ids.length === 0) return null;
  return (
    <button
      type="button"
      className="evidence-btn"
      aria-haspopup="dialog"
      aria-expanded={activeKey === keyOf(ids)}
      onClick={(e) => open({ ids, title, subtitle }, e.currentTarget)}
    >
      {label}
    </button>
  );
}

function SourceLine({ source }: { source: { name: string; url: string | null; verification: string } | null }) {
  if (!source) return <span>来源：未登记</span>;
  const href = safeHref(source.url);
  return (
    <span>
      来源：
      {href ? (
        <a className="ext-link" href={href} target="_blank" rel="noopener noreferrer nofollow">
          {source.name}
          <IconExternal />
          <span className="sr-only">（在新窗口打开外部网站）</span>
        </a>
      ) : (
        source.name
      )}
      （{source.verification}）
    </span>
  );
}

function Highlighted({ text, marks }: { text: string; marks: string[] }) {
  // 安全地高亮摘录：只做字符串切分，不插入 HTML
  const ranges: [number, number][] = [];
  for (const m of marks) {
    const i = m ? text.indexOf(m) : -1;
    if (i >= 0) ranges.push([i, i + m.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], k) => {
    if (s < pos) return;
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark key={k} style={{ background: "#fff1b8", borderRadius: 3, padding: "0 1px" }}>
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  parts.push(text.slice(pos));
  return <p className="review-text">{parts}</p>;
}

function ReviewCard({ item }: { item: Extract<EvidenceItem, { kind: "review" }> }) {
  return (
    <article className="ev-item">
      <h3>
        <KindTag kind="review" />
        <span className="ev-id">{item.id.replace("review:", "")}</span>
        {item.data_kind === "demo" && (
          <span className="badge badge-demo">
            <IconFlask /> 演示样本
          </span>
        )}
      </h3>
      {item.display === "none" ? (
        <p className="review-text muted">该来源不允许展示原文。</p>
      ) : (
        <Highlighted text={item.text} marks={item.labels.map((l) => l.excerpt)} />
      )}
      {item.labels.length > 0 ? (
        <div className="label-chips" aria-label="维度标签">
          {item.labels.map((l, i) => (
            <span key={i} className="label-chip">
              {l.dimension} · {l.sentiment}
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted">未进入维度统计</p>
      )}
      <div className="ev-meta" style={{ marginTop: 8 }}>
        <span>评论时间：{item.review_date ?? "未知"}</span>
        <span>系统版本：{item.system_version ?? "未知（不推断为最新系统）"}</span>
        <SourceLine source={item.source} />
      </div>
    </article>
  );
}

const SENT_FILTERS = [
  ["all", "全部"],
  ["neg", "负面"],
  ["mixed", "褒贬混合"],
  ["pos", "正面"],
  ["neu", "中性"],
] as const;

function StatCard({ item, evidence }: { item: Extract<EvidenceItem, { kind: "stat" }>; evidence: EvidenceMap }) {
  const [filter, setFilter] = useState<(typeof SENT_FILTERS)[number][0]>("all");
  const reviews = item.review_ids
    .map((id) => evidence[`review:${id}`])
    .filter((x): x is Extract<EvidenceItem, { kind: "review" }> => !!x && x.kind === "review");
  const dimLabel = DIMENSION_LABEL[item.dimension];
  const sentOf = (r: Extract<EvidenceItem, { kind: "review" }>) => r.labels.find((l) => l.dimension === dimLabel)?.sentiment;
  const map: Record<string, string> = { neg: "负面", mixed: "褒贬混合", pos: "正面", neu: "中性" };
  const shown = filter === "all" ? reviews : reviews.filter((r) => sentOf(r) === map[filter]);
  return (
    <>
      <article className="ev-item">
        <h3>
          <KindTag kind="review" /> {item.title}
          {item.data_kind === "demo" && (
            <span className="badge badge-demo">
              <IconFlask /> 演示样本
            </span>
          )}
        </h3>
        <p className="ev-value">
          {item.mentions} / {item.n} <span className="small muted" style={{ fontWeight: 400 }}>条已分析评论提到{dimLabel}</span>
        </p>
        <div className="ev-meta">
          <span>
            {SENTIMENT_SYMBOL.pos} 正面 {item.pos} 条 · {SENTIMENT_SYMBOL.neg} 负面 {item.neg} 条 · {SENTIMENT_SYMBOL.mixed} 褒贬混合 {item.mixed} 条 ·{" "}
            {SENTIMENT_SYMBOL.neu} 中性 {item.neu} 条
          </span>
          <span>筛选条件：{item.filter_text}</span>
          <span>分母为已完成分析且通过校验的有效评论；待分析、待复核样本不计入，也不视为“未提及”。</span>
          <span className="ev-id">{item.id}</span>
        </div>
      </article>
      {reviews.length > 0 && (
        <>
          <div className="filter-row" role="group" aria-label="按情绪筛选评论">
            {SENT_FILTERS.map(([k, label]) => (
              <button key={k} type="button" className="tab" aria-pressed={filter === k} aria-selected={filter === k} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          <div key={filter} className="stack fade-swap">
            {shown.length === 0 ? <p className="muted small">这一类没有评论。</p> : shown.map((r) => <ReviewCard key={r.id} item={r} />)}
          </div>
        </>
      )}
    </>
  );
}

function EvidenceList({ ids, evidence }: { ids: string[]; evidence: EvidenceMap }) {
  const items = ids.map((id) => [id, evidence[id]] as const);
  return (
    <>
      {items.map(([id, item]) => {
        if (!item) {
          return (
            <article key={id} className="ev-item">
              <h3>未找到该依据</h3>
              <p className="small muted">编号 {id} 不在当前数据版本中，相关结论不会展示。</p>
            </article>
          );
        }
        if (item.kind === "stat") return <StatCard key={id} item={item} evidence={evidence} />;
        if (item.kind === "review") return <ReviewCard key={id} item={item} />;
        if (item.kind === "price") {
          return (
            <article key={id} className="ev-item">
              <h3>
                <KindTag kind="fact" /> {item.title}
                {item.data_kind === "demo" && (
                  <span className="badge badge-demo">
                    <IconFlask /> 演示数据
                  </span>
                )}
              </h3>
              <p className="ev-value">{item.value}</p>
              <div className="ev-meta">
                <span>价格类型：{item.price_type}</span>
                <span>
                  存储：{item.storage} · 渠道：{item.channel}
                </span>
                <span>适用条件：{item.conditions ?? "未注明"}</span>
                <span>记录日期：{item.recorded_at}</span>
                <SourceLine source={item.source} />
                <span className="ev-id">{item.id}</span>
              </div>
            </article>
          );
        }
        return (
          <article key={id} className="ev-item">
            <h3>
              <KindTag kind="fact" /> {item.title}
              {item.data_kind === "demo" && (
                <span className="badge badge-demo">
                  <IconFlask /> 演示数据
                </span>
              )}
            </h3>
            <p className={`ev-value${item.missing_reason ? " missing" : ""}`}>{item.value}</p>
            <div className="ev-meta">
              <span>{item.data_kind === "demo" ? `记录日期：${item.verified_at ?? "—"}（演示夹具，未经核验）` : `核验日期：${item.verified_at ?? "尚未核验"}`}</span>
              <SourceLine source={item.source} />
              {item.caution && <span>注意：{item.caution}</span>}
              <span className="ev-id">{item.id}</span>
            </div>
          </article>
        );
      })}
    </>
  );
}
