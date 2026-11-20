import fs from "node:fs";
import path from "node:path";
import { SEED_SCHEDULE } from "./data";
import { SEED_FEATURED_VIDEOS, type FeaturedVideo } from "./featured";
import {
  FALLBACK_SONGS,
  formatSecToTime,
  parseTimeToSec,
  type SongItem,
  type UnindexedStream,
} from "./songs";
import type { ScheduleItem } from "./types";

const SONGS_FILE = path.resolve(process.cwd(), "data/milky-songs-cleaned.json");
const SCHEDULE_FILE = path.resolve(process.cwd(), "data/schedule.json");
const FEATURED_FILE = path.resolve(process.cwd(), "data/featured-videos.json");

export interface SongsStoreData {
  songs: SongItem[];
  unindexedStreams: UnindexedStream[];
}

export function readSongsStore(): SongsStoreData {
  try {
    if (fs.existsSync(SONGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SONGS_FILE, "utf8"));
      if (Array.isArray(parsed?.songs) && parsed.songs.length > 0) {
        return {
          songs: parsed.songs,
          unindexedStreams: Array.isArray(parsed.unindexedStreams)
            ? parsed.unindexedStreams
            : [],
        };
      }
    }
  } catch {}
  return { songs: FALLBACK_SONGS, unindexedStreams: [] };
}

function writeSongsStore(songs: SongItem[], unindexedStreams: UnindexedStream[]): boolean {
  try {
    const updated = {
      meta: { updatedAt: new Date().toISOString(), cleanedSongs: songs.length },
      songs,
      unindexedStreams,
    };
    fs.mkdirSync(path.dirname(SONGS_FILE), { recursive: true });
    fs.writeFileSync(SONGS_FILE, JSON.stringify(updated, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function appendSongToStore(newSong: Omit<SongItem, "id" | "startSec">): {
  saved: boolean;
  item: SongItem;
  reason?: string;
} {
  const store = readSongsStore();
  const startSec = parseTimeToSec(newSong.startTime);
  const item: SongItem = {
    ...newSong,
    id: "song-fan-" + Date.now(),
    startTime: formatSecToTime(startSec),
    startSec,
  };
  const saved = writeSongsStore([item, ...store.songs], store.unindexedStreams);
  return saved ? { saved: true, item } : { saved: false, item, reason: "readonly_filesystem" };
}

export function updateSongInStore(
  id: string,
  patch: Omit<SongItem, "id" | "startSec">
): { found: boolean; saved: boolean; item?: SongItem } {
  const store = readSongsStore();
  const idx = store.songs.findIndex((s) => s.id === id);
  if (idx === -1) return { found: false, saved: false };

  const startSec = parseTimeToSec(patch.startTime);
  const updatedItem: SongItem = {
    ...store.songs[idx],
    ...patch,
    id,
    startTime: formatSecToTime(startSec),
    startSec,
  };
  const nextSongs = [...store.songs];
  nextSongs[idx] = updatedItem;
  const saved = writeSongsStore(nextSongs, store.unindexedStreams);
  return { found: true, saved, item: updatedItem };
}

export function deleteSongFromStore(id: string): { found: boolean; saved: boolean } {
  const store = readSongsStore();
  const nextSongs = store.songs.filter((s) => s.id !== id);
  if (nextSongs.length === store.songs.length) return { found: false, saved: false };
  const saved = writeSongsStore(nextSongs, store.unindexedStreams);
  return { found: true, saved };
}

// -------- Schedule CRUD --------
export function readScheduleStore(): ScheduleItem[] {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_SCHEDULE;
}

function writeScheduleStore(list: ScheduleItem[]): boolean {
  try {
    fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(list, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function appendScheduleToStore(newItem: Omit<ScheduleItem, "id">): {
  saved: boolean;
  item: ScheduleItem;
  reason?: string;
} {
  const list = readScheduleStore();
  const item: ScheduleItem = { ...newItem, id: "evt-fan-" + Date.now() };
  const updated = [item, ...list].sort((a, b) => a.startIso.localeCompare(b.startIso));
  const saved = writeScheduleStore(updated);
  return saved ? { saved: true, item } : { saved: false, item, reason: "readonly_filesystem" };
}

export function updateScheduleInStore(
  id: string,
  patch: Omit<ScheduleItem, "id">
): { found: boolean; saved: boolean; item?: ScheduleItem } {
  const list = readScheduleStore();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return { found: false, saved: false };
  const updatedItem: ScheduleItem = { ...patch, id };
  const next = [...list];
  next[idx] = updatedItem;
  next.sort((a, b) => a.startIso.localeCompare(b.startIso));
  const saved = writeScheduleStore(next);
  return { found: true, saved, item: updatedItem };
}

export function deleteScheduleFromStore(id: string): { found: boolean; saved: boolean } {
  const list = readScheduleStore();
  const next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return { found: false, saved: false };
  const saved = writeScheduleStore(next);
  return { found: true, saved };
}

export function validateScheduleInput(input: Partial<ScheduleItem>): {
  ok: boolean;
  error?: string;
} {
  if (!input.title || input.title.trim().length < 1 || input.title.length > 100) {
    return { ok: false, error: "日程标题不能为空且需在 100 字以内" };
  }
  if (!input.startIso || Number.isNaN(Date.parse(input.startIso))) {
    return { ok: false, error: "请输入有效的开始时间" };
  }
  if (!input.endIso || Number.isNaN(Date.parse(input.endIso))) {
    return { ok: false, error: "请输入有效的结束时间" };
  }
  if (Date.parse(input.endIso) <= Date.parse(input.startIso)) {
    return { ok: false, error: "结束时间必须晚于开始时间" };
  }
  return { ok: true };
}

// -------- Featured Videos (About Page) CRUD --------
export function readFeaturedVideos(): FeaturedVideo[] {
  try {
    if (fs.existsSync(FEATURED_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FEATURED_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_FEATURED_VIDEOS;
}

function writeFeaturedVideos(list: FeaturedVideo[]): boolean {
  try {
    fs.mkdirSync(path.dirname(FEATURED_FILE), { recursive: true });
    fs.writeFileSync(FEATURED_FILE, JSON.stringify(list, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function appendFeaturedVideo(newItem: Omit<FeaturedVideo, "id" | "addedAt">): {
  saved: boolean;
  item: FeaturedVideo;
} {
  const list = readFeaturedVideos();
  const item: FeaturedVideo = {
    ...newItem,
    id: "feat-" + Date.now(),
    addedAt: new Date().toISOString().slice(0, 10),
  };
  const saved = writeFeaturedVideos([...list, item]);
  return { saved, item };
}

export function updateFeaturedVideo(
  id: string,
  patch: Omit<FeaturedVideo, "id" | "addedAt">
): { found: boolean; saved: boolean; item?: FeaturedVideo } {
  const list = readFeaturedVideos();
  const idx = list.findIndex((v) => v.id === id);
  if (idx === -1) return { found: false, saved: false };
  const updatedItem: FeaturedVideo = { ...list[idx], ...patch, id };
  const next = [...list];
  next[idx] = updatedItem;
  const saved = writeFeaturedVideos(next);
  return { found: true, saved, item: updatedItem };
}

export function deleteFeaturedVideo(id: string): { found: boolean; saved: boolean } {
  const list = readFeaturedVideos();
  const next = list.filter((v) => v.id !== id);
  if (next.length === list.length) return { found: false, saved: false };
  const saved = writeFeaturedVideos(next);
  return { found: true, saved };
}
