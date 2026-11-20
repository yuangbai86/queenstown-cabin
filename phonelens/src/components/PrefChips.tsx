"use client";
import { useEffect, useRef, useState } from "react";
import type { Preference } from "@/lib/types";
import { PREFERENCES } from "@/lib/types";
import { PREFERENCE_LABEL } from "@/lib/labels";
import { IconAlert, IconCheck, IconSwap } from "./Icons";

interface Props {
  value: Preference[];
  onChange: (v: Preference[]) => void;
  error?: string | null;
  idPrefix?: string;
}

export function PrefChips({ value, onChange, error, idPrefix = "pref" }: Props) {
  const [pending, setPending] = useState<Preference | null>(null);
  const [shake, setShake] = useState<Preference | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(null), 300);
    return () => window.clearTimeout(t);
  }, [shake]);

  const toggle = (p: Preference) => {
    if (value.includes(p)) {
      onChange(value.filter((x) => x !== p));
      setPending(null);
      return;
    }
    if (value.length >= 2) {
      setPending(p);
      setShake(p);
      return;
    }
    onChange([...value, p]);
    setPending(null);
  };

  return (
    <div>
      <div className="chips" role="group" aria-label="使用偏好，最多两项" aria-describedby={`${idPrefix}-hint`}>
        {PREFERENCES.map((p) => {
          const idx = value.indexOf(p);
          const on = idx >= 0;
          return (
            <button
              key={p}
              type="button"
              className={`chip${shake === p ? " shake" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(p)}
            >
              <span className="check" aria-hidden="true">
                <IconCheck />
              </span>
              {PREFERENCE_LABEL[p]}
              {on && <span className={`order${idx === 1 ? " second" : ""}`}>{idx === 0 ? "首要" : "其次"}</span>}
            </button>
          );
        })}
      </div>

      <div id={`${idPrefix}-hint`} ref={hintRef} aria-live="polite">
        {pending && value.length >= 2 && (
          <div className="limit-hint" role="status">
            <span>
              最多选择两项。已选「{PREFERENCE_LABEL[value[0]]}」和「{PREFERENCE_LABEL[value[1]]}」。
            </span>
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  onChange([value[0], pending]);
                  setPending(null);
                }}
              >
                用「{PREFERENCE_LABEL[pending]}」替换其次
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPending(null)}>
                保持不变
              </button>
            </span>
          </div>
        )}
        {error && value.length === 0 && (
          <p className="field-error">
            <IconAlert /> {error}
          </p>
        )}
      </div>

      <div className="order-line">
        {value.length === 0 && <span className="muted">先选的一项为首要，后选的为其次。</span>}
        {value.length === 1 && (
          <span>
            首要：<strong>{PREFERENCE_LABEL[value[0]]}</strong>
            <span className="muted"> · 可再选一项作为其次</span>
          </span>
        )}
        {value.length === 2 && (
          <>
            <span>
              首要：<strong>{PREFERENCE_LABEL[value[0]]}</strong> · 其次：<strong>{PREFERENCE_LABEL[value[1]]}</strong>
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange([value[1], value[0]])}>
              <IconSwap size={14} /> 交换优先级
            </button>
          </>
        )}
      </div>
    </div>
  );
}
