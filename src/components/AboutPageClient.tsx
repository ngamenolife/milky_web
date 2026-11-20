"use client";

import { useState } from "react";
import {
  ExternalLink,
  Film,
  Gamepad2,
  Heart,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import TopNav from "@/components/TopNav";
import type { FeaturedVideo } from "@/lib/featured";
import { buildBiliEmbedUrl } from "@/lib/songs";

const OFFICIAL_LINKS = [
  { name: "Bilibili", url: "https://space.bilibili.com/410741448", desc: "space.bilibili.com/410741448" },
  { name: "YouTube", url: "https://www.youtube.com/channel/UCBJPNd_nAzGkXdL4Wy87ADg", desc: "@milkytube0411" },
  { name: "X (Twitter)", url: "https://x.com/MilkyVtuber", desc: "@MilkyVtuber" },
  { name: "OPENREC.tv", url: "https://www.openrec.tv/user/milky0411", desc: "openrec.tv/user/milky0411" },
  { name: "Marshmallow", url: "https://marshmallow-qa.com/mirukyichubu", desc: "marshmallow-qa.com/mirukyichubu" },
  { name: "PIXIV FANBOX", url: "https://www.pixiv.net/fanbox/creator/38159795", desc: "pixiv.net/fanbox/creator/38159795" },
];

export default function AboutPageClient({
  initialVideos,
}: {
  initialVideos: FeaturedVideo[];
}) {
  const { locale, t } = useLocale();
  const [videos, setVideos] = useState<FeaturedVideo[]>(initialVideos);
  const [current, setCurrent] = useState<FeaturedVideo | null>(initialVideos[0] ?? null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [needSecret, setNeedSecret] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    bvid: "",
    page: 1,
    tag: "粉丝安利",
    reason: "",
    contributor: "",
  });

  const openCreate = () => {
    setEditingId(null);
    setMsg(null);
    setNeedSecret(false);
    setForm({ title: "", bvid: "", page: 1, tag: "粉丝安利", reason: "", contributor: "" });
    setModalOpen(true);
  };

  const openEdit = (v: FeaturedVideo) => {
    setEditingId(v.id);
    setMsg(null);
    setNeedSecret(false);
    setForm({
      title: v.title,
      bvid: v.bvid,
      page: v.page ?? 1,
      tag: v.tag,
      reason: v.reason,
      contributor: v.contributor,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminSecret.trim()) headers["x-admin-secret"] = adminSecret.trim();
      const res = await fetch("/api/featured-videos", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json();
      if (res.status === 401) {
        setNeedSecret(true);
        setMsg("🔒 " + (data.error || "Unauthorized"));
        return;
      }
      if (!res.ok) {
        setMsg("❌ " + (data.error || "Error"));
        return;
      }
      if (editingId) {
        setVideos((prev) => prev.map((x) => (x.id === editingId ? data.item : x)));
      } else {
        setVideos((prev) => [...prev, data.item]);
      }
      setCurrent(data.item);
      setMsg("✅ OK!");
      setTimeout(() => setModalOpen(false), 600);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !window.confirm(locale === "ja" ? "この動画を削除しますか？" : "确定移除这个视频吗？")) return;
    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      if (adminSecret.trim()) headers["x-admin-secret"] = adminSecret.trim();
      const res = await fetch("/api/featured-videos?id=" + encodeURIComponent(editingId), {
        method: "DELETE",
        headers,
      });
      if (res.status === 401) {
        setNeedSecret(true);
        return;
      }
      if (!res.ok) return;
      const next = videos.filter((x) => x.id !== editingId);
      setVideos(next);
      if (current?.id === editingId) setCurrent(next[0] ?? null);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <TopNav />

      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100 md:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-orange-100 pb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-milky-500">
              {t.abBadge}
            </p>
            <h1 className="text-3xl font-extrabold text-stone-900">
              みるきぃ / Milky_Vtuber <span className="text-2xl">🌟🐾</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-milky-600">{t.catchphrase}</p>
          </div>
          <a
            href="https://twpf.jp/MilkyVtuber"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-milky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-milky-600"
          >
            <ExternalLink className="h-4 w-4" />
            {t.abOrigBtn}
          </a>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-milky-50/70 p-4">
            <p className="text-xs text-stone-500">{t.abRaceLabel}</p>
            <p className="mt-1 font-bold text-stone-900">{t.abRaceVal}</p>
          </div>
          <div className="rounded-2xl bg-milky-50/70 p-4">
            <p className="text-xs text-stone-500">{t.abParentsLabel}</p>
            <p className="mt-1 font-bold text-stone-900">{t.abParentsVal}</p>
          </div>
          <div className="rounded-2xl bg-milky-50/70 p-4">
            <p className="text-xs text-stone-500">{t.abFanLabel}</p>
            <p className="mt-1 font-bold text-stone-900">{t.abFanVal}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs text-stone-500">{t.abTagsLabel}</p>
            <p className="mt-1 font-semibold text-stone-800">{t.abTagsVal}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs text-stone-500">{t.abSkillLabel}</p>
            <p className="mt-1 font-semibold text-stone-800">{t.abSkillVal}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs text-stone-500">{t.abDebutLabel}</p>
            <p className="mt-1 font-semibold text-stone-800">{t.abDebutVal}</p>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-milky-100 text-milky-600">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{t.abVideoTitle}</h2>
              <p className="text-xs text-stone-500">{t.abVideoSub}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-xl bg-milky-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-milky-600"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.abVideoAdd}
          </button>
        </div>

        {current && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-900 shadow-inner">
                <iframe
                  key={current.id + "-" + current.bvid}
                  src={buildBiliEmbedUrl(current.bvid, 0, current.page ?? 1)}
                  title={current.title}
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-2xl bg-milky-50 p-4">
                <div>
                  <p className="text-sm font-bold text-stone-900">{current.title}</p>
                  <p className="mt-1 text-xs text-stone-600">
                    {t.abReasonLabel}
                    {current.reason} · {t.abContribLabel}
                    {current.contributor}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(current)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-orange-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.jbEditBtn}
                  </button>
                  <a
                    href={"https://www.bilibili.com/video/" + current.bvid}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-milky-600 ring-1 ring-orange-200 hover:bg-orange-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.jbBiliOrig}
                  </a>
                </div>
              </div>
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1 lg:col-span-2">
              {videos.map((v) => {
                const active = v.id === current.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setCurrent(v)}
                    className={
                      "flex w-full items-start justify-between rounded-xl p-3 text-left transition " +
                      (active
                        ? "bg-milky-100 text-milky-600 ring-1 ring-milky-400"
                        : "bg-stone-50 text-stone-700 hover:bg-orange-50")
                    }
                  >
                    <div className="min-w-0 pr-2">
                      <span className="mb-1 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-milky-600 ring-1 ring-orange-200">
                        {v.tag}
                      </span>
                      <p className="line-clamp-2 text-sm font-semibold">{v.title}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">{v.reason}</p>
                    </div>
                    <Play className="mt-1 h-4 w-4 shrink-0 fill-current text-stone-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-stone-900">
            <Sparkles className="h-5 w-5 text-milky-500" />
            {t.abLoreTitle}
          </h2>
          <blockquote className="space-y-3 border-l-4 border-milky-400 pl-4 text-sm leading-relaxed text-stone-700">
            <p>{t.abLoreP1}</p>
            <p>{t.abLoreP2}</p>
          </blockquote>

          <div className="mt-5 space-y-2.5 text-xs text-stone-600">
            <p className="flex items-start gap-2">
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{t.abFood}</span>
            </p>
            <p className="flex items-start gap-2">
              <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>{t.abGames}</span>
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-stone-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            {t.abGuideTitle}
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-stone-600">
            <li>• {t.abGuide1}</li>
            <li>• {t.abGuide2}</li>
            <li>• {t.abGuide3}</li>
            <li>• {t.abGuide4}</li>
            <li>• {t.abGuide5}</li>
          </ul>
          <div className="mt-5 border-t border-stone-100 pt-4">
            <a
              href="https://twpf.jp/MilkyVtuber"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-milky-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.abReadOrig}
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
        <h2 className="mb-4 text-lg font-bold text-stone-900">{t.abLinksTitle}</h2>
        <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICIAL_LINKS.map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs transition hover:bg-milky-50"
            >
              <div>
                <p className="font-bold text-stone-800">{item.name}</p>
                <p className="text-stone-400">{item.desc}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-stone-400" />
            </a>
          ))}
        </div>

        <div className="border-t border-stone-100 pt-4 text-xs text-stone-500">
          <p className="mb-1 font-bold text-stone-700">{t.abSiteTitle}</p>
          <p>{t.abSiteDesc}</p>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-stone-900">
                {editingId ? t.jbEditBtn : t.abVideoAdd}
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
              <div className="grid grid-cols-3 gap-2">
                <input
                  required
                  placeholder="BV1ab411x7FA *"
                  value={form.bvid}
                  onChange={(e) => setForm({ ...form, bvid: e.target.value })}
                  className="col-span-2 rounded-xl border border-stone-200 px-3 py-2 font-mono"
                />
                <input
                  placeholder="Tag"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                />
              </div>
              <textarea
                rows={2}
                placeholder={t.abReasonLabel}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              <input
                placeholder={t.abContribLabel}
                value={form.contributor}
                onChange={(e) => setForm({ ...form, contributor: e.target.value })}
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
                  {editingId ? t.jbSave : t.abVideoAdd}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
