"use client";
import type { EcoDevice, Preference } from "@/lib/types";
import { ECO_LABEL } from "@/lib/labels";
import { PrefChips } from "./PrefChips";
import { IconAlert, IconCheck } from "./Icons";

export interface NeedsState {
  budget: string;
  prefs: Preference[];
  device: "iphone" | "android" | null;
  eco: EcoDevice[];
}

export function budgetError(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return "请输入整数金额（人民币），或留空跳过。";
  const n = Number(t);
  if (n < 500 || n > 50000) return "预算请填写 500 至 50000 元之间的金额。";
  return null;
}

const ECO_ALL: EcoDevice[] = ["ipad", "mac", "apple_watch", "android_tablet", "windows_pc", "android_watch"];

interface Props {
  value: NeedsState;
  onChange: (v: NeedsState) => void;
  errors: { budget?: string | null; prefs?: string | null };
  idPrefix: string;
  budgetRef?: React.Ref<HTMLInputElement>;
}

export function NeedsFields({ value, onChange, errors, idPrefix, budgetRef }: Props) {
  const set = <K extends keyof NeedsState>(k: K, v: NeedsState[K]) => onChange({ ...value, [k]: v });
  return (
    <>
      <div className="form-section" role="group" aria-labelledby={`${idPrefix}-budget-l`}>
        <div className="legend" id={`${idPrefix}-budget-l`}>
          预算 <span className="optional">可跳过</span>
        </div>
        <div className="budget-row">
          <div className="budget-input">
            <span className="prefix" aria-hidden="true">
              ¥
            </span>
            <input
              ref={budgetRef}
              id={`${idPrefix}-budget`}
              className="input"
              inputMode="numeric"
              autoComplete="off"
              aria-label="预算（人民币）"
              placeholder="例如 5000"
              value={value.budget}
              aria-invalid={errors.budget ? true : undefined}
              aria-describedby={`${idPrefix}-budget-msg`}
              onChange={(e) => set("budget", e.target.value.replace(/[,，\s元¥]/g, ""))}
            />
          </div>
          {value.budget && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => set("budget", "")}>
              跳过预算
            </button>
          )}
        </div>
        <div id={`${idPrefix}-budget-msg`} aria-live="polite">
          {errors.budget ? (
            <p className="field-error">
              <IconAlert /> {errors.budget}
            </p>
          ) : (
            <p className="field-hint">只用于判断已记录价格是否在预算内；不同价格口径会分别标注。</p>
          )}
        </div>
      </div>

      <div className="form-section" role="group" aria-labelledby={`${idPrefix}-pref-l`}>
        <div className="legend" id={`${idPrefix}-pref-l`}>
          你最在意什么？ <span className="optional">最多两项，先选的为首要</span>
        </div>
        <PrefChips value={value.prefs} onChange={(v) => set("prefs", v)} error={errors.prefs} idPrefix={`${idPrefix}-pref`} />
      </div>

      <div className="form-section" role="group" aria-labelledby={`${idPrefix}-dev-l`}>
        <div className="legend" id={`${idPrefix}-dev-l`}>
          现在使用的手机 <span className="optional">选填</span>
        </div>
        <div className="seg" role="radiogroup" aria-labelledby={`${idPrefix}-dev-l`}>
          {(
            [
              ["iphone", "iPhone"],
              ["android", "安卓手机"],
              [null, "跳过"],
            ] as const
          ).map(([v, label]) => (
            <label key={label}>
              <input type="radio" name={`${idPrefix}-device`} checked={value.device === v} onChange={() => set("device", v)} />
              <span className="dot" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 16 }} id={`${idPrefix}-eco-l`}>
          已有的配套设备 <span className="optional">选填，可多选</span>
        </div>
        <div className="seg" role="group" aria-labelledby={`${idPrefix}-eco-l`}>
          {ECO_ALL.map((e) => (
            <label key={e} className="check-pill">
              <input
                type="checkbox"
                checked={value.eco.includes(e)}
                onChange={(ev) => set("eco", ev.target.checked ? [...value.eco, e] : value.eco.filter((x) => x !== e))}
              />
              <span className="box" aria-hidden="true">
                <IconCheck size={11} />
              </span>
              {ECO_LABEL[e]}
            </label>
          ))}
        </div>
        <p className="field-hint">只用于提示可能的迁移成本和需要你确认的问题，不会因此直接推定你应该选哪款。</p>
      </div>
    </>
  );
}
