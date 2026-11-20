"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; text: string; leaving?: boolean };
const Ctx = createContext<(text: string) => void>(() => {});

/** 临时通知：底部左侧，不遮挡主要操作；通过 aria-live 播报 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string) => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, text }]);
    window.setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 2600);
    window.setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2850);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="toast" data-leaving={t.leaving ? "true" : undefined}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
