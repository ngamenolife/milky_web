"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

type LivePlatform = {
  platform: "bilibili" | "twitch" | "youtube";
  live: boolean;
  title: string;
  url: string;
  previewImage: string;
  embedType: "youtube" | "twitch" | "link";
  embedId: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const PLATFORM_META: Record<
  LivePlatform["platform"],
  { name: string; badge: string }
> = {
  bilibili: { name: "Bilibili", badge: "bg-pink-500/90 text-white" },
  twitch: { name: "Twitch", badge: "bg-purple-600/90 text-white" },
  youtube: { name: "YouTube", badge: "bg-red-600/90 text-white" },
};

export default function LivePreviewStrip() {
  const [liveList, setLiveList] = useState<LivePlatform[]>([]);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(() => Date.now());
  const { locale } = useLocale();
  const isJa = locale === "ja";

useEffect(() => {
    if (!SUPABASE_URL) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/live-status`, {
          headers: SUPABASE_KEY
            ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const items: LivePlatform[] = Array.isArray(data?.livePlatforms)
          ? data.livePlatforms
          : [data?.bilibili, data?.twitch, data?.youtube].filter(
              (x) => x && x.live
            );
        if (!cancelled) {
          setLiveList(items);
          setTick(Date.now());
        }
      } catch {
        // 静默降级，不影响主站
      }
    };

    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (liveList.length === 0) return null;

  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "ngamenolife.github.io";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-4">
      <div className="rounded-2xl border border-rose-200/70 bg-white/85 p-3 shadow-sm backdrop-blur dark:border-rose-500/30 dark:bg-slate-900/80">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
            </span>
            <span>
              {isJa
                ? "配信中・マルチプラットフォーム速報"
                : "正在直播 · 全平台画面速览"}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {isJa ? "60秒ごとに画面自動更新" : "每 60 秒自动刷新实时画面"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liveList.map((item) => {
            const meta = PLATFORM_META[item.platform];
            const canEmbed =
              (item.embedType === "youtube" || item.embedType === "twitch") &&
              Boolean(item.embedId);
            const isPlaying = activeEmbed === item.platform;
            const imgSrc = item.previewImage
              ? `${item.previewImage}${item.previewImage.includes("?") ? "&" : "?"}t=${tick}`
              : "";
            const embedSrc =
              item.embedType === "youtube"
                ? `https://www.youtube.com/embed/${item.embedId}?autoplay=1&mute=1`
                : `https://player.twitch.tv/?channel=${item.embedId}&parent=${host}&muted=true`;

            return (
              <div
                key={item.platform}
                className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-700/70 dark:bg-slate-800/70"
              >
                <div className="relative aspect-video w-full bg-slate-900">
                  {isPlaying && canEmbed ? (
                    <iframe
                      src={embedSrc}
                      title={item.title || meta.name}
                      className="h-full w-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={item.title || meta.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      LIVE
                    </div>
                  )}

                  <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5">
                    <span className="rounded bg-rose-600/95 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                      LIVE
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
                    >
                      {meta.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5">
                  <p
                    className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                    title={item.title}
                  >
                    {item.title || meta.name}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canEmbed && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveEmbed(isPlaying ? null : item.platform)
                        }
                        className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-300"
                      >
                        {isPlaying
                          ? isJa
                            ? "閉じる"
                            : "关闭试看"
                          : isJa
                            ? "▶ ミニ再生"
                            : "▶ 小窗试看"}
                      </button>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                    >
                      {isJa ? "配信へ ↗" : "去直播间 ↗"}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
