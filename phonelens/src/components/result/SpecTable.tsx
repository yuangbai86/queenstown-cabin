"use client";
import { useRef, useState } from "react";
import type { Comparison, SpecRow } from "@/lib/recommend/compare";
import { EvidenceButton } from "../EvidenceDrawer";
import { SideTag } from "../Badges";

/**
 * 参数对比。桌面三列并排；手机端按参数逐项展示两款，避免横向滚动。
 * “只看差异”收起无差异行时，保持开关在屏幕上的位置不变。
 */
export function SpecTable({ c }: { c: Comparison }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const el = toggleRef.current;
    const before = el?.getBoundingClientRect().top ?? 0;
    setOnlyDiff((v) => !v);
    // 在收起/展开过渡期间持续校正，让开关保持在原位置
    const start = performance.now();
    const step = () => {
      if (!el) return;
      const delta = el.getBoundingClientRect().top - before;
      if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
      if (performance.now() - start < 320) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const groups: { name: string; rows: SpecRow[] }[] = [];
  for (const r of c.specRows) {
    const g = groups.find((x) => x.name === r.group);
    if (g) g.rows.push(r);
    else groups.push({ name: r.group, rows: [r] });
  }
  const diffCount = c.specRows.filter((r) => r.differs).length;
  const noSpecs = c.a.state === "reviews_only" || c.a.state === "none" ? "a" : c.b.state === "reviews_only" || c.b.state === "none" ? "b" : null;

  return (
    <>
      <div className="section-title">
        <h2>
          核心参数 <span className="badge badge-fact">事实</span>
        </h2>
        <div className="spec-toolbar">
          <button ref={toggleRef} type="button" role="switch" aria-checked={onlyDiff} className="switch" onClick={toggle} style={{ background: "none", border: 0, padding: 0 }}>
            <span className="track" aria-hidden="true" />
            只看差异（{diffCount} 项）
          </button>
        </div>
      </div>
      {noSpecs && (
        <p className="notice notice-warn" style={{ marginBottom: 12 }}>
          {noSpecs.toUpperCase()} 的参数尚未核验，相关行显示“尚未核验”，不会用推测值补齐，涉及硬件规格的判断会受限。
        </p>
      )}
      <div className="card spec-table">
        <div className="spec-head" aria-hidden="true">
          <span>参数</span>
          <span className="col-name">
            <SideTag side="a" /> {c.a.name}
          </span>
          <span className="col-name">
            <SideTag side="b" /> {c.b.name}
          </span>
        </div>
        <div role="table" aria-label={`${c.a.name} 与 ${c.b.name} 的参数对比`}>
          <div role="rowgroup" className="sr-only">
            <div role="row">
              <span role="columnheader">参数</span>
              <span role="columnheader">A {c.a.name}</span>
              <span role="columnheader">B {c.b.name}</span>
            </div>
          </div>
          {groups.map((g) => {
            const allHidden = onlyDiff && g.rows.every((r) => !r.differs);
            return (
              <div key={g.name} role="rowgroup">
                <div className={`spec-row${allHidden ? " collapsed" : ""}`} aria-hidden={allHidden || undefined}>
                  <div className="row-clip">
                    <div className="spec-group-title">{g.name}</div>
                  </div>
                </div>
                {g.rows.map((r) => {
                  const hidden = onlyDiff && !r.differs;
                  return (
                    <div key={r.field} className={`spec-row${hidden ? " collapsed" : ""}`} role="row" aria-hidden={hidden || undefined}>
                      <div className="row-clip">
                        <div className="row-inner">
                          <span className="label" role="rowheader">
                            {r.label}
                            {r.differs && !r.a.missing && !r.b.missing && <span className="diff-mark">不同</span>}
                          </span>
                          {(["a", "b"] as const).map((s) => (
                            <span key={s} role="cell" className={`spec-cell${r[s].missing ? " missing" : ""}`}>
                              <span className="side-mobile">
                                <SideTag side={s} /> {c[s].model}
                              </span>
                              <span className="val">{r[s].text}</span>
                              <EvidenceButton ids={[r[s].evidence]} title={`${c[s].name} · ${r.label}`} label="来源" />
                            </span>
                          ))}
                          {r.caution && r.differs && <span className="spec-caution">注意：{r.caution}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {onlyDiff && diffCount === 0 && <p className="spec-empty">两款已收录的参数没有差异。</p>}
      </div>
    </>
  );
}
