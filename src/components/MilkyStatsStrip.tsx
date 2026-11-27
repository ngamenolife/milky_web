"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// 🔧 12 月 8 日 8 周年倒计时（北京时间 +08:00）
const TARGET_ISO = "2026-12-08T20:00:00+08:00";

function calcLeft(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  return `${days > 0 ? `${days}d ` : ""}${h}:${m}:${s}`;
}

function fmt(n: number) {
  if (!n || n <= 0) return "--";
  return n >= 10000 ? `${(n / 10000).toFixed(2)}万` : n.toLocaleString();
}

export default function MilkyStatsStrip() {
  const { locale } = useLocale();
  const isJa = locale === "ja";
  const [left, setLeft] = useState<string | null>(null);
  const [biliFans, setBiliFans] = useState<number>(0);
  const [guards, setGuards] = useState<number>(0);

  // 后续 vtb-stats 接入 YT / Twitch 实时粉丝后直接相加
  const YT_FANS = 0;
  const TWITCH_FANS = 0;

  useEffect(() => {
    const targetMs = new Date(TARGET_ISO).getTime();
    setLeft(calcLeft(targetMs));
    const t = setInterval(() => setLeft(calcLeft(targetMs)), 1000);

    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    if (sbUrl) {
      fetch(`${sbUrl}/functions/v1/vtb-stats?uid=410741448`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.followers) setBiliFans(Number(d.followers));
          if (d?.guards) setGuards(Number(d.guards));
        })
        .catch(() => {});
    }
    return () => clearInterval(t);
  }, []);

  const totalFans = biliFans + YT_FANS + TWITCH_FANS;

  return (
    <div className="mx-auto -mt-2 mb-3 max-w-6xl px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200/50 bg-white/75 px-3.5 py-2 text-xs shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/70">
        {/* 左侧：12/08 8周年紧凑倒计时 */}
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gradient-to-r from-orange-400 to-pink-500 px-2 py-0.5 font-semibold text-white">
            🎂 12/08 8周年
          </span>
          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
            {left ? (isJa ? `あと ${left}` : `倒计时 ${left}`) : isJa ? "お祝い中！" : "欢庆中！"}
          </span>
        </div>

        {/* 右侧：极简三台粉丝汇总 + 跳转数据站 */}
        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
          <span>
            {isJa ? "総登録者" : "三台粉丝"}:{" "}
            <b className="font-mono text-sky-600 dark:text-sky-400">{fmt(totalFans)}</b>
          </span>
          <span className="hidden opacity-40 sm:inline">|</span>
          <span className="hidden sm:inline">
            大航海: <b className="font-mono text-orange-600 dark:text-orange-400">{guards || "--"}</b>
          </span>
          <a
            href="https://stats.milkyvtuber.live"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-orange-500/10 px-2.5 py-1 font-semibold text-orange-600 transition hover:bg-orange-500/20 dark:text-orange-400"
          >
            📊 {isJa ? "全VTBデータ" : "查全站VTB"} ↗
          </a>
        </div>
      </div>
    </div>
  );
}
