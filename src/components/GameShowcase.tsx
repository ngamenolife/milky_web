"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gamepad2, Search, Sparkles } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import gamesData from "../../data/milky-games.json";

interface GameEntry {
  id: string;
  name: string;
  firstDate: string;
  year: number;
  category: string;
  videoTitle: string;
  episodes?: number;
}

const CAT_STYLE: Record<string, string> = {
  "动作/魂类": "bg-rose-100 text-rose-700 border-rose-200",
  "JRPG/RPG": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "任系/平台": "bg-amber-100 text-amber-800 border-amber-200",
  "恐怖/悬疑": "bg-purple-100 text-purple-800 border-purple-200",
  "推理/文字": "bg-sky-100 text-sky-700 border-sky-200",
  "独立/剧情": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "二游/抽卡": "bg-pink-100 text-pink-700 border-pink-200",
  "模拟/休闲": "bg-teal-100 text-teal-700 border-teal-200",
};

const ALL_GAMES = (gamesData.games || []) as GameEntry[];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];
const CATS = ["all", "动作/魂类", "JRPG/RPG", "任系/平台", "恐怖/悬疑", "推理/文字", "独立/剧情", "二游/抽卡", "模拟/休闲"];

export default function GameShowcase() {
  const { locale } = useLocale();
  const [year, setYear] = useState<number | "all">("all");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ALL_GAMES.filter((g) => {
      if (year !== "all" && g.year !== year) return false;
      if (cat !== "all" && g.category !== cat) return false;
      if (kw && !g.name.toLowerCase().includes(kw) && !g.videoTitle.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [year, cat, q]);

  const visible = expanded ? filtered : filtered.slice(0, 12);

  return (
    <section id="games" className="mb-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-bold text-stone-900">
              {locale === "ja" ? "🎮 プレイ済みゲーム図鑑 (2019–2026)" : "🎮 橘猫游戏履历墙 (2019–2026)"}
            </h3>
            <p className="text-xs text-stone-500">
              {locale === "ja"
                ? `全 ${ALL_GAMES.length} 作品を収録 · カードをクリックでBilibili実況を検索`
                : `累计收录 ${ALL_GAMES.length} 款实况初见记录 · 点击卡片直达 B 站搜索对应录像`}
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === "ja" ? "ゲーム名で検索..." : "搜索游戏名（如 塞尔达 / FF / 鬼泣）..."}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs focus:border-milky-400 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* 年份时间轴胶囊 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setYear("all")}
          className={
            "rounded-full px-3 py-1 text-xs font-semibold transition " +
            (year === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-orange-100")
          }
        >
          {locale === "ja" ? "全年代" : "全部年份"} ({ALL_GAMES.length})
        </button>
        {YEARS.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={
              "rounded-full px-3 py-1 text-xs font-semibold transition " +
              (year === y ? "bg-milky-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-orange-100")
            }
          >
            {y}
          </button>
        ))}
      </div>

      {/* 类型筛选 */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition " +
              (cat === c
                ? "border-milky-500 bg-milky-50 text-milky-700"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50")
            }
          >
            {c === "all" ? (locale === "ja" ? "すべて" : "全部分类") : c}
          </button>
        ))}
      </div>

      {/* 游戏卡片网格 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => {
          const searchUrl = "https://search.bilibili.com/all?keyword=" + encodeURIComponent("Milky " + g.name);
          const badge = CAT_STYLE[g.category] || "bg-stone-100 text-stone-700 border-stone-200";
          return (
            <a
              key={g.id}
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between rounded-2xl border border-stone-100 bg-gradient-to-br from-white to-orange-50/40 p-4 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className={"rounded-full border px-2 py-0.5 font-semibold " + badge}>
                    {g.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {g.episodes && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">
                        <Sparkles className="h-3 w-3" /> {g.episodes}P
                      </span>
                    )}
                    <span className="font-mono text-stone-400">{g.firstDate}</span>
                  </div>
                </div>
                <h4 className="mb-1 line-clamp-1 text-sm font-bold text-stone-900 group-hover:text-milky-600">
                  {g.name}
                </h4>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-stone-500">
                  {g.videoTitle}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-milky-600 opacity-80 group-hover:opacity-100">
                {locale === "ja" ? "Bilibiliで探す" : "去 B 站找录像"}
                <ExternalLink className="ml-1 h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>

      {filtered.length > 12 && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl border border-orange-200 bg-milky-50 px-5 py-2 text-xs font-semibold text-milky-700 hover:bg-milky-100"
          >
            {expanded
              ? locale === "ja" ? "折りたたむ" : "收起列表"
              : locale === "ja"
              ? `すべて表示 (残り ${filtered.length - 12} 作品)`
              : `展开全部 ${filtered.length} 款游戏`}
          </button>
        </div>
      )}
    </section>
  );
}
