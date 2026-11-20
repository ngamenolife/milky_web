import type { ScheduleItem, VideoItem } from "./types";

export const YOUTUBE_CHANNEL_ID = "UCBJPNd_nAzGkXdL4Wy87ADg";
export const YOUTUBE_RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=" + YOUTUBE_CHANNEL_ID;

export const SEED_SCHEDULE: ScheduleItem[] = [
  {
    id: "evt-1",
    title: "【鸣潮】新版本剧情推进＆探索",
    category: "game",
    platform: "YouTube",
    startIso: "2026-11-21T12:00:00.000Z",
    endIso: "2026-11-21T14:30:00.000Z",
    sourceUrl: "https://www.youtube.com/@milkytube0411",
  },
  {
    id: "evt-2",
    title: "【歌枠】周末治愈系深夜歌回",
    category: "singing",
    platform: "YouTube",
    startIso: "2026-11-22T13:00:00.000Z",
    endIso: "2026-11-22T15:00:00.000Z",
    sourceUrl: "https://www.youtube.com/@milkytube0411",
  },
  {
    id: "evt-3",
    title: "【B限杂谈】中文学习＆观众互动回",
    category: "bilibili",
    platform: "Bilibili",
    startIso: "2026-11-24T12:00:00.000Z",
    endIso: "2026-11-24T13:30:00.000Z",
    sourceUrl: "https://space.bilibili.com/",
  },
];

export const SEED_VIDEOS: VideoItem[] = [
  {
    id: "yt-demo-1",
    title: "【歌枠】Milky 精选日文/中文翻唱合集",
    platform: "YouTube",
    tag: "singing",
    publishedAt: "2026-11-18T12:00:00.000Z",
    url: "https://www.youtube.com/@milkytube0411",
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  },
  {
    id: "yt-demo-2",
    title: "【FFXIV】光之战士橘猫的冒险实况",
    platform: "YouTube",
    tag: "game",
    publishedAt: "2026-11-15T10:00:00.000Z",
    url: "https://www.youtube.com/@milkytube0411",
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  },
];

export async function fetchYouTubeRss(): Promise<VideoItem[]> {
  try {
    const res = await fetch(YOUTUBE_RSS_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1, 9);
    const items: VideoItem[] = [];

    for (const entry of entries) {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      if (!id || !title || !published) continue;
      const lower = title.toLowerCase();
      const tag =
        lower.includes("歌") || lower.includes("sing") ? "singing" : "game";
      items.push({
        id: "yt-" + id,
        title,
        platform: "YouTube",
        tag,
        publishedAt: published,
        url: "https://www.youtube.com/watch?v=" + id,
        thumbnail: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
      });
    }
    return items;
  } catch {
    return [];
  }
}
