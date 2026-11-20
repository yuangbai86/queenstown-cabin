"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/lib/data";
import type { Preference } from "@/lib/types";
import { EXAMPLE, toSearch } from "@/lib/query";
import { DeviceArt } from "./DeviceArt";
import { NeedChips } from "./NeedChips";
import { Collapse, useDisclosure } from "./Disclosure";
import { IconSwap } from "./Icons";
import { useToast } from "./Toast";

const KEY = "pl:form:v2";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface FormState {
  a: string | null;
  b: string | null;
  prefs: Preference[];
  budget: string;
}
const EMPTY: FormState = { a: null, b: null, prefs: [], budget: "" };

export function loadSavedForm(): FormState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as FormState) } : null;
  } catch {
    return null;
  }
}
export function saveForm(s: Partial<FormState>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...(loadSavedForm() ?? EMPTY), ...s }));
  } catch {
    /* 隐私模式下忽略 */
  }
}

export function budgetError(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return "请输入整数金额，或留空。";
  const n = Number(t);
  if (n < 500 || n > 50000) return "预算请填写 500 至 50000 元。";
  return null;
}

export function displayName(p: CatalogItem) {
  if (p.data_kind === "demo") return p.model;
  return /^[\d\s]+$/.test(p.model) ? `${p.brand} ${p.model}` : p.model;
}

function Picker({
  side,
  catalog,
  value,
  other,
  onChange,
  error,
  selectRef,
}: {
  side: "a" | "b";
  catalog: CatalogItem[];
  value: string | null;
  other: string | null;
  onChange: (id: string | null) => void;
  error: string | null;
  selectRef: React.Ref<HTMLSelectElement>;
}) {
  const id = useId();
  const sel = catalog.find((p) => p.id === value) ?? null;
  const demo = catalog.filter((p) => p.data_kind === "demo");
  const real = catalog.filter((p) => p.data_kind !== "demo");
  const opt = (p: CatalogItem) => (
    <option key={p.id} value={p.id} disabled={p.id === other}>
      {displayName(p)}
      {p.id === other ? "（已选）" : ""}
    </option>
  );
  return (
    <div className="picker">
      <DeviceArt id={value} />
      <div className="picker-select-wrap">
        <label htmlFor={id} className="sr-only">
          第{side === "a" ? "一" : "二"}款手机
        </label>
        <select
          ref={selectRef}
          id={id}
          className={`picker-select${sel ? "" : " placeholder"}`}
          value={value ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">选择机型</option>
          <optgroup label="演示机型（虚构）">{demo.map(opt)}</optgroup>
          <optgroup label="真实机型（数据待核验）">{real.map(opt)}</optgroup>
        </select>
        <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="picker-meta" key={value ?? "none"}>
        <span className="fade-swap" style={{ display: "inline-block" }}>
          {sel ? (
            <>
              {sel.region.replace("（演示）", "")} · {sel.storage}
              {!sel.has_specs && sel.review_count === 0 && <span className="flag"> · 数据待收录</span>}
            </>
          ) : (
            " "
          )}
        </span>
      </p>
      <p className="field-msg" id={`${id}-msg`} aria-live="polite">
        {error ?? ""}
      </p>
    </div>
  );
}

export function HomeForm({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<FormState>(EMPTY);
  const [err, setErr] = useState<{ a: string | null; b: string | null; budget: string | null }>({ a: null, b: null, budget: null });
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(0);
  const [restored, setRestored] = useState(false);
  const more = useDisclosure(false);
  const needsLabel = useId();
  const aRef = useRef<HTMLSelectElement>(null);
  const bRef = useRef<HTMLSelectElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);

  // 返回首页时恢复已填写内容（绘制前完成），并跳过入场动画
  useIsoLayoutEffect(() => {
    const saved = loadSavedForm();
    if (saved) {
      const ok = (id: string | null) => (id && catalog.some((p) => p.id === id) ? id : null);
      setS({ ...saved, a: ok(saved.a), b: ok(saved.b) });
      if (saved.budget) more.setOpen(true);
    }
    setRestored(true);
    try {
      sessionStorage.setItem("pl:visited", "1");
    } catch {}
    document.documentElement.classList.add("returning");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (restored) saveForm(s);
  }, [s, restored]);
  useEffect(() => {
    const onShow = () => setBusy(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const set = (patch: Partial<FormState>) => {
    setS((p) => ({ ...p, ...patch }));
    setErr((e) => ({ a: "a" in patch ? null : e.a, b: "b" in patch ? null : e.b, budget: "budget" in patch ? null : e.budget }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next = {
      a: s.a ? null : "请选择机型",
      b: s.b ? null : "请选择机型",
      budget: budgetError(s.budget),
    };
    setErr(next);
    if (next.a) return aRef.current?.focus();
    if (next.b) return bRef.current?.focus();
    if (next.budget) {
      more.setOpen(true);
      return requestAnimationFrame(() => budgetRef.current?.focus());
    }
    setBusy(true);
    router.push(`/compare?${toSearch({ a: s.a!, b: s.b!, budget: s.budget ? Number(s.budget) : null, prefs: s.prefs, device: null, eco: [] })}`);
  };

  return (
    <form className="home-form enter enter-once" style={{ ["--i" as string]: 2 }} onSubmit={submit} noValidate aria-label="选择两款手机">
      <div className="pickers">
        <Picker side="a" catalog={catalog} value={s.a} other={s.b} onChange={(id) => set({ a: id })} error={err.a} selectRef={aRef} />
        <button
          type="button"
          className="swap-mini"
          aria-label="交换两款手机"
          disabled={!s.a && !s.b}
          onClick={() => {
            setS((p) => ({ ...p, a: p.b, b: p.a }));
            setTurn((t) => t + 1);
            toast("已交换两款手机");
          }}
        >
          <IconSwap size={16} style={{ transform: `rotate(${turn * 180}deg)` }} />
        </button>
        <Picker side="b" catalog={catalog} value={s.b} other={s.a} onChange={(id) => set({ b: id })} error={err.b} selectRef={bRef} />
      </div>

      <div className="needs">
        <p className="needs-label" id={needsLabel}>
          你更在意（可选，最多两项）
        </p>
        <NeedChips value={s.prefs} onChange={(prefs) => set({ prefs })} labelId={needsLabel} />
        <button type="button" className="disclosure-btn" aria-expanded={more.open} aria-controls={more.id} onClick={more.toggle}>
          更多偏好 <span className="plus" aria-hidden="true">+</span>
        </button>
        <Collapse open={more.open} id={more.id} label="更多偏好">
          <div className="budget-box">
            <label htmlFor="home-budget" className="muted small">
              预算
            </label>
            <div className="budget-input">
              <span className="prefix" aria-hidden="true">
                ¥
              </span>
              <input
                ref={budgetRef}
                id="home-budget"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="不限"
                value={s.budget}
                aria-invalid={err.budget ? true : undefined}
                aria-describedby="home-budget-msg"
                onChange={(e) => set({ budget: e.target.value.replace(/[,，\s元¥]/g, "") })}
              />
            </div>
          </div>
          <p className="field-msg" id="home-budget-msg" aria-live="polite">
            {err.budget ?? ""}
          </p>
        </Collapse>
      </div>

      <div className="cta">
        <button type="submit" className="btn btn-primary btn-lg" aria-busy={busy} disabled={busy}>
          <span className="btn-stack">
            <span style={{ visibility: busy ? "hidden" : "visible" }}>开始对比</span>
            <span style={{ visibility: busy ? "visible" : "hidden" }} aria-hidden={!busy}>
              <span className="spinner" aria-hidden="true" /> 正在整理
            </span>
          </span>
        </button>
        <Link className="link-btn" href={`/compare?${toSearch(EXAMPLE)}`}>
          看一个示例 ›
        </Link>
      </div>
    </form>
  );
}
