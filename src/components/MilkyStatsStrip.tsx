"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

interface VtbStats {
  followers: number;
  likes: number;
  views: number;
  guards: number;
  updatedAt: string;
}

function fmtNum(n: number) {
  if (!n || n <= 0) return "--";
  if (n >= 10000) return `${(n / 10000).toFixed(2)}万`;
  return n.toLocaleString();
}

export default function MilkyStatsStrip() {
  const { locale } = useLocale();
  const isJa = locale === "ja";
  const [stats, setStats] = useState<VtbStats | null>(null);

  useEffect(() => {
    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    if (!sbUrl) return;
    fetch(`${sbUrl}/functions/v1/vtb-stats?uid=410741448`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.followers === "number") setStats(d);
      })
      .catch(() => {});
  }, []);

  const items = [
    {
      label: isJa ? "Bilibili 登録者" : "B站粉丝数",
      value: stats ? fmtNum(stats.followers) : "...",
      accent: "text-sky-600 dark:text-sky-400",
    },
    {
      label: isJa ? "現在の大航海" : "当前大航海",
      value: stats ? `${stats.guards}` : "...",
      accent: "text-orange-600 dark:text-orange-400",
    },
    {
      label: isJa ? "総いいね数" : "累计获赞",
      value: stats ? fmtNum(stats.likes) : "...",
      accent: "text-pink-600 dark:text-pink-400",
    },
    {
      label: isJa ? "総再生数" : "视频总播放",
      value: stats ? fmtNum(stats.views) : "...",
      accent: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <section className="mx-auto my-4 max-w-6xl px-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/65 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-slate-50/70 px-3.5 py-2.5 text-center dark:bg-slate-800/60"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
              <div className={`mt-0.5 font-mono text-lg font-extrabold sm:text-xl ${item.accent}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2.5 text-xs text-slate-500 dark:border-slate-700/50 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {stats
              ? isJa
                ? "Bilibili リアルタイム集計中"
                : "B站数据实时同步中（5分钟缓存）"
              : isJa
              ? "データを読み込み中..."
              : "正在拉取实时数据..."}
          </span>

          <a
            href="https://stats.milkyvtuber.live"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-orange-600 transition hover:text-orange-500 dark:text-orange-400"
          >
            {isJa ? "もっと見る / 全VTBデータ検索" : "查看更多 · 查全站 VTB 数据"} ↗
          </a>
        </div>
      </div>
    </section>
  );
}
