"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CatalogItem } from "@/lib/data";
import { PhoneArt } from "./PhoneArt";
import { DataKindBadge, SaleBadge, SideTag } from "./Badges";
import { IconAlert, IconClose } from "./Icons";

export function itemName(p: CatalogItem) {
  return `${p.brand} ${p.model}`;
}

export function dataStateText(p: CatalogItem) {
  if (p.has_specs && p.review_count > 0) return "参数 + 评论";
  if (p.has_specs) return "仅参数";
  if (p.review_count > 0) return "仅评论";
  return "数据待收录";
}

function exactMatch(list: CatalogItem[], q: string): CatalogItem | undefined {
  const k = q.trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return undefined;
  return list.find(
    (p) => p.id === k || itemName(p).toLowerCase() === k || p.model.toLowerCase() === k || p.aliases.some((a) => a.toLowerCase() === k),
  );
}

function matches(p: CatalogItem, q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return true;
  const hay = [p.brand, p.model, itemName(p), ...p.aliases].join(" ").toLowerCase();
  return k.split(/\s+/).every((part) => hay.includes(part));
}

interface Props {
  side: "a" | "b";
  catalog: CatalogItem[];
  value: string | null;
  otherId: string | null;
  onChange: (id: string | null) => void;
  error?: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function PhonePicker({ side, catalog, value, otherId, onChange, error, inputRef }: Props) {
  const selected = catalog.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState(selected ? itemName(selected) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [dupHint, setDupHint] = useState(false);
  const listId = useId();
  const inputId = useId();
  const hintId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  // 外部改变（交换、恢复）时同步输入框
  useEffect(() => {
    setQuery(selected ? itemName(selected) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filtered = useMemo(() => {
    if (showAll || (selected && query === itemName(selected))) return catalog;
    return catalog.filter((p) => matches(p, query));
  }, [catalog, query, showAll, selected]);

  const groups = useMemo(
    () => [
      { label: "演示机型（虚构，用于体验完整流程）", items: filtered.filter((p) => p.data_kind === "demo") },
      { label: "真实机型（数据核验中）", items: filtered.filter((p) => p.data_kind !== "demo") },
    ],
    [filtered],
  );
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (p: CatalogItem) => {
    if (p.id === otherId) {
      setDupHint(true);
      return;
    }
    setDupHint(false);
    onChange(p.id);
    setQuery(itemName(p));
    setOpen(false);
    setShowAll(false);
  };

  const unknown = !selected && query.trim().length > 0 && !open && !exactMatch(catalog, query);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      if (open && flat[active]) {
        e.preventDefault();
        choose(flat[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Home" && open) {
      setActive(0);
    } else if (e.key === "End" && open) {
      setActive(flat.length - 1);
    }
  };

  const onBlur = (e: React.FocusEvent) => {
    if (e.relatedTarget && (e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setShowAll(false);
    // 只接受精确匹配（编号、完整型号、已登记别名），不自动替换为相似名称
    if (!selected) {
      const m = exactMatch(catalog, query);
      if (m && m.id !== otherId) choose(m);
    }
  };

  const describedBy = [error || dupHint || unknown ? hintId : null].filter(Boolean).join(" ") || undefined;
  let optionIndex = -1;

  return (
    <div>
      <label className="picker-label" htmlFor={inputId}>
        <SideTag side={side} /> 手机 {side.toUpperCase()}
      </label>
      <div className="combo" onBlur={onBlur}>
        <div className="input-wrap">
          <input
            ref={inputRef}
            id={inputId}
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && flat[active] ? `${listId}-${flat[active].id}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            placeholder="搜索品牌或型号，如 Alpha"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setShowAll(false);
              setActive(0);
              setDupHint(false);
              if (selected && e.target.value !== itemName(selected)) onChange(null);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKey}
          />
          {query && (
            <button
              type="button"
              className="input-clear"
              aria-label={`清除手机 ${side.toUpperCase()}`}
              onClick={() => {
                setQuery("");
                onChange(null);
                setDupHint(false);
                setOpen(true);
                (document.getElementById(inputId) as HTMLInputElement | null)?.focus();
              }}
            >
              <IconClose size={16} />
            </button>
          )}
        </div>
        <ul ref={listRef} id={listId} role="listbox" className="listbox" data-open={open ? "true" : "false"} aria-label={`手机 ${side.toUpperCase()} 候选`}>
          {flat.length === 0 && (
            <li className="empty" role="presentation">
              暂未收录「{query.trim()}」。不会自动替换为相似名称。
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowAll(true)}>
                  查看全部目录
                </button>
                <Link className="btn btn-sm btn-ghost" href={`/import?name=${encodeURIComponent(query.trim().slice(0, 40))}`}>
                  导入自己的评论
                </Link>
              </div>
            </li>
          )}
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <li key={g.label} role="presentation">
                  <div className="group-label" aria-hidden="true">
                    {g.label}
                  </div>
                  <ul role="group" aria-label={g.label} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {g.items.map((p) => {
                      optionIndex++;
                      const idx = optionIndex;
                      const taken = p.id === otherId;
                      return (
                        <li
                          key={p.id}
                          id={`${listId}-${p.id}`}
                          role="option"
                          data-index={idx}
                          aria-selected={p.id === value}
                          aria-disabled={taken || undefined}
                          className={`option${idx === active ? " active" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseMove={() => setActive(idx)}
                          onClick={() => choose(p)}
                        >
                          <span>
                            <span className="opt-name">{itemName(p)}</span>
                            <span className="opt-meta">
                              {" "}
                              · {p.storage} · {p.region}
                            </span>
                          </span>
                          <span className="opt-meta">{taken ? `已选为 ${side === "a" ? "B" : "A"}` : dataStateText(p)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ),
          )}
        </ul>
      </div>

      <div id={hintId} aria-live="polite">
        {error && !dupHint && (
          <p className="field-error">
            <IconAlert /> {error}
          </p>
        )}
        {dupHint && (
          <p className="field-error">
            <IconAlert /> 这款已经选为手机 {side === "a" ? "B" : "A"}，请换一款进行对比。
          </p>
        )}
        {unknown && !error && (
          <p className="field-error">
            <IconAlert /> 暂未收录「{query.trim()}」，没有替换为相似机型。可以
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAll(true); setOpen(true); }}>
              查看目录
            </button>
            或
            <Link className="btn btn-ghost btn-sm" href={`/import?name=${encodeURIComponent(query.trim().slice(0, 40))}`}>
              导入评论
            </Link>
          </p>
        )}
      </div>

      <div className={`phone-card${selected ? "" : " is-empty"}`}>
        {selected ? (
          <div key={selected.id} className="swap-in">
            <div className="fade-swap" style={{ display: "contents" }}>
              <span className="fade-swap">
                <PhoneArt id={selected.id} label={itemName(selected)} />
              </span>
              <div className="info fade-swap">
                <div className="name">{itemName(selected)}</div>
                <div className="small muted">
                  {selected.region} · {selected.storage}
                  {selected.ram ? ` · ${selected.ram} 运行内存` : ""}
                </div>
                <div className="meta">
                  <DataKindBadge kind={selected.data_kind} />
                  <SaleBadge status={selected.sale_status} />
                  <span className="badge">{dataStateText(selected)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <PhoneArt id="empty" label="" empty />
            <div className="info small">尚未选择。从列表中选择后，这里会显示完整型号、地区和存储版本。</div>
          </>
        )}
      </div>
    </div>
  );
}
