import type { SongItem, SongLang } from "@/lib/songs";
import type { ScheduleCategory, ScheduleItem, SchedulePlatform } from "@/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseReady = Boolean(URL && KEY);

const PASSCODE_KEY = "milky_edit_passcode";

function getEditPasscode(): string {
  if (typeof window === "undefined") return "";
  let code = window.localStorage.getItem(PASSCODE_KEY) || "";
  if (!code) {
    const isJa = window.localStorage.getItem("milky-locale") === "ja";
    const input = window.prompt(
      isJa
        ? "🔑 みるきぃのニックネームは？（1回入力すれば保存されます）："
        : "🔑 milky的昵称是啥？（输对一次后自动记住）："
    );
    if (!input || !input.trim()) {
      throw new Error(isJa ? "暗号の入力がキャンセルされました" : "已取消提交（未输入暗号）");
    }
    code = input.trim();
    window.localStorage.setItem(PASSCODE_KEY, code);
  }
  return code;
}

async function sbFetch(
  table: string,
  method: string,
  query = "",
  body?: unknown,
  extraHeaders: Record<string, string> = {}
) {
  if (!isSupabaseReady) {
    throw new Error("请先在 GitHub Secrets 配置 Supabase");
  }
  const headers: Record<string, string> = {
    apikey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""),
    Authorization: `Bearer ${(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (method !== "GET") {
    headers["x-client-info"] = encodeURIComponent(getEditPasscode());
  }
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    if (method !== "GET" && (res.status === 401 || res.status === 403 || txt.includes("42501") || txt.includes("row-level security"))) {
      if (typeof window !== "undefined") window.localStorage.removeItem(PASSCODE_KEY);
      const isJa = typeof window !== "undefined" && window.localStorage.getItem("milky-locale") === "ja";
      throw new Error(isJa ? "暗号が違います。もう一度送信して正しい暗号を入力してください" : "暗号错误！已清除缓存，请重新点提交并输入正确暗号");
    }
    throw new Error(txt || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function fetchCloudSongs(): Promise<SongItem[]> {
  if (!isSupabaseReady) return [];
  const rows = (await sbFetch("songs", "GET", "?order=created_at.desc")) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title || ""),
    artist: String(r.artist || "待补充"),
    language: (r.language === "zh" || r.language === "en" ? r.language : "ja") as SongLang,
    genre: String(r.genre || "歌单"),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    bvid: r.bvid ? String(r.bvid) : undefined,
    coverBvid: r.cover_bvid ? String(r.cover_bvid) : undefined,
    page: Number(r.page) || 1,
    startTime: r.start_time ? String(r.start_time) : "",
    date: String(r.date || ""),
    streamTitle: String(r.stream_title || ""),
    contributor: r.contributor ? String(r.contributor) : undefined,
  }));
}

export async function saveCloudSong(song: SongItem): Promise<SongItem> {
  await sbFetch(
    "songs",
    "POST",
    "?on_conflict=id",
    {
      id: song.id,
      title: song.title,
      artist: song.artist,
      language: song.language,
      genre: song.genre,
      tags: song.tags,
      bvid: song.bvid || null,
      cover_bvid: song.coverBvid || null,
      page: song.page || 1,
      start_time: song.startTime || "",
      date: song.date,
      stream_title: song.streamTitle,
      contributor: song.contributor || "匿名粉丝",
    },
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  return song;
}

export async function deleteCloudSong(id: string): Promise<void> {
  await sbFetch("songs", "DELETE", `?id=eq.${encodeURIComponent(id)}`);
}

export async function fetchCloudSchedules(): Promise<ScheduleItem[]> {
  if (!isSupabaseReady) return [];
  const rows = (await sbFetch("schedules", "GET", "?order=start_iso.asc")) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title || ""),
    category: (r.category || "game") as ScheduleCategory,
    platform: (r.platform || "三台同播") as SchedulePlatform,
    startIso: String(r.start_iso),
    endIso: String(r.end_iso),
    sourceUrl: r.source_url ? String(r.source_url) : undefined,
  }));
}

export async function saveCloudSchedule(item: ScheduleItem): Promise<ScheduleItem> {
  await sbFetch(
    "schedules",
    "POST",
    "?on_conflict=id",
    {
      id: item.id,
      title: item.title,
      category: item.category,
      platform: item.platform,
      start_iso: item.startIso,
      end_iso: item.endIso,
      source_url: item.sourceUrl || null,
    },
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  return item;
}

export async function deleteCloudSchedule(id: string): Promise<void> {
  await sbFetch("schedules", "DELETE", `?id=eq.${encodeURIComponent(id)}`);
}

export interface GameEntry {
  id: string;
  name: string;
  nameJa?: string;
  firstDate: string;
  year: number;
  category: string;
  videoTitle: string;
  episodes?: number;
}

export async function fetchCloudGames(): Promise<GameEntry[]> {
  if (!isSupabaseReady) return [];
  const rows = (await sbFetch("games", "GET", "?order=first_date.desc")) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name || ""),
    firstDate: String(r.first_date || ""),
    year: Number(r.year) || new Date().getFullYear(),
    category: String(r.category || "模拟/休闲"),
    videoTitle: String(r.video_title || ""),
    episodes: r.episodes ? Number(r.episodes) : undefined,
  }));
}

export async function saveCloudGame(game: GameEntry): Promise<GameEntry> {
  await sbFetch(
    "games",
    "POST",
    "?on_conflict=id",
    {
      id: game.id,
      name: game.name,
      first_date: game.firstDate,
      year: game.year,
      category: game.category,
      video_title: game.videoTitle,
      episodes: game.episodes ?? null,
    },
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  return game;
}

export async function deleteCloudGame(id: string): Promise<void> {
  await sbFetch("games", "DELETE", `?id=eq.${encodeURIComponent(id)}`);
}

export interface CloudFeaturedVideo {
  id: string;
  title: string;
  bvid: string;
  page?: number;
  tag: string;
  reason: string;
  contributor: string;
  addedAt: string;
}

export async function fetchCloudFeaturedVideos(): Promise<CloudFeaturedVideo[]> {
  if (!isSupabaseReady) return [];
  const rows = (await sbFetch("featured_videos", "GET", "?order=created_at.asc")) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title || ""),
    bvid: String(r.bvid || ""),
    page: Number(r.page) || 1,
    tag: String(r.tag || "粉丝安利"),
    reason: String(r.reason || ""),
    contributor: String(r.contributor || "匿名粉丝"),
    addedAt: String(r.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
  }));
}

export async function saveCloudFeaturedVideo(v: CloudFeaturedVideo): Promise<CloudFeaturedVideo> {
  await sbFetch(
    "featured_videos",
    "POST",
    "?on_conflict=id",
    {
      id: v.id,
      title: v.title,
      bvid: v.bvid,
      page: v.page || 1,
      tag: v.tag || "粉丝安利",
      reason: v.reason || "",
      contributor: v.contributor || "匿名粉丝",
    },
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  return v;
}

export async function deleteCloudFeaturedVideo(id: string): Promise<void> {
  await sbFetch("featured_videos", "DELETE", `?id=eq.${encodeURIComponent(id)}`);
}
