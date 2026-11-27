import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoItem } from "./types";

export const BILIBILI_UID = process.env.BILIBILI_UID || "410741448";
const CACHE_PATH = path.resolve(process.cwd(), "data/bilibili-cache.json");

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function classifyTag(title: string): "singing" | "clip" | "game" {
  const lower = title.toLowerCase();
  if (lower.includes("歌") || lower.includes("唱") || lower.includes("翻唱") || lower.includes("歌枠")) {
    return "singing";
  }
  if (lower.includes("切片") || lower.includes("合集") || lower.includes("熟肉")) {
    return "clip";
  }
  return "game";
}

function normalizeImageUrl(raw: string): string {
  if (!raw) return "https://i0.hdslb.com/bfs/face/member/noface.jpg";
  if (raw.startsWith("//")) return "https:" + raw;
  return raw.replace(/^http:/, "https:");
}

export interface RssHubJsonFeed {
  items?: Array<{
    id?: string;
    url?: string;
    title?: string;
    content_html?: string;
    image?: string;
    date_published?: string;
  }>;
}

export function parseRssHubItems(feed: RssHubJsonFeed): VideoItem[] {
  if (!Array.isArray(feed?.items)) return [];
  const out: VideoItem[] = [];
  for (const item of feed.items) {
    const url = item.url ?? "";
    const title = (item.title ?? "").trim();
    if (!url || !title) continue;

    const bvid = url.match(/(BV[a-zA-Z0-9]+)/)?.[1] ?? item.id ?? url;
    const htmlImg = item.content_html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "";
    const thumb = normalizeImageUrl(item.image || htmlImg);
    const publishedAt = item.date_published
      ? new Date(item.date_published).toISOString()
      : new Date().toISOString();

    out.push({
      id: "bili-" + bvid,
      title,
      platform: "Bilibili",
      tag: classifyTag(title),
      publishedAt,
      url,
      thumbnail: thumb,
    });
  }
  return out;
}

export function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n] ?? "")
    .join("")
    .slice(0, 32);
}

export function signWbiParams(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
  wts = Math.floor(Date.now() / 1000)
): string {
  const mixinKey = getMixinKey(imgKey + subKey);
  const full: Record<string, string | number> = { ...params, wts };
  const query = Object.keys(full)
    .sort()
    .map((key) => {
      const cleanVal = String(full[key]).replace(/[!'()*]/g, "");
      return encodeURIComponent(key) + "=" + encodeURIComponent(cleanVal);
    })
    .join("&");

  const wRid = crypto
    .createHash("md5")
    .update(query + mixinKey)
    .digest("hex");

  return query + "&w_rid=" + wRid;
}

function readLocalCache(): VideoItem[] {
  try {
    if (!fs.existsSync(CACHE_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    const out: VideoItem[] = [];
    for (let i = 0; i < arr.length; i++) {
      const x = arr.at(i);
      if (!x || typeof x !== "object") continue;
      const bvid = String(x.bvid || x.id || "").trim();
      const title = String(x.title || "").trim();
      if (!bvid && !title) continue;
      const id = String(x.id || bvid || "bili-" + i);
      const url = String(x.url || (bvid ? "https://www.bilibili.com/video/" + bvid : ""));
      const thumb = normalizeImageUrl(String(x.thumbnail || x.cover || x.pic || ""));
      let publishedAt = String(x.publishedAt || "");
      if (!publishedAt) {
        const ts = Number(x.pubdate || x.created || 0);
        publishedAt = ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();
      }
      const tag = (x.tag === "singing" || x.tag === "clip" || x.tag === "game")
        ? x.tag
        : classifyTag(title);
      out.push({
        id,
        title,
        platform: "Bilibili",
        url,
        thumbnail: thumb,
        publishedAt,
        tag,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeLocalCache(items: VideoItem[]): void {
  if (items.length === 0) return;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(items, null, 2), "utf8");
  } catch {
    // Vercel 等只读 Serverless 环境安全忽略写盘失败
  }
}

async function fetchFromRssHub(limit: number): Promise<{ items: VideoItem[]; error?: string }> {
  const bases = (process.env.RSSHUB_BASE || "https://rsshub.app")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  let lastError = "no rsshub base";
  for (const base of bases) {
    const endpoint = base + "/bilibili/user/video/" + BILIBILI_UID + "?format=json";
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        lastError = base + " HTTP " + res.status;
        continue;
      }
      const json = (await res.json()) as RssHubJsonFeed;
      const items = parseRssHubItems(json).slice(0, limit);
      if (items.length > 0) return { items };
      lastError = base + " returned 0 items";
    } catch (e) {
      lastError = base + " " + (e instanceof Error ? e.message : "fetch error");
    }
  }
  return { items: [], error: lastError };
}

async function fetchFromBiliWbi(ps: number): Promise<{ items: VideoItem[]; error?: string }> {
  try {
    // 1. 申请游客 buvid3 / buvid4 指纹
    const spiRes = await fetch("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
      signal: AbortSignal.timeout(5000),
    });
    const spi = spiRes.ok ? await spiRes.json() : null;
    const b3 = spi?.data?.b_3 ?? "";
    const b4 = spi?.data?.b_4 ?? "";
    const extraCookie = process.env.BILIBILI_COOKIE ? "; " + process.env.BILIBILI_COOKIE : "";
    const cookie = "buvid3=" + b3 + "; buvid4=" + b4 + extraCookie;

    // 2. 获取 WBI Key
    const navRes = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/", Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (!navRes.ok) return { items: [], error: "nav HTTP " + navRes.status };
    const nav = await navRes.json();
    const imgKey = nav?.data?.wbi_img?.img_url?.split("/").pop()?.split(".")[0] ?? "";
    const subKey = nav?.data?.wbi_img?.sub_url?.split("/").pop()?.split(".")[0] ?? "";
    if (!imgKey || !subKey) return { items: [], error: "missing wbi keys" };

    // 3. 拉取投稿
    const qs = signWbiParams(
      {
        mid: BILIBILI_UID,
        ps,
        pn: 1,
        order: "pubdate",
        platform: "web",
        web_location: "1550101",
        dm_img_list: "[]",
        dm_img_str: "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ",
        dm_cover_img_str: "QU5HTEUgKEdvb2dsZSwgVnVsa2FuKQ",
      },
      imgKey,
      subKey
    );

    const arcRes = await fetch("https://api.bilibili.com/x/space/wbi/arc/search?" + qs, {
      headers: {
        "User-Agent": UA,
        Origin: "https://space.bilibili.com",
        Referer: "https://space.bilibili.com/" + BILIBILI_UID + "/video",
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!arcRes.ok) return { items: [], error: "arc HTTP " + arcRes.status };
    const arc = await arcRes.json();
    if (arc?.code !== 0) {
      return { items: [], error: "bili code " + arc?.code + ": " + (arc?.message ?? "") };
    }

    const vlist = arc?.data?.list?.vlist ?? [];
    const items: VideoItem[] = vlist.map(
      (v: { bvid: string; title: string; created: number; pic: string }) => ({
        id: "bili-" + v.bvid,
        title: v.title,
        platform: "Bilibili",
        tag: classifyTag(v.title),
        publishedAt: new Date(v.created * 1000).toISOString(),
        url: "https://www.bilibili.com/video/" + v.bvid,
        thumbnail: normalizeImageUrl(v.pic),
      })
    );
    return { items };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "wbi error" };
  }
}

export async function fetchBilibiliVideos(limit = 18): Promise<{
  items: VideoItem[];
  source: "rsshub" | "bilibili_wbi" | "local_cache";
  diagnostics: { rsshubError?: string; wbiError?: string };
}> {
  // Layer 1: RSSHub JSON
  const rss = await fetchFromRssHub(limit);
  if (rss.items.length > 0) {
    writeLocalCache(rss.items);
    return { items: rss.items, source: "rsshub", diagnostics: {} };
  }

  // Layer 2: 直连 B 站 WBI + buvid3/buvid4
  const wbi = await fetchFromBiliWbi(limit);
  if (wbi.items.length > 0) {
    writeLocalCache(wbi.items);
    return {
      items: wbi.items,
      source: "bilibili_wbi",
      diagnostics: { rsshubError: rss.error },
    };
  }

  // Layer 3: 本地缓存兜底
  const cached = readLocalCache().slice(0, limit);
  return {
    items: cached,
    source: "local_cache",
    diagnostics: { rsshubError: rss.error, wbiError: wbi.error },
  };
}

export async function fetchBilibiliLiveStatus(): Promise<{
  isLive: boolean;
  title: string;
  url: string;
}> {
  const defaultUrl = "https://space.bilibili.com/" + BILIBILI_UID;
  try {
    const res = await fetch(
      "https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids",
      {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/json" },
        body: JSON.stringify({ uids: [Number(BILIBILI_UID)] }),
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return { isLive: false, title: "Bilibili 直播间", url: defaultUrl };
    const json = await res.json();
    const info = json?.data?.[BILIBILI_UID];
    if (!info) return { isLive: false, title: "Bilibili 直播间", url: defaultUrl };

    return {
      isLive: info.live_status === 1,
      title: info.title || "Bilibili 直播间",
      url: info.room_id ? "https://live.bilibili.com/" + info.room_id : defaultUrl,
    };
  } catch {
    return { isLive: false, title: "Bilibili 直播间", url: defaultUrl };
  }
}
