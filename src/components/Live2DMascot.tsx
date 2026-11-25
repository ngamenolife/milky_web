"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    L2Dwidget?: {
      init: (config: Record<string, unknown>) => void;
    };
  }
}

export default function Live2DMascot() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [inited, setInited] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("milky-live2d");
      if (saved === "off") {
        setEnabled(false);
      } else if (saved === "on") {
        setEnabled(true);
      } else {
        // 桌面端默认开启，手机端默认收起避免遮挡点歌按钮
        setEnabled(window.innerWidth >= 768);
      }
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    const widgetEl = document.getElementById("live2d-widget");
    if (widgetEl) {
      widgetEl.style.display = enabled ? "block" : "none";
    }
    if (enabled && ready && !inited && window.L2Dwidget) {
      setInited(true);
      window.L2Dwidget.init({
        display: {
          position: "right",
          width: 150,
          height: 300,
          hOffset: 12,
          vOffset: -20,
        },
        mobile: {
          show: true,
          scale: 0.55,
        },
        react: {
          opacity: 0.9,
        },
        dialog: {
          enable: true,
          script: {
            "every idle 15s": "🎉 祝 Milky 橘猫活动 8 周年快乐！今天想听哪首歌呀~",
            "tap body": "哎呀！别戳橘猫啦，快去点歌台听歌！",
            "tap face": "みるきぃ活動8周年おめでとう！✨",
          },
        },
      });
    }
  }, [enabled, ready, inited]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem("milky-live2d", next ? "on" : "off");
    } catch {}
  };

  return (
    <>
      {enabled && (
        <Script
          src="https://fastly.jsdelivr.net/npm/live2d-widget@3.1.4/lib/L2Dwidget.min.js"
          strategy="lazyOnload"
          onLoad={() => setReady(true)}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        title={enabled ? "隐藏看板娘" : "召唤看板娘"}
        className="fixed bottom-4 left-4 z-40 cursor-pointer rounded-full border border-orange-300/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white active:scale-95 dark:bg-slate-900/80 dark:text-slate-100"
      >
        {enabled ? "🐱 隐藏看板娘" : "🐱 召唤看板娘"}
      </button>
    </>
  );
}
