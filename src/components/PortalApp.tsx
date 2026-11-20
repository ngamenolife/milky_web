"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, Download, Globe, Plus, Radio, Search, Tv, X, Youtube } from "lucide-react";
import Jukebox from "@/components/Jukebox";
import { useLocale } from "@/components/LocaleProvider";
import type { SongItem, UnindexedStream } from "@/lib/songs";
import type { LiveStatus, ScheduleCategory, ScheduleItem, SchedulePlatform, VideoItem } from "@/lib/types";

interface Props {
  initialSchedule: ScheduleItem[];
  initialVideos: VideoItem[];
  initialSongs: SongItem[];
  initialUnindexed: UnindexedStream[];
}

export default function PortalApp({
  initialSchedule,
  initialVideos,
  initialSongs,
  initialUnindexed,
}: Props) {
  const { t, toggleLocale } = useLocale();
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule);
  const [category, setCategory] = useState<"all" | ScheduleCategory>("all");
  const [platform, setPlatform] = useState<"all" | "Bilibili" | "YouTube">("all");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [live, setLive] = useState<LiveStatus | null>(null);

  const [schedModal, setSchedModal] = useState(false);
  const [schedForm, setSchedForm] = useState({
    title: "",
    category: "game" as ScheduleCategory,
    platform: "三台同播" as SchedulePlatform,
    startLocal: "2026-11-25T20:00",
    endLocal: "2026-11-25T22:00",
    sourceUrl: "https://x.com/MilkyVtuber",
  });
  const [schedMsg, setSchedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/live-status")
      .then((r) => r.json())
      .then((d: LiveStatus) => setLive(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const qs =
        "?q=" + encodeURIComponent(query) + "&platform=" + encodeURIComponent(platform);
      fetch("/api/archive" + qs)
        .then((r) => r.json())
        .then((d: { items: VideoItem[] }) => setVideos(d.items))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query, platform]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchedMsg(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: schedForm.title,
          category: schedForm.category,
          platform: schedForm.platform,
          startIso: new Date(schedForm.startLocal).toISOString(),
          endIso: new Date(schedForm.endLocal).toISOString(),
          sourceUrl: schedForm.sourceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSchedMsg("❌ " + (data.error || "Error"));
      } else {
        setSchedule((prev) => [data.item, ...prev]);
        setSchedMsg("✅ OK!");
        setTimeout(() => {
          setSchedModal(false);
          setSchedMsg(null);
        }, 700);
      }
    } catch {
      setSchedMsg("❌ Network Error");
    }
  };

  const visibleSchedule =
    category === "all" ? schedule : schedule.filter((s) => s.category === category);
  const isAnyLive = Boolean(live?.youtube.isLive || live?.bilibili.isLive);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-milky-500 text-xl text-white">
            🐱
          </span>
          <div>
            <h1 className="text-lg font-bold text-stone-900">{t.brand}</h1>
            <p className="text-xs text-stone-500">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <nav className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 text-xs font-semibold">
            <Link href="/schedule" className="rounded-lg px-2.5 py-1 text-stone-600 hover:bg-white hover:text-milky-600">
              {t.navSchedule}
            </Link>
            <Link href="/about" className="rounded-lg px-2.5 py-1 text-stone-600 hover:bg-white hover:text-milky-600">
              {t.navAbout}
            </Link>
          </nav>

          <span
            data-testid="live-badge"
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " +
              (isAnyLive ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-600")
            }
          >
            <Radio className="h-3.5 w-3.5" />
            {isAnyLive ? t.liveOnline : t.liveOffline}
          </span>

          <button
            type="button"
            data-testid="lang-toggle"
            onClick={toggleLocale}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-milky-50 px-3 py-1.5 text-xs font-semibold text-milky-600 hover:bg-milky-100"
          >
            <Globe className="h-3.5 w-3.5" />
            {t.langBtn}
          </button>
        </div>
      </header>

      <section className="mb-10 rounded-3xl bg-gradient-to-br from-orange-400 to-amber-500 p-8 text-white shadow-md">
        <h2 className="mb-2 text-3xl font-extrabold">MilkyTube / みるきぃ</h2>
        <p className="mb-6 max-w-2xl text-sm text-orange-50">{t.heroDesc}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#jukebox"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-milky-600 shadow-sm hover:bg-orange-50"
          >
            🎵 {t.btnJukebox}
          </a>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-stone-900/30"
          >
            <Calendar className="h-4 w-4" />
            {t.btnSchedule}
          </Link>
          <a
            href="/api/schedule/ics"
            data-testid="ics-download"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-stone-900/30"
          >
            <Download className="h-4 w-4" />
            {t.btnIcs}
          </a>
          <a
            href="https://space.bilibili.com/410741448"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            <Tv className="h-4 w-4" />
            Bilibili
          </a>
          <a
            href="https://www.youtube.com/@milkytube0411"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Youtube className="h-4 w-4" />
            YouTube
          </a>
        </div>
      </section>

      <Jukebox initialSongs={initialSongs} initialUnindexed={initialUnindexed} />

      <section id="schedule" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-xl font-bold text-stone-900">{t.navSchedule}</h3>
            <button
              type="button"
              data-testid="open-add-schedule"
              onClick={() => setSchedModal(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-milky-400 bg-milky-50 px-2.5 py-1 text-xs font-semibold text-milky-600 hover:bg-milky-100"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.calAddBtn}
            </button>
            <Link
              href="/schedule"
              className="text-xs font-semibold text-milky-600 hover:underline"
            >
              {t.btnFullCalendar}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "game", "watchalong", "singing", "bilibili", "collab"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                data-testid={"filter-" + cat}
                onClick={() => setCategory(cat)}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium transition " +
                  (category === cat
                    ? "bg-milky-500 text-white"
                    : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50")
                }
              >
                {cat === "all"
                  ? t.filterAll
                  : cat === "game"
                  ? t.catGame
                  : cat === "watchalong"
                  ? t.catWatchalong
                  : cat === "singing"
                  ? t.catSinging
                  : cat === "bilibili"
                  ? t.catBilibili
                  : t.catCollab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {visibleSchedule.map((item) => (
            <article
              key={item.id}
              data-testid="schedule-card"
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-orange-100"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
                <span className="rounded bg-milky-100 px-2 py-0.5 font-semibold text-milky-600">
                  {item.platform}
                </span>
                <span>{item.startIso.slice(0, 10)}</span>
              </div>
              <h4 className="font-semibold text-stone-900">{item.title}</h4>
            </article>
          ))}
        </div>
      </section>

      <section id="archive" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-stone-900">{t.navArchive}</h3>
            <div className="flex gap-1.5">
              {(["all", "Bilibili", "YouTube"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                    (platform === p
                      ? "bg-stone-800 text-white"
                      : "bg-white text-stone-600 ring-1 ring-stone-200")
                  }
                >
                  {p === "all" ? t.filterAll : p}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="search"
              data-testid="archive-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-milky-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-video w-full overflow-hidden bg-stone-100">
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
                  <Tv className="h-3.5 w-3.5 text-milky-500" />
                  <span>{v.platform}</span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-stone-800">{v.title}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="rounded-2xl bg-white p-6 text-sm text-stone-600 ring-1 ring-orange-100">
        <h3 className="mb-2 font-bold text-stone-900">{t.aboutTitle}</h3>
        <p className="mb-2">{t.aboutBio}</p>
        <p className="mb-4 font-medium text-milky-600">{t.catchphrase}</p>
        <p className="border-t border-stone-100 pt-3 text-xs text-stone-400">
          {t.disclaimer}
        </p>
      </footer>

      {schedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-stone-900">{t.calModalCreate}</h4>
              <button type="button" onClick={() => setSchedModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddSchedule} className="space-y-3 text-xs">
              <input
                required
                placeholder="Title *"
                value={schedForm.title}
                onChange={(e) => setSchedForm({ ...schedForm, title: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={schedForm.category}
                  onChange={(e) => setSchedForm({ ...schedForm, category: e.target.value as ScheduleCategory })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  <option value="game">{t.catGame}</option>
                  <option value="watchalong">{t.catWatchalong}</option>
                  <option value="singing">{t.catSinging}</option>
                  <option value="bilibili">{t.catBilibili}</option>
                  <option value="collab">{t.catCollab}</option>
                </select>
                <select
                  value={schedForm.platform}
                  onChange={(e) => setSchedForm({ ...schedForm, platform: e.target.value as SchedulePlatform })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  <option value="三台同播">三台同播 (Twitch/YT/B站)</option>
                  <option value="Twitch">Twitch</option>
                  <option value="Twitch + YouTube">Twitch + YouTube</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Bilibili">Bilibili</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-stone-500">{t.calStart}</span>
                  <input
                    type="datetime-local"
                    required
                    value={schedForm.startLocal}
                    onChange={(e) => setSchedForm({ ...schedForm, startLocal: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-stone-500">{t.calEnd}</span>
                  <input
                    type="datetime-local"
                    required
                    value={schedForm.endLocal}
                    onChange={(e) => setSchedForm({ ...schedForm, endLocal: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-2 py-1.5"
                  />
                </label>
              </div>
              {schedMsg && <p className="font-medium text-milky-600">{schedMsg}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-milky-500 py-2.5 text-sm font-semibold text-white hover:bg-milky-600"
              >
                {t.calAddBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
