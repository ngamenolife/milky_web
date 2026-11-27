"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// 🔧 随时修改这里的目标时间（北京时间 +08:00）与文案即可切换活动倒计时
const EVENT_CONFIG = {
  targetIso: "2027-04-11T20:00:00+08:00",
  monthDay: "04 / 11",
  tagZh: "周年庆典",
  tagJa: "周年記念",
  titleZh: "Milky 周年纪念特别回",
  titleJa: "みるきぃ 周年記念スペシャル配信",
  subZh: "B站 / YouTube / Twitch 三台同播",
  subJa: "Bilibili / YouTube / Twitch 同時配信",
  liveUrl: "https://space.bilibili.com/410741448",
};

function calcLeft(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { days, clock: `${pad(hours)}:${pad(mins)}:${pad(secs)}` };
}

export default function AnniversaryCountdownCard() {
  const { locale } = useLocale();
  const isJa = locale === "ja";
  const targetMs = new Date(EVENT_CONFIG.targetIso).getTime();
  const [left, setLeft] = useState<{ days: number; clock: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLeft(calcLeft(targetMs));
    const t = setInterval(() => setLeft(calcLeft(targetMs)), 1000);
    return () => clearInterval(t);
  }, [targetMs]);

  return (
    <section className="mx-auto my-4 max-w-6xl px-4">
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/70 bg-white/75 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md dark:border-orange-400/25 dark:bg-slate-900/70 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 px-3.5 py-2 text-white shadow-sm">
              <span className="text-[11px] font-medium tracking-wider opacity-90">
                {isJa ? "記念日" : "纪念日"}
              </span>
              <span className="font-mono text-lg font-bold leading-tight">
                {EVENT_CONFIG.monthDay}
              </span>
            </div>

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                  ✨ {isJa ? EVENT_CONFIG.tagJa : EVENT_CONFIG.tagZh}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isJa ? EVENT_CONFIG.subJa : EVENT_CONFIG.subZh}
                </span>
              </div>
              <h3 className="truncate text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">
                {isJa ? EVENT_CONFIG.titleJa : EVENT_CONFIG.titleZh}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-right dark:border-slate-700/70 dark:bg-slate-800/70">
              {!mounted ? (
                <span className="font-mono text-sm text-slate-400">--:--:--</span>
              ) : left ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isJa ? "あと" : "倒计时"}
                  </span>
                  <span className="font-mono text-base font-bold text-orange-600 dark:text-orange-400">
                    {left.days > 0 ? `${left.days}${isJa ? "日 " : "天 "}` : ""}
                    {left.clock}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-bold text-pink-600 dark:text-pink-400">
                  🎉 {isJa ? "お祝い期間中！" : "周年庆典欢庆中！"}
                </span>
              )}
            </div>

            <a
              href={EVENT_CONFIG.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400"
            >
              {isJa ? "配信先へ" : "去直播间"} ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
