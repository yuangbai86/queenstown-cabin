"use client";
import { useEffect, useState } from "react";
import type { Preference } from "@/lib/types";
import { SHORT_PREF } from "@/lib/recommend/brief";

const ORDER: Preference[] = ["camera", "gaming", "battery", "handling", "ecosystem"];

/** 一行需求标签：最多两项，先选的标 1、后选的标 2；可以都不选 */
export function NeedChips({ value, onChange, labelId }: { value: Preference[]; onChange: (v: Preference[]) => void; labelId: string }) {
  const [hint, setHint] = useState<string | null>(null);
  const [shake, setShake] = useState<Preference | null>(null);
  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(null), 300);
    return () => window.clearTimeout(t);
  }, [shake]);

  const toggle = (p: Preference) => {
    if (value.includes(p)) {
      onChange(value.filter((x) => x !== p));
      setHint(null);
    } else if (value.length >= 2) {
      setShake(p);
      setHint("最多选两项，可先取消一项再选。");
    } else {
      onChange([...value, p]);
      setHint(null);
    }
  };

  return (
    <>
      <div className="chips" role="group" aria-labelledby={labelId}>
        {ORDER.map((p) => {
          const i = value.indexOf(p);
          return (
            <button key={p} type="button" className={`chip${shake === p ? " shake" : ""}`} aria-pressed={i >= 0} onClick={() => toggle(p)}>
              {SHORT_PREF[p]}
              {i >= 0 && (
                <span className="order" aria-label={i === 0 ? "第一优先" : "第二优先"}>
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="hint-line" aria-live="polite">
        {hint ?? (value.length === 0 ? "可不选，只看客观差异。" : value.length === 1 ? "可再选一项作为第二优先。" : " ")}
      </p>
    </>
  );
}
