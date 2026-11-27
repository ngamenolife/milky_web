import fs from "node:fs";
import crypto from "node:crypto";

const UID = "410741448";
const CACHE_PATH = "data/bilibili-cache.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MIXIN_KEY_ENC_TAB = [
  46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,
  37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52
];

function fmtDate(tsMs) {
  const d = new Date(tsMs);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmtDuration(sec) {
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

async function safeJson(res) {
  const text = await res.text();
  if (!text.trim().startsWith("{")) throw new Error(`HTTP ${res.status} 非 JSON`);
  return JSON.parse(text);
}

// 第 1 层（有 BILIBILI_COOKIE 时）：全空间最新 30 条投稿
async function fetchViaWbiWithCookie() {
  const envCookie = (process.env.BILIBILI_COOKIE || "").trim();
  if (!envCookie) return [];
  try {
    const navRes = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: { "User-Agent": UA, Cookie: envCookie, Referer: "https://space.bilibili.com/" },
      signal: AbortSignal.timeout(12000),
    });
    const nav = await safeJson(navRes);
    const imgKey = (nav?.data?.wbi_img?.img_url || "").split("/").pop().split(".")[0];
    const subKey = (nav?.data?.wbi_img?.sub_url || "").split("/").pop().split(".")[0];
    if (!imgKey || !subKey) return [];

    const mixinKey = MIXIN_KEY_ENC_TAB.map((n) => (imgKey + subKey)[n]).join("").slice(0, 32);
    const params = { mid: UID, ps: "30", pn: "1", order: "pubdate", wts: String(Math.floor(Date.now() / 1000)) };
    const query = Object.keys(params).sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]).replace(/[!()*]/g, ""))}`)
      .join("&");
    const w_rid = crypto.createHash("md5").update(query + mixinKey).digest("hex");

    const arcRes = await fetch(`https://api.bilibili.com/x/space/wbi/arc/search?${query}&w_rid=${w_rid}`, {
      headers: { "User-Agent": UA, Cookie: envCookie, Origin: "https://space.bilibili.com", Referer: `https://space.bilibili.com/${UID}/video` },
      signal: AbortSignal.timeout(12000),
    });
    const arc = await safeJson(arcRes);
    const list = arc?.data?.list?.vlist || [];
    if (list.length > 0) {
      console.log(`✅ WBI 全空间接口抓取成功，共 ${list.length} 条`);
      return list.map((v) => {
        const cover = String(v.pic || "").replace(/^http:/, "https:");
        return {
          bvid: v.bvid,
          title: v.title || "",
          cover,
          pic: cover,
          url: `https://www.bilibili.com/video/${v.bvid}`,
          date: fmtDate((v.created || 0) * 1000),
          created: v.created || 0,
          pubdate: v.created || 0,
          duration: v.length || "",
          length: v.length || "",
          play: v.play || 0,
          description: v.description || "",
        };
      });
    }
    console.log("⚠️ WBI Cookie 模式返回空:", arc?.code, arc?.message);
  } catch (e) {
    console.log("⚠️ WBI Cookie 模式跳过:", e.message);
  }
  return [];
}

// 第 2 层（免登录必通）：B 站公开合集 & 系列接口
async function fetchViaSeasonsSeries() {
  try {
    const url = `https://api.bilibili.com/x/polymer/web-space/seasons_series_list?mid=${UID}&page_num=1&page_size=20`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: `https://space.bilibili.com/${UID}/channel/collectiondetail` },
      signal: AbortSignal.timeout(12000),
    });
    const json = await safeJson(res);
    const lists = json?.data?.items_lists;
    const groups = [...(lists?.seasons_list || []), ...(lists?.series_list || [])];
    const items = [];
    for (const g of groups) {
      const cat = g?.meta?.name || "";
      for (const v of g?.archives || []) {
        if (!v?.bvid) continue;
        const cover = String(v.pic || "").replace(/^http:/, "https:");
        const dur = fmtDuration(v.duration);
        items.push({
          bvid: v.bvid,
          title: v.title || "",
          cover,
          pic: cover,
          url: `https://www.bilibili.com/video/${v.bvid}`,
          date: fmtDate((v.pubdate || 0) * 1000),
          created: v.pubdate || 0,
          pubdate: v.pubdate || 0,
          duration: dur,
          length: dur,
          play: v?.stat?.view || 0,
          description: cat ? `合集：${cat}` : "",
        });
      }
    }
    items.sort((a, b) => (b.pubdate || 0) - (a.pubdate || 0));
    if (items.length > 0) {
      console.log(`✅ 公开合集/系列接口抓取成功，共 ${items.length} 条`);
      return items;
    }
    console.log("⚠️ 公开合集/系列接口返回空:", json?.code, json?.message);
  } catch (e) {
    console.log("⚠️ 公开合集/系列接口失败:", e.message);
  }
  return [];
}

async function main() {
  let fetched = await fetchViaWbiWithCookie();
  if (fetched.length === 0) fetched = await fetchViaSeasonsSeries();

  if (fetched.length === 0) {
    console.log("ℹ️ 本次未能拉取到新数据，安全保留现有缓存。");
    return;
  }

  let raw = [];
  if (fs.existsSync(CACHE_PATH)) {
    raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }

  const isArray = Array.isArray(raw);
  const listKey = isArray ? null : (["items", "videos", "data", "list"].find((k) => Array.isArray(raw[k])) || "items");
  const existing = isArray ? raw : (raw[listKey] || []);

  const oldMap = new Map(existing.map((x) => [x.bvid, x]));
  const merged = [];
  const seen = new Set();

  for (const item of fetched) {
    if (!item.bvid || seen.has(item.bvid)) continue;
    seen.add(item.bvid);
    const prev = oldMap.get(item.bvid) || {};
    merged.push({
      ...prev,
      ...item,
      cover: item.cover || prev.cover || prev.pic || "",
      pic: item.pic || prev.pic || prev.cover || "",
      duration: item.duration || prev.duration || prev.length || "",
      length: item.length || prev.length || prev.duration || "",
    });
  }
  for (const prev of existing) {
    if (prev.bvid && !seen.has(prev.bvid)) {
      seen.add(prev.bvid);
      merged.push(prev);
    }
  }

  merged.sort((a, b) => (b.pubdate || b.created || 0) - (a.pubdate || a.created || 0));
  const finalList = merged.slice(0, 60);
  const newCount = finalList.filter((x) => !oldMap.has(x.bvid)).length;
  console.log(`📦 合并完成：共 ${finalList.length} 条归档（本次新增 ${newCount} 条新投稿）`);
  if (finalList[0]) {
    console.log(`🆕 最新一条: [${finalList[0].date}] ${finalList[0].title} (${finalList[0].bvid})`);
  }

  const output = isArray ? finalList : { ...raw, [listKey]: finalList, updatedAt: new Date().toISOString() };
  // SAFE_GUARD_MIN_ITEMS
const __list = Array.isArray(output) ? output : (output?.items || []);
if (__list.length < 3) { console.log("⚠️ 抓取条数不足 3 条，跳过写入以保护现有归档"); process.exit(0); }
fs.writeFileSync(CACHE_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
}

main();
