import type { SongItem, SongLang } from "@/lib/songs";
import type { ScheduleCategory, ScheduleItem, SchedulePlatform } from "@/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseReady = Boolean(URL && KEY);

async function sbFetch(table: string, method: string, query = "", body?: unknown, extraHeaders?: Record<string, string>) {
  if (!isSupabaseReady) throw new Error("尚未配置 Supabase Secrets");
  const res = await fetch(`${URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(extraHeaders || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return [];
  return res.json();
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
