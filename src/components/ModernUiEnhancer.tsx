"use client";

import { useEffect } from "react";

export default function ModernUiEnhancer() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const target = (e.target as HTMLElement | null)?.closest(".milky-spotlight-card") as HTMLElement | null;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        target.style.setProperty("--my", `${e.clientY - rect.top}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="milky-scroll-progress" aria-hidden="true" />
      <div className="milky-aurora-layer" aria-hidden="true">
        <div className="milky-blob milky-blob-1" />
        <div className="milky-blob milky-blob-2" />
        <div className="milky-blob milky-blob-3" />
      </div>
    </>
  );
}
