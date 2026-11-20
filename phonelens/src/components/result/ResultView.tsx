"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comparison } from "@/lib/recommend/compare";
import type { ExplainResponse } from "@/lib/recommend/service";
import type { Preference, SampleWindow } from "@/lib/types";
import { PREFERENCE_LABEL } from "@/lib/labels";
import { toSearch } from "@/lib/query";
import { buildBrief, shortName } from "@/lib/recommend/brief";
import { EvidenceButton, EvidenceProvider } from "../EvidenceDrawer";
import { DeviceArt } from "../DeviceArt";
import { NeedChips } from "../NeedChips";
import { Collapse, useDisclosure } from "../Disclosure";
import { budgetError, saveForm } from "../HomeForm";
import { useToast } from "../Toast";
import { SpecTable } from "./SpecTable";
import { ReviewDims } from "./ReviewDims";
import { SampleNotes } from "./SampleNotes";

type AiState =
  | { state: "off"; reason: string | null }
  | { state: "loading" }
  | { state: "done"; data: Extract<ExplainResponse, { mode: "ai" }> }
  | { state: "fallback"; message: string; retryable: boolean };

function priceText(c: Comparison, s: "a" | "b") {
  const p = c[s].price;
  if (!p) return null;
  const amount = `¥${p.amount.toLocaleString("zh-CN")}`;
  if (p.data_kind === "demo") return { label: "示例价", amount };
  if (p.price_type === "official_current") return { label: "官方售价", amount };
  if (p.price_type === "official_msrp") return { label: "建议零售价", amount };
  return { label: "你填写的价格", amount };
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function MoreGroup({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const d = useDisclosure(false);
  return (
    <div className="more-group">
      <h3>
        <button type="button" className="more-toggle" aria-expanded={d.open} aria-controls={d.id} onClick={d.toggle}>
          <span>
            {title}
            <span className="sub">{sub}</span>
          </span>
          <span className="plus" aria-hidden="true">
            +
          </span>
        </button>
      </h3>
      <Collapse open={d.open} id={d.id} label={title}>
        <div className="more-body">{children}</div>
      </Collapse>
    </div>
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
  const [updating, setUpdating] = useState<null | "prefs" | "window">(null);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [draftPrefs, setDraftPrefs] = useState<Preference[]>(initial.needs.prefs);
  const [draftBudget, setDraftBudget] = useState(initial.needs.budget ? String(initial.needs.budget) : "");
  const [budgetErr, setBudgetErr] = useState<string | null>(null);
  const adjust = useDisclosure(false);
  const why = useDisclosure(false);
  const adjustBtn = useRef<HTMLButtonElement>(null);

  const brief = useMemo(() => buildBrief(c), [c]);
  const n = { a: shortName(c, "a"), b: shortName(c, "b") };

  const input = useMemo(
    () => ({ a: c.a.id, b: c.b.id, budget: c.needs.budget, prefs: c.needs.prefs, device: c.needs.device, eco: c.needs.eco, window: c.window }),
    [c],
  );
  const key = JSON.stringify(input);

  // 个性化解释（仅在服务端启用时）：输入变化即作废旧请求
  useEffect(() => {
    if (!aiInitial.available || c.needs.prefs.length === 0) return;
    const ctrl = new AbortController();
    setAi({ state: "loading" });
    fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as ExplainResponse;
      })
      .then((res) => setAi(res.mode === "ai" ? { state: "done", data: res } : { state: "fallback", message: res.message, retryable: res.retryable }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setAi({ state: "fallback", message: "个性化解释请求失败，以上为规则结果。", retryable: true });
      });
    return () => ctrl.abort();
  }, [key, aiInitial.available, retry, c.needs.prefs.length]);

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
        history.replaceState(null, "", `/compare?${toSearch(next)}`);
        if (kind === "prefs") {
          saveForm({ a: next.a, b: next.b, budget: next.budget ? String(next.budget) : "", prefs: next.prefs });
          toast("已按新的需求更新");
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

  const applyAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const be = budgetError(draftBudget);
    setBudgetErr(be);
    if (be) return;
    const ok = await refetch({ ...input, prefs: draftPrefs, budget: draftBudget ? Number(draftBudget) : null }, "prefs");
    if (ok) {
      adjust.setOpen(false);
      adjustBtn.current?.focus({ preventScroll: true });
    }
  };

  const rec = c.recommendation;
  const sourceIds = [
    ...new Set([
      ...brief.headline.evidence,
      ...brief.reasons.flatMap((r) => r.evidence),
      ...(brief.tradeoff?.evidence ?? []),
      ...brief.rows.flatMap((r) => r.evidence),
    ]),
  ].filter((id) => id in c.evidence);
  const prefText = c.needs.prefs.map((p) => PREFERENCE_LABEL[p]).join("、");
  const prefer = rec.status === "prefer_a" || rec.status === "prefer_b";

  return (
    <EvidenceProvider evidence={c.evidence}>
      <h1 className="sr-only">
        {c.a.name} 与 {c.b.name} 对比
      </h1>

      <section className="product-head" aria-label="对比的两款手机">
        {(["a", "b"] as const).map((s, i) => {
          const pr = priceText(c, s);
          return (
            <div key={s} className="product enter" style={{ ["--i" as string]: i }}>
              <DeviceArt id={c[s].id} />
              <p className="model">{n[s]}</p>
              <p className="version">
                {c[s].region.replace("（演示）", "")} · {c[s].storage}
                {c[s].sale_status === "unverified" ? " · 销售状态待核验" : ""}
              </p>
              <p className="price">
                {pr ? (
                  <>
                    <span className="muted">{pr.label} </span>
                    {pr.amount}
                  </>
                ) : (
                  <span className="muted">暂无价格</span>
                )}
              </p>
            </div>
          );
        })}
      </section>

      {c.warnings.map((w) => (
        <p key={w.code} className="head-warn">
          {w.text}
        </p>
      ))}

      <div className="head-actions">
        <button ref={adjustBtn} type="button" className="link-btn" aria-expanded={adjust.open} aria-controls={adjust.id} onClick={adjust.toggle}>
          {prefText ? `需求：${prefText}` : "未选需求"}
          {c.needs.budget ? ` · 预算 ¥${c.needs.budget}` : ""} · 调整
        </button>
        <Link className="link-btn" href="/">
          换一组机型
        </Link>
      </div>
      <div className="adjust">
        <Collapse open={adjust.open} id={adjust.id} label="调整需求">
          <form onSubmit={applyAdjust} noValidate aria-label="调整需求">
            <p className="needs-label" id="adjust-needs">
              你更在意（可选，最多两项）
            </p>
            <NeedChips value={draftPrefs} onChange={setDraftPrefs} labelId="adjust-needs" />
            <div className="budget-box">
              <label htmlFor="adjust-budget" className="muted small">
                预算
              </label>
              <div className="budget-input">
                <span className="prefix" aria-hidden="true">
                  ¥
                </span>
                <input
                  id="adjust-budget"
                  className="input"
                  inputMode="numeric"
                  placeholder="不限"
                  value={draftBudget}
                  aria-invalid={budgetErr ? true : undefined}
                  aria-describedby="adjust-budget-msg"
                  onChange={(e) => {
                    setDraftBudget(e.target.value.replace(/[,，\s元¥]/g, ""));
                    setBudgetErr(null);
                  }}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={updating !== null} aria-busy={updating === "prefs"}>
                <span className="btn-stack">
                  <span style={{ visibility: updating === "prefs" ? "hidden" : "visible" }}>更新</span>
                  <span style={{ visibility: updating === "prefs" ? "visible" : "hidden" }} aria-hidden={updating !== "prefs"}>
                    <span className="spinner" aria-hidden="true" />
                  </span>
                </span>
              </button>
            </div>
            <p className="field-msg" id="adjust-budget-msg" aria-live="polite">
              {budgetErr ?? (updateFailed ? "更新失败，页面仍是之前需求的结果，可以再试一次。" : "")}
            </p>
          </form>
        </Collapse>
      </div>

      {/* 第一部分：适合你的选择 */}
      <section className="r-section enter" style={{ ["--i" as string]: 2 }} aria-labelledby="s-choice">
        <h2 id="s-choice">适合你的选择</h2>
        <div className={`verdict${updating === "prefs" ? " updating" : ""}`} aria-busy={updating === "prefs"}>
          <div className="veil" aria-hidden={updating !== "prefs"}>
            <span className="label">
              <span className="spinner" aria-hidden="true" /> 正在更新
            </span>
          </div>
          <div key={key} className="fade-swap">
            <p className={`eyebrow${prefer ? "" : " neutral"}`}>{brief.eyebrow}</p>
            <p className="headline">{brief.headline.text}</p>
            {brief.reasons.length > 0 && (
              <ul className="reason-list">
                {brief.reasons.map((r, i) => (
                  <li key={i}>
                    {r.text}
                    <EvidenceButton ids={r.evidence} title="依据" label="依据" />
                  </li>
                ))}
              </ul>
            )}
            {brief.tradeoff && (
              <p className="tradeoff-line">
                {brief.tradeoff.text}
                <EvidenceButton ids={brief.tradeoff.evidence} title="取舍依据" label="依据" />
              </p>
            )}
            {brief.missing && <p className="missing-line">{brief.missing}</p>}
            {updateFailed && <p className="missing-line">尚未更新：新需求的结果获取失败，这里仍是之前的结果。</p>}
          </div>

          <div className="why">
            <button type="button" className="disclosure-btn" aria-expanded={why.open} aria-controls={why.id} onClick={why.toggle}>
              为什么这样建议 <span className="plus" aria-hidden="true">+</span>
            </button>
            <Collapse open={why.open} id={why.id} label="为什么这样建议">
              <div className="why-body">
                {rec.objective ? (
                  <p>你没有选择在意的方面，所以这里不判断哪款更适合你，只在下方列出可核验的差异。</p>
                ) : (
                  rec.verdicts.map((v) => (
                    <div key={v.pref}>
                      <h3>{PREFERENCE_LABEL[v.pref]}</h3>
                      <ul>
                        {v.claims.map((cl, i) => (
                          <li key={i}>
                            {cl.text} <EvidenceButton ids={cl.evidence} title={`${PREFERENCE_LABEL[v.pref]} · 依据`} label="依据" />
                          </li>
                        ))}
                        {v.caveat && <li className="muted">{v.caveat}</li>}
                      </ul>
                    </div>
                  ))
                )}
                {rec.gaps.length > 0 && (
                  <div>
                    <h3>证据缺口</h3>
                    <ul>
                      {rec.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rec.questions.length > 0 && (
                  <div>
                    <h3>建议你确认</h3>
                    <ul>
                      {rec.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ai.state === "done" && (
                  <div>
                    <h3>{ai.data.fixture ? "个性化解释（本地测试夹具，非模型生成）" : "个性化解释（AI 生成，引用与数字已校验）"}</h3>
                    <ul>
                      {ai.data.explanation.summary.map((s, i) => (
                        <li key={i}>
                          {s.text} <EvidenceButton ids={s.evidence} title="依据" label="依据" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="method">
                  {ai.state === "done"
                    ? `结论按固定规则得出；个性化解释生成于 ${fmtTime(ai.data.generated_at)}${ai.data.cached ? "（缓存）" : ""}${
                        ai.data.explanation.removed ? `，${ai.data.explanation.removed} 处未通过校验的内容已删除` : ""
                      }。`
                    : ai.state === "loading"
                      ? "结论按固定规则得出；个性化解释正在生成，通过引用校验后显示在这里。"
                      : ai.state === "fallback"
                        ? `结论按固定规则得出。${ai.message}`
                        : "结论根据已记录的参数和样本统计按固定规则得出，没有使用模型。"}{" "}
                  {ai.state === "fallback" && ai.retryable && (
                    <button type="button" className="link-btn" onClick={() => setRetry((x) => x + 1)}>
                      重试
                    </button>
                  )}{" "}
                  <Link href="/data#method">了解方法</Link>
                </p>
              </div>
            </Collapse>
          </div>
        </div>
      </section>

      {/* 第二部分：关键差异 */}
      <section className="r-section enter" style={{ ["--i" as string]: 3 }} aria-labelledby="s-diff">
        <h2 id="s-diff">关键差异</h2>
        <div className="rows-head" aria-hidden="true">
          <span />
          <span>{n.a}</span>
          <span>{n.b}</span>
        </div>
        <div className="compare-rows" role="table" aria-label="关键差异">
          <div role="row" className="sr-only">
            <span role="columnheader">项目</span>
            <span role="columnheader">{n.a}</span>
            <span role="columnheader">{n.b}</span>
          </div>
          {brief.rows.map((r, i) => (
            <div key={`${key}:${r.key}`} className="crow fade-swap" role="row" style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}>
              <span className="crow-label" role="rowheader">
                {r.label}
                {r.kind === "reviews" && <span className="tag-soft">样本反馈</span>}
              </span>
              {(["a", "b"] as const).map((s) => (
                <span key={s} role="cell" className={`crow-val${r[s].missing ? " missing" : ""}`}>
                  <span className="who">{n[s]}</span>
                  {r[s].text}
                </span>
              ))}
              <span className="crow-note">
                {r.note && <span>{r.note}</span>}
                <EvidenceButton ids={r.evidence} title={r.label} label="来源" />
              </span>
            </div>
          ))}
          {brief.rows.length === 0 && <p className="spec-empty">两款都还没有可比较的已核验记录。</p>}
        </div>
        <div className="rows-foot">
          <EvidenceButton ids={sourceIds} title="来源与样本" subtitle="本页结论和关键差异引用的全部记录" label="查看来源与样本" />
        </div>
      </section>

      {/* 第三部分：参数和口碑（按需展开） */}
      <section className="r-section enter" style={{ ["--i" as string]: 4 }} aria-labelledby="s-more">
        <h2 id="s-more">参数和口碑</h2>
        <div className="more-groups">
          <MoreGroup title="完整参数" sub={`${c.specRows.length} 项规格，可只看差异，每项可查来源`}>
            <SpecTable c={c} />
          </MoreGroup>
          <MoreGroup title="口碑样本" sub="按维度查看条数和原文，分母可见">
            <ReviewDims c={c} updating={updating === "window"} onWindow={(w: SampleWindow) => w !== c.window && refetch({ ...input, window: w }, "window")} />
          </MoreGroup>
          <MoreGroup title="样本范围与局限" sub="数量、时间范围、系统版本和排除原因">
            <SampleNotes c={c} sourceNames={sourceNames} />
            <p className="small muted" style={{ marginTop: 14 }}>
              数据版本 {c.versions.data} · 标注版本 {c.versions.labels} · 价格版本 {c.versions.prices}
            </p>
          </MoreGroup>
        </div>
      </section>
    </EvidenceProvider>
  );
}
