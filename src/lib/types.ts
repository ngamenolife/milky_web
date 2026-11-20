export type Locale = "zh" | "ja";

export type ScheduleCategory = "game" | "singing" | "watchalong" | "bilibili" | "collab";
export type SchedulePlatform = "三台同播" | "Twitch" | "Twitch + YouTube" | "YouTube" | "Bilibili";

export interface ScheduleItem {
  id: string;
  title: string;
  category: ScheduleCategory;
  platform: SchedulePlatform;
  startIso: string;
  endIso: string;
  sourceUrl?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  platform: "YouTube" | "Bilibili";
  tag: "game" | "singing" | "clip";
  publishedAt: string;
  url: string;
  thumbnail: string;
}

export interface LiveStatus {
  youtube: { isLive: boolean; title: string; url: string };
  bilibili: { isLive: boolean; url: string };
  checkedAt: string;
}
