"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/lib/data";
import { toSearch } from "@/lib/query";
import { PhonePicker } from "./PhonePicker";
import { NeedsFields, budgetError, type NeedsState } from "./NeedsFields";
import { IconSwap } from "./Icons";
import { useToast } from "./Toast";

const KEY = "pl:form:v1";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface FormState extends NeedsState {
  a: string | null;
  b: string | null;
}

const EMPTY: FormState = { a: null, b: null, budget: "", prefs: [], device: null, eco: [] };

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
    const prev = loadSavedForm() ?? EMPTY;
    sessionStorage.setItem(KEY, JSON.stringify({ ...prev, ...s }));
  } catch {
    /* 隐私模式下忽略 */
  }
}

export function CompareForm({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{ a?: string | null; b?: string | null; budget?: string | null; prefs?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(0);
  const [restored, setRestored] = useState(false);
  const aRef = useRef<HTMLInputElement>(null);
  const bRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const prefRef = useRef<HTMLDivElement>(null);

  // 返回首页时恢复已填写内容（在绘制前完成，避免闪烁）
  useIsoLayoutEffect(() => {
    const saved = loadSavedForm();
    if (saved) {
      const valid = (id: string | null) => (id && catalog.some((p) => p.id === id) ? id : null);
      setS({ ...saved, a: valid(saved.a), b: valid(saved.b) });
    }
    setRestored(true);
    try {
      sessionStorage.setItem("pl:visited", "1");
    } catch {}
    document.documentElement.classList.add("returning");
  }, []);

  useEffect(() => {
    if (restored) saveForm(s);
  }, [s, restored]);

  // bfcache 返回时解除加载状态
  useEffect(() => {
    const onShow = () => setBusy(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const update = (patch: Partial<FormState>) => {
    setErrors((e) => ({
      ...e,
      a: "a" in patch && patch.a !== s.a ? null : e.a,
      b: "b" in patch && patch.b !== s.b ? null : e.b,
      budget: "budget" in patch && patch.budget !== s.budget ? null : e.budget,
      prefs: patch.prefs && patch.prefs.length > 0 ? null : e.prefs,
    }));
    setS((prev) => ({ ...prev, ...patch }));
  };

  const swap = () => {
    setS((prev) => ({ ...prev, a: prev.b, b: prev.a }));
    setTurn((t) => t + 1);
    toast("已交换手机 A 与手机 B");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {
      a: s.a ? null : "请从目录中选择手机 A。",
      b: s.b ? null : "请从目录中选择手机 B。",
      budget: budgetError(s.budget),
      prefs: s.prefs.length ? null : "请至少选择一项你最在意的方面。",
    };
    if (s.a && s.b && s.a === s.b) next.b = "两款不能相同，请换一款进行对比。";
    setErrors(next);
    const first = next.a ? aRef : next.b ? bRef : next.budget ? budgetRef : null;
    if (first) {
      first.current?.focus();
      return;
    }
    if (next.prefs) {
      prefRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    setBusy(true);
    const q = toSearch({ a: s.a!, b: s.b!, budget: s.budget ? Number(s.budget) : null, prefs: s.prefs, device: s.device, eco: s.eco });
    router.push(`/compare?${q}`);
  };

  return (
    <form className="compare-form card enter enter-once" style={{ ["--i" as string]: 2 }} onSubmit={submit} noValidate aria-label="对比设置">
      <fieldset className="form-section">
        <legend className="legend">选择两款手机</legend>
        <div className="pick-row">
          <PhonePicker side="a" catalog={catalog} value={s.a} otherId={s.b} onChange={(id) => update({ a: id })} error={errors.a} inputRef={aRef} />
          <div className="swap-wrap">
            <button type="button" className="swap-btn" onClick={swap} aria-label="交换手机 A 与手机 B" disabled={!s.a && !s.b}>
              <IconSwap style={{ transform: `rotate(${turn * 180}deg)` }} />
            </button>
          </div>
          <PhonePicker side="b" catalog={catalog} value={s.b} otherId={s.a} onChange={(id) => update({ b: id })} error={errors.b} inputRef={bRef} />
        </div>
      </fieldset>

      <div ref={prefRef}>
        <NeedsFields
          value={s}
          onChange={(v) => update({ budget: v.budget, prefs: v.prefs, device: v.device, eco: v.eco })}
          errors={{ budget: errors.budget, prefs: errors.prefs }}
          idPrefix="home"
          budgetRef={budgetRef}
        />
      </div>

      <div className="submit-row">
        <button type="submit" className="btn btn-primary btn-lg" aria-busy={busy} disabled={busy}>
          <span className="btn-stack">
            <span style={{ visibility: busy ? "hidden" : "visible" }}>开始对比</span>
            <span style={{ visibility: busy ? "visible" : "hidden" }} aria-hidden={!busy}>
              <span className="spinner" aria-hidden="true" /> 正在整理对比资料
            </span>
          </span>
        </button>
        <span className="muted small" aria-live="polite">
          {busy ? "已收到，正在整理两款手机的参数与评论统计。" : "无需登录；未配置模型时也能完成基础比较。"}
        </span>
      </div>
    </form>
  );
}
