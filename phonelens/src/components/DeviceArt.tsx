"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 中性的手机示意图（不使用真实产品图片）。固定 3:5 比例预留尺寸；
 * 机型变化时旧图淡出、新图淡入（约 200ms 交叉淡入）。
 */
function Art({ id, className }: { id: string | null; className?: string }) {
  if (!id) {
    return (
      <svg className={className} viewBox="0 0 60 100" aria-hidden="true">
        <rect x="5" y="2" width="50" height="96" rx="11" fill="#f5f5f7" stroke="#d2d2d7" strokeWidth="1.5" />
        <rect x="25" y="7" width="10" height="3" rx="1.5" fill="#d2d2d7" />
      </svg>
    );
  }
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const lenses = (h % 3) + 1;
  const body = `hsl(${h} 12% 86%)`;
  const edge = `hsl(${h} 10% 70%)`;
  const gid = `g-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg className={className} viewBox="0 0 60 100" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 14% 94%)`} />
          <stop offset="1" stopColor={body} />
        </linearGradient>
      </defs>
      <rect x="5" y="2" width="50" height="96" rx="11" fill={`url(#${gid})`} stroke={edge} strokeWidth="1.2" />
      <rect x="10" y="8" width="22" height={lenses > 2 ? 30 : 22} rx="7" fill="#fff" fillOpacity="0.55" stroke={edge} strokeWidth="0.6" />
      {Array.from({ length: lenses }).map((_, i) => (
        <g key={i}>
          <circle cx="21" cy={15 + i * 9} r="3.6" fill="#2c2c2e" />
          <circle cx="21" cy={15 + i * 9} r="1.4" fill="#48484a" />
        </g>
      ))}
    </svg>
  );
}

export function DeviceArt({ id }: { id: string | null }) {
  const [layers, setLayers] = useState<{ id: string | null; key: number; out: boolean }[]>([{ id, key: 0, out: false }]);
  const seq = useRef(0);
  useEffect(() => {
    setLayers((ls) => {
      if (ls[ls.length - 1]?.id === id) return ls;
      const key = ++seq.current;
      return [...ls.map((l) => ({ ...l, out: true })), { id, key, out: true }];
    });
    const t1 = requestAnimationFrame(() => setLayers((ls) => ls.map((l, i) => (i === ls.length - 1 ? { ...l, out: false } : l))));
    const t2 = window.setTimeout(() => setLayers((ls) => ls.slice(-1)), 260);
    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
    };
  }, [id]);
  return (
    <div className="device">
      {layers.map((l) => (
        <Art key={l.key} id={l.id} className={l.out ? "out" : undefined} />
      ))}
    </div>
  );
}
