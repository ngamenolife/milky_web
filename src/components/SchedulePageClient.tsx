"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  List,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { deleteCloudSchedule, fetchCloudSchedules, isSupabaseReady, saveCloudSchedule } from "@/lib/supabaseClient";
import { downloadScheduleIcs } from "@/lib/downloadIcs";
import TopNav from "@/components/TopNav";
import type { ScheduleCategory, ScheduleItem, SchedulePlatform } from "@/lib/types";

const CAT_COLORS: Record<ScheduleCategory, string> = {
  game: "bg-amber-100 text-amber-800 border-amber-200",
  watchalong: "bg-violet-100 text-violet-800 border-violet-200",
  singing: "bg-rose-100 text-rose-700 border-rose-200",
  bilibili: "bg-sky-100 text-sky-700 border-sky-200",
  collab: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

export default function SchedulePageClient({
  initialSchedule,
}: {
  initialSchedule: ScheduleItem[];
}) {
  const { locale, t } = useLocale();
  const [items, setItems] = useState<ScheduleItem[]>(initialSchedule);

  useEffect(() => {
    if (!isSupabaseReady) return;
    fetchCloudSchedules()
      .then((cloud) => {
        if (cloud.length === 0) return;
        setItems((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const c of cloud) map.set(c.id, c);
          return Array.from(map.values());
        });
      })
      .catch(() => {});
  }, []);
  const [view, setView] = useState<"month" | "list">("month");
  const [category, setCategory] = useState<"all" | ScheduleCategory>("all");

  const defaultDate = initialSchedule[0] ? new Date(initialSchedule[0].startIso) : new Date();
  const [cursor, setCursor] = useState({
    year: defaultDate.getFullYear(),
    month: defaultDate.getMonth(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [needSecret, setNeedSecret] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "game" as ScheduleCategory,
    platform: "三台同播" as SchedulePlatform,
    startLocal: "2026-11-25T20:00",
    endLocal: "2026-11-25T22:00",
    sourceUrl: "https://x.com/MilkyVtuber",
  });

  const catLabel = (cat: ScheduleCategory) =>
    cat === "game"
      ? t.catGame
      : cat === "watchalong"
      ? t.catWatchalong
      : cat === "singing"
      ? t.catSinging
      : cat === "bilibili"
      ? t.catBilibili
      : t.catCollab;

  const patterns =
    locale === "ja"
      ? [
          {
            when: "月〜水 朝 07:30〜08:00 JST",
            content: "おはみる 朝活ソシャゲ日課・週課（原神・鳴潮・ゼンゼロ等）",
            platform: "3プラットフォーム同時",
            badge: "bg-amber-50 text-amber-800 border-amber-200",
          },
          {
            when: "火曜 夜 22:00〜23:30 JST（変動あり）",
            content: "FF14 ルーレット中心",
            platform: "Twitch限定",
            badge: "bg-purple-50 text-purple-800 border-purple-200",
          },
          {
            when: "日曜 夜 20:00〜22:00 JST",
            content: "Amazon Prime 同時視聴 (アマプラ)",
            platform: "Twitch限定",
            badge: "bg-violet-50 text-violet-800 border-violet-200",
          },
        ]
      : [
          {
            when: "周一～周三早 07:30～08:00 JST",
            content: "おはみる 早起二游日课/周课（原神/鸣潮/绝区零/终末地等）",
            platform: "三台同播",
            badge: "bg-amber-50 text-amber-800 border-amber-200",
          },
          {
            when: "周二晚 22:00～23:30 JST（偶有调整）",
            content: "FF14 随机本 (ルレ) 为主",
            platform: "仅 Twitch",
            badge: "bg-purple-50 text-purple-800 border-purple-200",
          },
          {
            when: "周日晚 20:00～22:00 JST",
            content: "Amazon Prime 同时视听 (アマプラ)",
            platform: "仅 Twitch",
            badge: "bg-violet-50 text-violet-800 border-violet-200",
          },
        ];

  const weekdays =
    locale === "ja"
      ? ["月", "火", "水", "木", "金", "土", "日"]
      : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((i) => i.category === category)),
    [items, category]
  );

  const monthItems = useMemo(() => {
    return filtered.filter((item) => {
      const d = new Date(item.startIso);
      return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
    });
  }, [filtered, cursor]);

  const stats = useMemo(() => {
    const counts: Record<ScheduleCategory, number> = {
      game: 0,
      watchalong: 0,
      singing: 0,
      bilibili: 0,
      collab: 0,
    };
    for (const i of monthItems) counts[i.category]++;
    return counts;
  }, [monthItems]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(cursor.year, cursor.month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string; events: ScheduleItem[] }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateStr: "empty-" + i, events: [] });
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = cursor.year + "-" + pad(cursor.month + 1) + "-" + pad(d);
      const dayEvents = monthItems.filter((ev) => new Date(ev.startIso).getDate() === d);
      cells.push({ day: d, dateStr, events: dayEvents });
    }
    return cells;
  }, [cursor, monthItems]);

  const shiftMonth = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const openCreate = (day?: number) => {
    setEditingId(null);
    setMsg(null);
    setNeedSecret(false);
    const pad = (n: number) => String(n).padStart(2, "0");
    const targetDay = day ?? new Date().getDate();
    const prefix = cursor.year + "-" + pad(cursor.month + 1) + "-" + pad(targetDay);
    setForm({
      title: "",
      category: "game",
      platform: "三台同播",
      startLocal: prefix + "T20:00",
      endLocal: prefix + "T22:00",
      sourceUrl: "https://x.com/MilkyVtuber",
    });
    setModalOpen(true);
  };

  const openEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setMsg(null);
    setNeedSecret(false);
    setForm({
      title: item.title,
      category: item.category,
      platform: item.platform,
      startLocal: toLocalInputValue(item.startIso),
      endLocal: toLocalInputValue(item.endIso),
      sourceUrl: item.sourceUrl ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const item: ScheduleItem = {
      id: editingId || "evt-" + Date.now(),
      title: form.title.trim(),
      category: form.category,
      platform: form.platform,
      startIso: new Date(form.startLocal).toISOString(),
      endIso: new Date(form.endLocal).toISOString(),
      sourceUrl: form.sourceUrl.trim() || undefined,
    };
    try {
      if (isSupabaseReady) {
        await saveCloudSchedule(item);
      } else {
        throw new Error("请先在 GitHub Secrets 配置 Supabase");
      }
      if (editingId) {
        setItems((prev) => prev.map((x) => (x.id === editingId ? item : x)));
      } else {
        setItems((prev) => [item, ...prev]);
      }
      setMsg("✅ 已同步保存至云端！");
      setTimeout(() => setModalOpen(false), 600);
    } catch (err) {
      setMsg("❌ " + (err instanceof Error ? err.message : "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !window.confirm(locale === "ja" ? "この予定を削除しますか？" : "确定要删除这条日程吗？")) return;
    setSaving(true);
    try {
      if (isSupabaseReady) await deleteCloudSchedule(editingId);
      setItems((prev) => prev.filter((x) => x.id !== editingId));
      setModalOpen(false);
    } catch (err) {
      setMsg("❌ " + (err instanceof Error ? err.message : "删除失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <TopNav />

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-milky-500" />
            <h2 className="text-sm font-bold text-stone-900">{t.calPatternTitle}</h2>
          </div>
          <a
            href="https://x.com/MilkyVtuber"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t.calGoX}
          </a>
        </div>
        <div className="grid gap-2.5 md:grid-cols-3">
          {patterns.map((p) => (
            <div key={p.when} className={"rounded-2xl border p-3 text-xs " + p.badge}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold">{p.when}</span>
                <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                  {p.platform}
                </span>
              </div>
              <p className="opacity-90">{p.content}</p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] text-stone-400">{t.calPatternNote}</p>
      </section>

      <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">{t.calTitle}</h1>
            <p className="text-xs text-stone-500">{t.calSub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center gap-1 rounded-xl bg-milky-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-milky-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.calAddBtn}
            </button>
            <button
              type="button"
              onClick={() => downloadScheduleIcs(items)}
              className="inline-flex items-center gap-1 rounded-xl border border-orange-200 bg-milky-50 px-3.5 py-2 text-xs font-semibold text-milky-600 hover:bg-milky-100"
            >
              <Download className="h-3.5 w-3.5" />
              {t.btnIcs}
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(CAT_COLORS) as ScheduleCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory((prev) => (prev === cat ? "all" : cat))}
              className={
                "flex items-center justify-between rounded-2xl border p-3 text-left transition " +
                (category === cat ? "ring-2 ring-milky-500 " : "") +
                CAT_COLORS[cat]
              }
            >
              <span className="text-xs font-semibold">{catLabel(cat)}</span>
              <span className="text-lg font-extrabold">{stats[cat]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[110px] text-center text-sm font-bold text-stone-900">
              {cursor.year} / {cursor.month + 1}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
              }}
              className="ml-1 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
            >
              {t.calTodayBtn}
            </button>
          </div>

          <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setView("month")}
              className={
                "inline-flex items-center gap-1 rounded-lg px-3 py-1 " +
                (view === "month" ? "bg-white text-milky-600 shadow-sm" : "text-stone-600")
              }
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {t.calViewMonth}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={
                "inline-flex items-center gap-1 rounded-lg px-3 py-1 " +
                (view === "list" ? "bg-white text-milky-600 shadow-sm" : "text-stone-600")
              }
            >
              <List className="h-3.5 w-3.5" />
              {t.calViewList}
            </button>
          </div>
        </div>
      </section>

      {view === "month" ? (
        <section className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
          <div className="min-w-[640px]">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-bold text-stone-500">
              {weekdays.map((w) => (
                <div key={w} className="py-1">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell) => (
                <div
                  key={cell.dateStr}
                  className={
                    "min-h-[108px] rounded-2xl border p-2 transition " +
                    (cell.day ? "border-stone-100 bg-stone-50/50 hover:border-orange-200" : "border-transparent")
                  }
                >
                  {cell.day && (
                    <>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700">{cell.day}</span>
                        <button
                          type="button"
                          onClick={() => openCreate(cell.day!)}
                          className="rounded p-0.5 text-stone-400 hover:bg-orange-100 hover:text-milky-600"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {cell.events.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEdit(ev)}
                            className={
                              "block w-full truncate rounded-lg border px-1.5 py-1 text-left text-[11px] font-medium hover:opacity-85 " +
                              CAT_COLORS[ev.category]
                            }
                            title={ev.title + " (" + ev.platform + ")"}
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {filtered.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-orange-100"
            >
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={"rounded-full border px-2 py-0.5 font-semibold " + CAT_COLORS[ev.category]}>
                    {catLabel(ev.category)}
                  </span>
                  <span className="rounded bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                    {ev.platform}
                  </span>
                  <span className="font-mono text-stone-400">
                    {new Date(ev.startIso).toLocaleString(locale === "ja" ? "ja-JP" : "zh-CN", { hour12: false })}
                  </span>
                </div>
                <p className="font-bold text-stone-900">{ev.title}</p>
              </div>
              <div className="flex items-center gap-2">
                {ev.sourceUrl && (
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.calOrigPost}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(ev)}
                  className="inline-flex items-center gap-1 rounded-lg bg-milky-50 px-2.5 py-1.5 text-xs font-semibold text-milky-600 ring-1 ring-orange-200 hover:bg-milky-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t.jbEditBtn}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-stone-900">
                {editingId ? t.calModalEdit : t.calModalCreate}
              </h4>
              <button type="button" onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <input
                required
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ScheduleCategory })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  <option value="game">{t.catGame}</option>
                  <option value="watchalong">{t.catWatchalong}</option>
                  <option value="singing">{t.catSinging}</option>
                  <option value="bilibili">{t.catBilibili}</option>
                  <option value="collab">{t.catCollab}</option>
                </select>
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value as SchedulePlatform })}
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
                    value={form.startLocal}
                    onChange={(e) => setForm({ ...form, startLocal: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-stone-500">{t.calEnd}</span>
                  <input
                    type="datetime-local"
                    required
                    value={form.endLocal}
                    onChange={(e) => setForm({ ...form, endLocal: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-2 py-1.5"
                  />
                </label>
              </div>
              <input
                placeholder="https://x.com/MilkyVtuber"
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              {needSecret && (
                <input
                  type="password"
                  placeholder="🔒 ADMIN_SECRET"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2"
                />
              )}
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
                    {t.jbDelete}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-milky-500 py-2.5 text-sm font-semibold text-white hover:bg-milky-600"
                >
                  {editingId ? t.jbSave : t.calAddBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
