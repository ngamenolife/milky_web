export type SongLang = "ja" | "zh" | "en";

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  language: SongLang;
  genre: string;
  tags: string[];
  bvid?: string;
  coverBvid?: string;
  page?: number;
  startTime?: string;
  startSec?: number;
  date: string;
  streamTitle: string;
  contributor?: string;
}

export interface UnindexedStream {
  bvid: string;
  date: string;
  streamTitle: string;
  pages: number;
}

export interface SongGroup {
  title: string;
  artist: string;
  language: SongLang;
  genre: string;
  tags: string[];
  versions: SongItem[];
}

export function parseTimeToSec(timeStr?: string): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const parts = timeStr.trim().split(":").map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Math.max(0, Math.floor(parts[0] || 0));
}

export function formatSecToTime(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? pad(h) + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
}

export function buildBiliEmbedUrl(bvid: string, startSec: number, page = 1): string {
  const cleanBvid = bvid.replace(/[^a-zA-Z0-9]/g, "");
  const safeT = Math.max(0, Math.floor(startSec));
  const safeP = Math.max(1, Math.floor(page));
  return (
    "https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=" +
    cleanBvid +
    "&p=" +
    safeP +
    "&t=" +
    safeT +
    "&high_quality=1&danmaku=0&autoplay=0"
  );
}

export function groupSongsByTitle(songs: SongItem[]): SongGroup[] {
  const map = new Map<string, SongGroup>();
  for (const s of songs) {
    const key = s.title.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        title: s.title,
        artist: s.artist,
        language: s.language,
        genre: s.genre,
        tags: [...s.tags],
        versions: [s],
      });
    } else {
      existing.versions.push(s);
      for (const tag of s.tags) {
        if (!existing.tags.includes(tag)) existing.tags.push(tag);
      }
    }
  }
  return Array.from(map.values()).map((g) => ({
    ...g,
    versions: g.versions.sort((a, b) => {
      // 有 BV 的版本优先展示，其次按日期倒序
      const aHas = a.bvid ? 1 : 0;
      const bHas = b.bvid ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return b.date.localeCompare(a.date);
    }),
  }));
}

// 只要求必填歌名！BV 号与时间轴均为选填
export function validateSongInput(input: Partial<SongItem>): { ok: boolean; error?: string } {
  if (!input.title || input.title.trim().length < 1 || input.title.length > 100) {
    return { ok: false, error: "歌名不能为空且需在 100 字以内" };
  }
  const bvid = (input.bvid ?? "").trim();
  if (bvid && !/^BV[a-zA-Z0-9]{8,14}$/.test(bvid)) {
    return { ok: false, error: "BV 号格式不正确（应以 BV 开头，或留空加入纯歌单）" };
  }
  const st = (input.startTime ?? "").trim();
  if (st && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(st)) {
    return { ok: false, error: "时间轴格式应为 mm:ss 或 hh:mm:ss（如 12:35），也可留空" };
  }
  return { ok: true };
}

export const FALLBACK_SONGS: SongItem[] = [
  {
    id: "song-1",
    title: "Beautiful World",
    artist: "宇多田ヒカル",
    language: "ja",
    genre: "动漫",
    tags: ["推荐"],
    bvid: "BV15hsL6eEJ4",
    page: 1,
    startTime: "01:15:34",
    startSec: 4534,
    date: "2026-11-14",
    streamTitle: "【直播回放】【B限】 是歌回哦，快来玩吧！",
  },
];
