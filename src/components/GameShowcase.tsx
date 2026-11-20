"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Gamepad2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import {
  deleteCloudGame,
  fetchCloudGames,
  isSupabaseReady,
  saveCloudGame,
  type GameEntry,
} from "@/lib/supabaseClient";
import gamesData from "../../data/milky-games.json";

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

const INITIAL_GAMES = (gamesData.games || []) as GameEntry[];
const CAT_JA: Record<string, string> = {
  "动作/魂类": "アクション/ソウル系",
  "JRPG/RPG": "JRPG/RPG",
  "任系/平台": "任天堂/アクション",
  "恐怖/悬疑": "ホラー/サスペンス",
  "推理/文字": "推理/ノベル",
  "独立/剧情": "インディー/ストーリー",
  "二游/抽卡": "ソシャゲ/ガチャ",
  "模拟/休闲": "シム/カジュアル",
};

const CATS = ["all", "动作/魂类", "JRPG/RPG", "任系/平台", "恐怖/悬疑", "推理/文字", "独立/剧情", "二游/抽卡", "模拟/休闲"];

export default function GameShowcase() {
  const { locale } = useLocale();
  const [games, setGames] = useState<GameEntry[]>(INITIAL_GAMES);
  const [year, setYear] = useState<number | "all">("all");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    firstDate: new Date().toISOString().slice(0, 10),
    category: "动作/魂类",
    videoTitle: "",
    episodes: "",
  });

  useEffect(() => {
    if (!isSupabaseReady) return;
    fetchCloudGames()
      .then((cloud) => {
        if (cloud.length === 0) return;
        setGames((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const c of cloud) map.set(c.id, c);
          return Array.from(map.values()).sort((a, b) => b.firstDate.localeCompare(a.firstDate));
        });
      })
      .catch(() => {});
  }, []);

  const years = useMemo(() => {
    const set = new Set(games.map((g) => g.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [games]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return games.filter((g) => {
      if (year !== "all" && g.year !== year) return false;
      if (cat !== "all" && g.category !== cat) return false;
      if (kw && !g.name.toLowerCase().includes(kw) && !g.videoTitle.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [games, year, cat, q]);

  const visible = expanded ? filtered : filtered.slice(0, 12);

  const openCreate = () => {
    setEditingId(null);
    setMsg(null);
    setForm({
      name: "",
      firstDate: new Date().toISOString().slice(0, 10),
      category: "动作/魂类",
      videoTitle: "",
      episodes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (g: GameEntry) => {
    setEditingId(g.id);
    setMsg(null);
    setForm({
      name: g.name,
      firstDate: g.firstDate,
      category: g.category,
      videoTitle: g.videoTitle,
      episodes: g.episodes ? String(g.episodes) : "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const dateStr = form.firstDate || new Date().toISOString().slice(0, 10);
    const epsNum = Number(form.episodes);
    const entry: GameEntry = {
      id: editingId || "game-" + Date.now(),
      name: form.name.trim(),
      firstDate: dateStr,
      year: Number(dateStr.slice(0, 4)) || new Date().getFullYear(),
      category: form.category,
      videoTitle: form.videoTitle.trim() || form.name.trim(),
      episodes: Number.isFinite(epsNum) && epsNum > 0 ? Math.floor(epsNum) : undefined,
    };

    try {
      await saveCloudGame(entry);
      setGames((prev) => {
        const next = editingId
          ? prev.map((x) => (x.id === editingId ? entry : x))
          : [entry, ...prev];
        return next.sort((a, b) => b.firstDate.localeCompare(a.firstDate));
      });
      setMsg("✅ " + (locale === "ja" ? "クラウドに保存しました！" : "已同步保存至云端！"));
      setTimeout(() => setModalOpen(false), 600);
    } catch (err) {
      setMsg("❌ " + (err instanceof Error ? err.message : "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !window.confirm(locale === "ja" ? "このゲーム記録を削除しますか？" : "确定删除这条游戏记录吗？")) return;
    setSaving(true);
    try {
      await deleteCloudGame(editingId);
      setGames((prev) => prev.filter((x) => x.id !== editingId));
      setModalOpen(false);
    } catch (err) {
      setMsg("❌ " + (err instanceof Error ? err.message : "删除失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="games" className="mb-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100 overflow-hidden">
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
                ? `全 ${games.length} 作品を収録 · ファン編集で追加・修正可能`
                : `累计收录 ${games.length} 款实况初见记录 · 支持粉丝在线添加与编辑`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52 sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={locale === "ja" ? "ゲーム名で検索..." : "搜索游戏名（塞尔达/FF）..."}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs focus:border-milky-400 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-xl bg-milky-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-milky-600"
          >
            <Plus className="h-3.5 w-3.5" />
            {locale === "ja" ? "ゲームを追加" : "添加游戏"}
          </button>
        </div>
      </div>

      {/* 年份时间轴 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setYear("all")}
          className={
            "rounded-full px-3 py-1 text-xs font-semibold transition " +
            (year === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-orange-100")
          }
        >
          {locale === "ja" ? "全年代" : "全部年份"} ({games.length})
        </button>
        {years.map((y) => (
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
            {c === "all" ? (locale === "ja" ? "すべて" : "全部分类") : (locale === "ja" ? (CAT_JA[c] || c) : c)}
          </button>
        ))}
      </div>

      {/* 游戏卡片网格 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => {
          const searchUrl = "https://space.bilibili.com/410741448/search?keyword=" + encodeURIComponent(g.name);
          const badge = CAT_STYLE[g.category] || "bg-stone-100 text-stone-700 border-stone-200";
          return (
            <div
              key={g.id}
              className="group flex flex-col justify-between rounded-2xl border border-stone-100 bg-gradient-to-br from-white to-orange-50/40 p-4 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className={"rounded-full border px-2 py-0.5 font-semibold " + badge}>
                    {locale === "ja" ? (CAT_JA[g.category] || g.category) : g.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {g.episodes && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">
                        <Sparkles className="h-3 w-3" /> {g.episodes}P
                      </span>
                    )}
                    <span className="font-mono text-stone-400">{g.firstDate}</span>
                    <button
                      type="button"
                      title={locale === "ja" ? "編集" : "编辑"}
                      onClick={() => openEdit(g)}
                      className="rounded p-1 text-stone-400 hover:bg-orange-100 hover:text-milky-600"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <h4 className="mb-1 line-clamp-1 text-sm font-bold text-stone-900 group-hover:text-milky-600">
                  {g.name}
                </h4>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-stone-500">
                  {g.videoTitle}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-end">
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-[11px] font-semibold text-milky-600 opacity-85 hover:opacity-100"
                >
                  {locale === "ja" ? "Bilibiliで探す" : "去 B 站找录像"}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-stone-900">
                {editingId
                  ? locale === "ja" ? "✏️ ゲーム記録を編集" : "✏️ 编辑游戏记录"
                  : locale === "ja" ? "🎮 プレイ済みゲームを追加" : "🎮 添加 Milky 玩过的游戏"}
              </h4>
              <button type="button" onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <input
                required
                placeholder={locale === "ja" ? "ゲーム名 *" : "游戏名 *（如 影之刃零）"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  {CATS.filter((c) => c !== "all").map((c) => (
                    <option key={c} value={c}>{locale === "ja" ? (CAT_JA[c] || c) : c}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.firstDate}
                  onChange={(e) => setForm({ ...form, firstDate: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                />
                <input
                  type="number"
                  min={1}
                  placeholder={locale === "ja" ? "話数(任意)" : "集数(选填)"}
                  value={form.episodes}
                  onChange={(e) => setForm({ ...form, episodes: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                />
              </div>
              <input
                placeholder={locale === "ja" ? "初見動画タイトル（任意）" : "初见视频标题或备注（选填）"}
                value={form.videoTitle}
                onChange={(e) => setForm({ ...form, videoTitle: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              {msg && <p className="font-medium text-milky-600">{msg}</p>}
              <div className="flex gap-2 pt-1">
                {editingId && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    {locale === "ja" ? "削除" : "删除"}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-milky-500 py-2.5 text-sm font-semibold text-white hover:bg-milky-600 disabled:opacity-50"
                >
                  {saving ? "..." : editingId ? (locale === "ja" ? "変更を保存" : "保存修改") : (locale === "ja" ? "追加する" : "添加游戏")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
