"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Heart,
  ListMusic,
  Music,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { deleteCloudSong, fetchCloudSongs, isSupabaseReady, saveCloudSong } from "@/lib/supabaseClient";
import {
  buildBiliEmbedUrl,
  groupSongsByTitle,
  parseTimeToSec,
  type SongItem,
  type SongLang,
  type UnindexedStream,
} from "@/lib/songs";

const GENRES = [
  "all",
  "歌单",
  "推荐",
  "动漫",
  "游戏",
  "燃曲",
  "治愈",
  "Vocaloid",
  "抒情",
  "J-POP",
  "趣味",
  "原创",
  "特摄",
  "收藏夹",
] as const;

const GENRE_JA: Record<string, string> = {
  all: "すべて",
  歌单: "📋 歌リスト",
  推荐: "⭐ おすすめ",
  动漫: "アニメ",
  游戏: "ゲーム",
  燃曲: "熱い曲",
  治愈: "癒やし",
  Vocaloid: "ボカロ",
  抒情: "バラード",
  "J-POP": "J-POP",
  趣味: "ネタ曲",
  原创: "オリジナル",
  特摄: "特撮",
  收藏夹: "❤️ お気に入り",
};

interface Props {
  initialSongs: SongItem[];
  initialUnindexed: UnindexedStream[];
}

export default function Jukebox({ initialSongs, initialUnindexed }: Props) {
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<"songs" | "streams">("songs");
  const [songs, setSongs] = useState<SongItem[]>(initialSongs);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [current, setCurrent] = useState<SongItem | null>(initialSongs[0] ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [needSecretPrompt, setNeedSecretPrompt] = useState(false);
  const [form, setForm] = useState({
    title: "",
    artist: "",
    language: "ja" as SongLang,
    genre: "歌单",
    tagsText: "歌单",
    bvid: "",
    page: 1,
    startTime: "",
    date: new Date().toISOString().slice(0, 10),
    streamTitle: "",
    contributor: "",
  });
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady) return;
    fetchCloudSongs()
      .then((cloud) => {
        if (cloud.length === 0) return;
        setSongs((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const c of cloud) map.set(c.id, c);
          return Array.from(map.values());
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("milky_favorites") || "[]");
      if (Array.isArray(saved)) setFavorites(saved);
    } catch {}
  }, []);

  const toggleFavorite = (title: string) => {
    setFavorites((prev) => {
      const next = prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title];
      try {
        localStorage.setItem("milky_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const copyRequest = (song: SongItem) => {
    const text = (locale === "ja" ? "リクエスト " : "点歌 ") + song.title;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(song.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter((s) => {
      const okGenre =
        genre === "all"
          ? true
          : genre === "收藏夹"
          ? favorites.includes(s.title)
          : genre === "歌单"
          ? s.tags.includes("歌单") || !s.bvid
          : genre === "推荐"
          ? s.tags.includes("推荐")
          : s.genre === genre;
      const okQ =
        !q ||
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.artist ?? "").toLowerCase().includes(q) ||
        (s.streamTitle ?? "").toLowerCase().includes(q);
      return okGenre && okQ;
    });
  }, [songs, query, genre, favorites]);

  const groups = useMemo(() => groupSongsByTitle(filteredSongs), [filteredSongs]);

  const currentGroup = useMemo(() => {
    if (!current) return [];
    const key = current.title.trim().toLowerCase();
    return songs.filter((s) => s.title.trim().toLowerCase() === key);
  }, [songs, current]);

  const pickRandom = () => {
    const pool = filteredSongs.length > 0 ? filteredSongs : songs;
    const candidates = pool.filter((s) => s.id !== current?.id);
    const list = candidates.length > 0 ? candidates : pool;
    const picked = list[Math.floor(Math.random() * list.length)];
    if (picked) setCurrent(picked);
  };

  const openCreateModal = (stream?: UnindexedStream) => {
    setEditingId(null);
    setSubmitMsg(null);
    setNeedSecretPrompt(false);
    setForm({
      title: "",
      artist: "",
      language: "ja",
      genre: stream ? "动漫" : "歌单",
      tagsText: stream ? "" : "歌单",
      bvid: stream?.bvid ?? "",
      page: 1,
      startTime: stream ? "00:00" : "",
      date: stream?.date ?? new Date().toISOString().slice(0, 10),
      streamTitle: stream?.streamTitle ?? "",
      contributor: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (song: SongItem) => {
    setEditingId(song.id);
    setSubmitMsg(null);
    setNeedSecretPrompt(false);
    setForm({
      title: song.title,
      artist: song.artist,
      language: song.language,
      genre: song.genre,
      tagsText: song.tags.join(", "),
      bvid: song.bvid ?? "",
      page: song.page ?? 1,
      startTime: song.startTime ?? "",
      date: song.date,
      streamTitle: song.streamTitle,
      contributor: song.contributor ?? "",
    });
    setModalOpen(true);
  };

  const handleSaveSong = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg(null);
    const bvid = form.bvid.trim();
    const tags = form.tagsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!bvid && !tags.includes("歌单")) tags.push("歌单");

    const item: SongItem = {
      id: editingId || "song-" + Date.now(),
      title: form.title.trim(),
      artist: form.artist.trim() || "待补充",
      language: form.language,
      genre: form.genre.trim() || "歌单",
      tags,
      bvid: bvid || undefined,
      page: Number(form.page) > 0 ? Number(form.page) : 1,
      startTime: form.startTime.trim() || (bvid ? "00:00" : ""),
      date: form.date || new Date().toISOString().slice(0, 10),
      streamTitle: form.streamTitle.trim() || (bvid ? "粉丝贡献时间轴" : "点歌单收录"),
      contributor: form.contributor.trim() || "匿名粉丝",
    };

    try {
      if (isSupabaseReady) {
        await saveCloudSong(item);
      } else {
        throw new Error("请先在 GitHub Secrets 配置 Supabase");
      }
      if (editingId) {
        setSongs((prev) => prev.map((s) => (s.id === editingId ? item : s)));
      } else {
        setSongs((prev) => [item, ...prev]);
      }
      setCurrent(item);
      setSubmitMsg("✅ 已同步保存至云端！");
      setTimeout(() => setModalOpen(false), 600);
    } catch (err) {
      setSubmitMsg("❌ " + (err instanceof Error ? err.message : "保存失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!editingId || !window.confirm(locale === "ja" ? "この曲を削除しますか？" : "确定要从歌台删除这首歌吗？")) return;
    setSubmitting(true);
    try {
      if (isSupabaseReady) await deleteCloudSong(editingId);
      const remaining = songs.filter((s) => s.id !== editingId);
      setSongs(remaining);
      if (current?.id === editingId) setCurrent(remaining[0] ?? null);
      setModalOpen(false);
    } catch (err) {
      setSubmitMsg("❌ " + (err instanceof Error ? err.message : "删除失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const hasBvid = Boolean(current?.bvid && current.bvid.trim());
  const startSec = current ? parseTimeToSec(current.startTime) : 0;
  const embedUrl =
    current && hasBvid ? buildBiliEmbedUrl(current.bvid!, startSec, current.page ?? 1) : "";
  const biliJumpUrl =
    current && hasBvid
      ? "https://www.bilibili.com/video/" + current.bvid + "?p=" + (current.page ?? 1) + "&t=" + startSec
      : "#";

  const genreLabel = (g: string) => {
    if (locale === "ja") {
      if (g === "收藏夹") return "❤️ お気に入り(" + favorites.length + ")";
      return GENRE_JA[g] ?? g;
    }
    if (g === "all") return "全部";
    if (g === "歌单") return "📋 歌单";
    if (g === "推荐") return "⭐ 推荐";
    if (g === "收藏夹") return "❤️ 收藏(" + favorites.length + ")";
    return g;
  };

  return (
    <section id="jukebox" className="mb-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100 overflow-hidden">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-milky-100 text-milky-600">
            <Music className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-bold text-stone-900">{t.jbTitle}</h3>
            <p className="text-xs text-stone-500">
              {songs.length} {t.jbSubPrefix}
              {initialUnindexed.length} {t.jbSubMid}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-semibold">
            <button
              type="button"
              data-testid="tab-songs"
              onClick={() => setTab("songs")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (tab === "songs" ? "bg-white text-milky-600 shadow-sm" : "text-stone-600")
              }
            >
              🎵 {t.jbTabSongs} ({songs.length})
            </button>
            <button
              type="button"
              data-testid="tab-streams"
              onClick={() => setTab("streams")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (tab === "streams" ? "bg-white text-milky-600 shadow-sm" : "text-stone-600")
              }
            >
              📼 {t.jbTabStreams} ({initialUnindexed.length})
            </button>
          </div>

          <button
            type="button"
            data-testid="jukebox-random"
            onClick={pickRandom}
            className="inline-flex items-center gap-1.5 rounded-xl bg-milky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-milky-600"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {t.jbRandom}
          </button>

          <button
            type="button"
            data-testid="open-add-song"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1 rounded-xl border border-milky-400 bg-milky-50 px-3 py-2 text-xs font-semibold text-milky-600 hover:bg-milky-100"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.jbAddBtn}
          </button>
        </div>
      </div>

      {tab === "songs" && current ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            {hasBvid ? (
              <>
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-900 shadow-inner">
                <iframe
                  key={current.id + "-" + current.bvid + "-" + current.startTime}
                  data-testid="jukebox-iframe"
                  src={embedUrl}
                  title={current.title}
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200 sm:hidden">
                  {locale === "ja"
                    ? "📱 スマホではBilibiliの制限で再生できない場合があります。下の「B站原片」からアプリで開くか、ブラウザの「PC版サイト」を有効にしてください"
                    : "📱 手机端易触发 B 站风控，如无法播放请点下方「B站原片」跳 App，或开启浏览器「桌面版网站」即可站内播放"}
                </p>
              </>
            ) : (
              /* 无 BV 号的纯点歌单卡片 */
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-milky-50 to-orange-100/70 p-6 text-center ring-1 ring-orange-200">
                <ListMusic className="mb-3 h-10 w-10 text-milky-500" />
                <p className="mb-1 text-base font-bold text-stone-900">{t.jbNoBvidTitle}</p>
                <p className="mb-4 max-w-md text-xs text-stone-600">{t.jbNoBvidDesc}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyRequest(current)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-milky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-milky-600"
                  >
                    {copiedId === current.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === current.id ? t.jbCopied : t.jbCopyReq}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(current)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-milky-600 ring-1 ring-orange-200 hover:bg-orange-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.jbAddBvidBtn}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-2xl bg-milky-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p data-testid="now-playing-title" className="text-base font-bold text-stone-900">
                    {current.title}
                  </p>
                  <p className="text-xs text-stone-600">
                    {t.jbOrigArtist}：{current.artist} · {current.genre} · {current.date}
                    {hasBvid && current.startTime ? " · " + t.jbJumpAt + " " + current.startTime : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyRequest(current)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-orange-50"
                  >
                    {copiedId === current.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === current.id ? t.jbCopied : t.jbCopyReq}
                  </button>
                  <button
                    type="button"
                    data-testid="edit-current-song"
                    onClick={() => openEditModal(current)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-orange-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.jbEditBtn}
                  </button>
                  <button
                    type="button"
                    data-testid="fav-current"
                    onClick={() => toggleFavorite(current.title)}
                    className={
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 " +
                      (favorites.includes(current.title)
                        ? "bg-rose-500 text-white ring-rose-500"
                        : "bg-white text-stone-600 ring-stone-200 hover:bg-rose-50")
                    }
                  >
                    <Heart className="h-3.5 w-3.5" />
                    {favorites.includes(current.title) ? t.jbFaved : t.jbFav}
                  </button>
                  {hasBvid && (
                    <a
                      href={biliJumpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-milky-600 ring-1 ring-orange-200 hover:bg-orange-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t.jbBiliOrig}
                    </a>
                  )}
                  {current.coverBvid && (
                    <a
                      href={"https://www.bilibili.com/video/" + current.coverBvid}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t.jbCoverVer}
                    </a>
                  )}
                </div>
              </div>

              {currentGroup.length > 1 && (
                <div className="mt-3 border-t border-orange-200/60 pt-2.5">
                  <p className="mb-1.5 text-xs font-semibold text-stone-600">
                    🎙️ {t.jbVersionsHint}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentGroup.map((ver, idx) => (
                      <button
                        key={ver.id}
                        type="button"
                        onClick={() => setCurrent(ver)}
                        className={
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition " +
                          (ver.id === current.id
                            ? "bg-milky-500 text-white"
                            : "bg-white text-stone-700 ring-1 ring-orange-200 hover:bg-orange-100")
                        }
                      >
                        #{idx + 1} · {ver.date} {ver.tags.length > 0 ? "(" + ver.tags.join("/") + ")" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-3 lg:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="search"
                data-testid="jukebox-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.jbSearchPh}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs focus:border-milky-400 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  data-testid={"genre-" + g}
                  onClick={() => setGenre(g)}
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-medium transition " +
                    (genre === g
                      ? "bg-milky-500 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-orange-100")
                  }
                >
                  {genreLabel(g)}
                </button>
              ))}
            </div>

            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {groups.map((grp) => {
                const primary = grp.versions[0];
                const isActive = (current.title ?? "").toLowerCase() === (grp.title ?? "").toLowerCase();
                return (
                  <button
                    key={grp.title}
                    type="button"
                    data-testid={"song-group-" + primary.id}
                    onClick={() => setCurrent(primary)}
                    className={
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition " +
                      (isActive
                        ? "bg-milky-100 text-milky-600 ring-1 ring-milky-400"
                        : "bg-stone-50 text-stone-700 hover:bg-orange-50")
                    }
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{grp.title}</p>
                        {grp.tags.includes("推荐") && (
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}
                      </div>
                      <p className="truncate text-xs text-stone-500">
                        {grp.artist} · {grp.genre}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {grp.versions.length > 1 && (
                        <span className="rounded bg-orange-200/70 px-1.5 py-0.5 text-[10px] font-bold text-milky-600">
                          {grp.versions.length} ver
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-mono text-xs text-stone-500">
                        {primary.bvid ? (
                          <>
                            <Play className="h-3 w-3 fill-current" />
                            {primary.startTime || "00:00"}
                          </>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-sans text-amber-800">
                            {locale === "ja" ? "歌リスト" : "歌单"}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
              {groups.length === 0 && (
                <p className="py-8 text-center text-xs text-stone-400">{t.jbEmpty}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialUnindexed.map((st) => (
            <div
              key={st.bvid}
              className="flex flex-col justify-between rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/80"
            >
              <div>
                <div className="mb-1.5 flex min-w-0 items-center justify-between text-xs text-stone-500">
                  <span className="font-mono">{st.bvid}</span>
                  <span>{st.date}</span>
                </div>
                <p className="mb-3 line-clamp-2 text-sm font-semibold text-stone-800">
                  {st.streamTitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={"https://www.bilibili.com/video/" + st.bvid}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t.jbWatchOrig}
                </a>
                <button
                  type="button"
                  onClick={() => openCreateModal(st)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-milky-500 py-1.5 text-xs font-semibold text-white hover:bg-milky-600"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t.jbHelpTime}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl overflow-hidden">
            <div className="mb-4 flex min-w-0 items-center justify-between">
              <h4 className="text-lg font-bold text-stone-900">
                {editingId ? t.jbModalEdit : t.jbModalCreate}
              </h4>
              <button type="button" onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSong} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  data-testid="input-song-title"
                  placeholder={locale === "ja" ? "曲名 *（これだけでもOK）" : "歌名 *（仅填此项即可入歌单）"}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-xl border border-stone-200 px-3 py-2"
                />
                <input
                  placeholder={locale === "ja" ? "アーティスト（任意）" : "原唱（选填）"}
                  value={form.artist}
                  onChange={(e) => setForm({ ...form, artist: e.target.value })}
                  className="rounded-xl border border-stone-200 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  data-testid="input-song-bvid"
                  placeholder={locale === "ja" ? "BV番号（任意・空欄で歌リスト）" : "BV号（选填，留空自动进歌单）"}
                  value={form.bvid}
                  onChange={(e) => setForm({ ...form, bvid: e.target.value })}
                  className="col-span-2 rounded-xl border border-stone-200 px-3 py-2 font-mono"
                />
                <input
                  data-testid="input-song-time"
                  placeholder={locale === "ja" ? "開始 12:35（任意）" : "空降 12:35（选填）"}
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="rounded-xl border border-stone-200 px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  {["歌单", "动漫", "游戏", "燃曲", "治愈", "Vocaloid", "抒情", "J-POP", "趣味", "原创", "特摄", "其他"].map((g) => (
                    <option key={g} value={g}>{locale === "ja" ? (GENRE_JA[g] ?? g) : g}</option>
                  ))}
                </select>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value as SongLang })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                >
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="rounded-xl border border-stone-200 px-2 py-2"
                />
              </div>
              <input
                placeholder={locale === "ja" ? "タグ（カンマ区切り：歌单, 推荐, 清唱）" : "标签（逗号分隔，如：歌单, 推荐, 清唱）"}
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              <input
                placeholder={locale === "ja" ? "配信タイトル（任意）" : "来源歌回标题（选填）"}
                value={form.streamTitle}
                onChange={(e) => setForm({ ...form, streamTitle: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2"
              />
              {needSecretPrompt && (
                <input
                  type="password"
                  placeholder="🔒 ADMIN_SECRET"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2"
                />
              )}

              {submitMsg && <p className="font-medium text-milky-600">{submitMsg}</p>}

              <div className="flex gap-2 pt-1">
                {editingId && (
                  <button
                    type="button"
                    disabled={submitting}
                    data-testid="delete-song-btn"
                    onClick={handleDeleteSong}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.jbDelete}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="submit-song-btn"
                  className="flex-1 rounded-xl bg-milky-500 py-2.5 text-sm font-semibold text-white hover:bg-milky-600 disabled:opacity-50"
                >
                  {editingId ? t.jbSave : t.jbSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
