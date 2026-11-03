"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mount expensive dashboard panels only when they enter the scroll viewport. */
export function ViewportSection({ children, label }: { children: ReactNode; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !container.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={container}>
      {visible ? children : (
        <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card p-6">
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setVisible(true)}>
            Load {label}
          </button>
        </div>
      )}
    </div>
  );
}
