"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ModalView {
  title: string;
  content: ReactNode;
  /** Grows the modal on larger viewports — use for content that benefits from more room, like a box score. */
  wide?: boolean;
}

interface ModalApi {
  /** Opens a fresh modal, replacing any existing stack. */
  open: (view: ModalView) => void;
  /** Pushes a view on top of the current one (shows a back arrow). */
  push: (view: ModalView) => void;
  back: () => void;
  close: () => void;
}

const ModalContext = createContext<ModalApi | null>(null);

/** Generic, stack-based modal used across the site (matchups, record leaderboards, ...). */
export function useModal(): ModalApi {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within <ModalProvider>");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalView[]>([]);
  const open = useCallback((view: ModalView) => setStack([view]), []);
  const push = useCallback((view: ModalView) => setStack((s) => [...s, view]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const api = useMemo(() => ({ open, push, back, close }), [open, push, back, close]);

  const current = stack.at(-1);
  const depth = stack.length;

  useEffect(() => {
    if (depth === 0) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (depth > 1) back();
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [depth, back, close]);

  return (
    <ModalContext.Provider value={api}>
      {children}
      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`max-h-[85vh] w-full overflow-y-auto rounded-lg border border-yardline bg-field-raised p-5 shadow-xl ${current.wide ? "max-w-4xl" : "max-w-lg"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {depth > 1 && (
                  <button
                    onClick={back}
                    aria-label="Back"
                    className="rounded px-1.5 py-1 text-chalk-dim hover:text-chalk"
                  >
                    ←
                  </button>
                )}
                <h2 className="font-display text-xl font-bold">{current.title}</h2>
              </div>
              <button onClick={close} aria-label="Close" className="rounded px-1.5 py-1 text-chalk-dim hover:text-chalk">
                ✕
              </button>
            </div>
            {current.content}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
