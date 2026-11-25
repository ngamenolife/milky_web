"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// 8 周年活动结束后，改为 false 即可一键恢复日常版
export const ANNIVERSARY_8TH_ENABLED = true;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
}

const COLORS = ["#fb923c", "#f472b6", "#facc15", "#38bdf8", "#c084fc", "#ffffff"];

export default function Anniversary8thBanner() {
  const [imgOk, setImgOk] = useState(true);
  const [cheers, setCheers] = useState(0);
  const { locale } = useLocale();
  const isJa = locale === "ja";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

const fireConfetti = () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const w = canvas.width;
    const h = canvas.height;

    const batch: Particle[] = [];
    for (let i = 0; i < 72; i++) {
      const fromLeft = i % 2 === 0;
      batch.push({
        x: fromLeft ? w * 0.12 : w * 0.88,
        y: h * 0.35,
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7) + (Math.random() - 0.5) * 3,
        vy: -5 - Math.random() * 8,
        size: 5 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        life: 1,
      });
    }
    particlesRef.current = [...particlesRef.current, ...batch].slice(-220);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const next: Particle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.rot += p.vrot;
        p.life -= 0.011;
        if (p.life > 0 && p.y < canvas.height + 20) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
          next.push(p);
        }
      }
      particlesRef.current = next;
      if (next.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    if (!ANNIVERSARY_8TH_ENABLED) return;
    try {
      if (!sessionStorage.getItem("milky-8th-welcomed")) {
        sessionStorage.setItem("milky-8th-welcomed", "1");
        const t = window.setTimeout(fireConfetti, 450);
        return () => window.clearTimeout(t);
      }
    } catch {}
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!ANNIVERSARY_8TH_ENABLED) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50"
      />
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <div className="milky-anniv-card milky-spotlight-card relative overflow-hidden rounded-2xl border border-orange-300/50 bg-gradient-to-r from-orange-500/15 via-pink-500/15 to-amber-400/15 p-4 shadow-lg backdrop-blur-md sm:p-5">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              {imgOk && (
                <img
                  src="/anniversary-8th.png"
                  alt="Milky 8th Anniversary"
                  onError={() => setImgOk(false)}
                  className="h-24 w-40 shrink-0 rounded-xl border border-white/40 object-cover shadow-md sm:h-24 sm:w-44"
                />
              )}
              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-orange-300/60 bg-orange-500/15 px-3 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-300">
                  <span>✨ 8TH ANNIVERSARY</span>
                  <span className="inline-flex items-end gap-0.5" aria-hidden="true">
                    <span className="milky-eq-bar" />
                    <span className="milky-eq-bar" style={{ animationDelay: "0.2s" }} />
                    <span className="milky-eq-bar" style={{ animationDelay: "0.4s" }} />
                  </span>
                </div>
                <h2 className="text-lg font-extrabold tracking-tight sm:text-2xl">
                  {isJa
                    ? "🎉 みるきぃ活動8周年おめでとう！"
                    : "🎉 恭喜 Milky 橘猫活动 8 周年快乐！"}
                </h2>
                <p className="mt-1 text-xs opacity-80 sm:text-sm">
                  {isJa
                    ? "宇宙猫耳族のみるきぃと一緒に過ごす8年間、これからもずっと応援しています！"
                    : "感谢宇宙猫耳族 Milky 陪伴大家走过闪闪发光的 8 年，点歌台与归档继续陪你走下去！"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCheers((c) => c + 1);
                fireConfetti();
              }}
              className="shrink-0 cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            >
              {isJa ? "🎉 お祝いする" : "🎉 撒花庆祝 8 周年"}
              {cheers > 0 ? ` (${cheers})` : ""}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
