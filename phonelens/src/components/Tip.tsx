"use client";
import { useId, useState } from "react";

/** 工具提示：鼠标悬停与键盘聚焦都能打开，Esc 关闭。重要说明不要只放在这里。 */
export function Tip({ text, label = "说明" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="tip"
      data-open={open ? "true" : "false"}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tip-btn"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        ?
      </button>
      <span role="tooltip" id={id} className="tip-bubble">
        {text}
      </span>
    </span>
  );
}
