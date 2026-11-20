"use client";
import { useId, useState } from "react";

/** 平滑展开的折叠区：按钮带 aria-expanded，收起时内容不可聚焦 */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const id = useId();
  return { open, setOpen, toggle: () => setOpen((o) => !o), id };
}

export function Collapse({ open, id, children, label }: { open: boolean; id: string; children: React.ReactNode; label?: string }) {
  return (
    <div className="collapse" data-open={open ? "true" : "false"} id={id} role="region" aria-label={label}>
      <div className="collapse-inner" inert={!open}>
        <div className="collapse-content">{children}</div>
      </div>
    </div>
  );
}
