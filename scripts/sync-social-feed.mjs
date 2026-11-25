/**
 * 定时同步 Milky (UID 410741448 / @MilkyVtuber) 的 B站动态与 X 推文到 Supabase
 * 若配置了 GEMINI_API_KEY，还会自动解析开播预告并写入 schedules 表
 */

const BILI_UID = "410741448";
const X_HANDLE = "MilkyVtuber";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BILIBILI_COOKIE = process.env.BILIBILI_COOKIE || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const DEFAULT_NITTER_HOSTS = [
  "xcancel.com",
  "nitter.poast.org",
  "nitter.privacyredirect.com",
  "nitter.tiekoetter.com",
  "nitter.net",
];
const NITTER_HOSTS = (process.env.NITTER_INSTANCES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .concat(DEFAULT_NITTER_HOSTS);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  return decodeEntities(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeNitterImg(src, host) {
  if (!src) return "";
  let url = decodeEntities(src).trim();
  if (url.startsWith("//")) url = "https:" + url;
  else if (url.startsWith("/")) url = `https://${host}${url}`;

  const picMatch = url.match(/\/pic\/(.+)$/);
  if (picMatch && picMatch) {
    const decoded = decodeURIComponent(picMatch);
    if (decoded.startsWith("orig/")) return "https://pbs.twimg.com/" + decoded.slice(5);
    if (decoded.startsWith("media/") || decoded.startsWith("ext_tw_video_thumb/")) {
      return "https://pbs.twimg.com/" + decoded;
    }
    if (decoded.startsWith("pbs.twimg.com/")) return "https://" + decoded;
  }
  return url;
}

async function fetchBilibiliDynamics() {
  const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${BILI_UID}&features=itemOpusStyle`;
  const headers = {
    "User-Agent": UA,
    Referer: `https://space.bilibili.com/${BILI_UID}/dynamic`,
    Origin: "https://space.bilibili.com",
  };
  if (BILIBILI_COOKIE) headers.Cookie = BILIBILI_COOKIE;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    if (json.code !== 0 || !json.data?.items) {
      console.warn(`⚠️ B站动态接口返回异常 (code=${json.code}, msg=${json.message || "unknown"})`);
      return [];
    }

    const posts = [];
    for (const item of json.data.items.slice(0, 20)) {
      const id = String(item.id_str || "");
      if (!id) continue;
      const author = item.modules?.module_author || {};
      const dyn = item.modules?.module_dynamic || {};
      const pubTs = Number(author.pub_ts || 0);
      if (!pubTs) continue;

      const textParts = [];
      if (dyn.desc?.text) textParts.push(dyn.desc.text.trim());
      if (dyn.major?.opus?.summary?.text) textParts.push(dyn.major.opus.summary.text.trim());
      if (dyn.major?.archive?.title) textParts.push(`📺 ${dyn.major.archive.title}`);

      const images = [];
      for (const p of dyn.major?.opus?.pics || []) {
        if (p.url) images.push(p.url.replace(/^http:\/\//, "https://"));
      }
      for (const p of dyn.major?.draw?.items || []) {
        if (p.src) images.push(p.src.replace(/^http:\/\//, "https://"));
      }
      if (images.length === 0 && dyn.major?.archive?.cover) {
        images.push(dyn.major.archive.cover.replace(/^http:\/\//, "https://"));
      }

      const isRepost = item.type === "DYNAMIC_TYPE_FORWARD";
      if (isRepost && item.orig?.modules?.module_dynamic?.desc?.text) {
        const origAuthor = item.orig?.modules?.module_author?.name || "";
        textParts.push(`\n🔁 转发 @${origAuthor}：${item.orig.modules.module_dynamic.desc.text.trim()}`);
      }

      const text = [...new Set(textParts.filter(Boolean))].join("\n").trim();
      posts.push({
        id: `bilibili:${id}`,
        platform: "bilibili",
        post_id: id,
        published_at: new Date(pubTs * 1000).toISOString(),
        text: text || "（无正文动态）",
        images: [...new Set(images)].slice(0, 9),
        url: `https://t.bilibili.com/${id}`,
        is_repost: isRepost,
      });
    }
    console.log(`✅ B站动态抓取成功：${posts.length} 条`);
    return posts;
  } catch (err) {
    console.warn("⚠️ B站动态抓取失败：", err.message);
    return [];
  }
}

async function fetchTwitterViaNitter() {
  const tried = new Set();
  for (const host of NITTER_HOSTS) {
    if (tried.has(host)) continue;
    tried.add(host);
    const rssUrl = `https://${host}/${X_HANDLE}/rss`;
    try {
      const res = await fetch(rssUrl, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.warn(`⚠️ Nitter 节点 ${host} 返回 HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      if (!xml.includes("<item>")) {
        console.warn(`⚠️ Nitter 节点 ${host} 未返回有效 RSS 条目`);
        continue;
      }

      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      const posts = [];
      for (const block of items.slice(0, 20)) {
        const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || []) || "");
        const link = decodeEntities((block.match(/<link>([\s\S]*?)<\/link>/) || []) || "").trim();
        const pubDate = decodeEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || []) || "").trim();
        const desc = (block.match(/<description>([\s\S]*?)<\/description>/) || []) || "";

        const idMatch = link.match(/\/status\/(\d+)/);
        if (!idMatch || !idMatch) continue;
        const postId = idMatch;
        const parsedTime = new Date(pubDate);
        if (Number.isNaN(parsedTime.getTime())) continue;

        const imgMatches = [...decodeEntities(desc).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        const images = [...new Set(imgMatches.map((m) => normalizeNitterImg(m, host)).filter(Boolean))].slice(0, 9);

        const isRepost = /^RT by\s+/i.test(title);
        const text = stripHtml(desc) || stripHtml(title);

        posts.push({
          id: `twitter:${postId}`,
          platform: "twitter",
          post_id: postId,
          published_at: parsedTime.toISOString(),
          text: text || "（无正文推文）",
          images,
          url: `https://x.com/${X_HANDLE}/status/${postId}`,
          is_repost: isRepost,
        });
      }

      if (posts.length > 0) {
        console.log(`✅ X 推文抓取成功（节点 ${host}）：${posts.length} 条`);
        return posts;
      }
    } catch (err) {
      console.warn(`⚠️ Nitter 节点 ${host} 失败：`, err.message);
    }
  }
  console.warn("⚠️ 所有 Nitter 节点均暂时不可用，本次跳过 X 推文同步");
  return [];
}

async function sbFetch(path, options = {}) {
  const authHeaders = SUPABASE_SERVICE_KEY.startsWith("sb_secret_")
    ? { apikey: SUPABASE_SERVICE_KEY }
    : { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

const SCHEDULE_HINT_RE = /(配信|予定|直播|开播|開播|歌枠|歌回|同時視聴|同时视听|FF14|枠|時|点|\d{1,2}[:：]\d{2})/i;

async function extractAndSaveSchedules(newPosts) {
  if (!GEMINI_API_KEY) {
    console.log("ℹ️ 未配置 GEMINI_API_KEY，跳过 AI 日程自动提取");
    return;
  }
  const candidates = newPosts.filter((p) => !p.is_repost && SCHEDULE_HINT_RE.test(p.text)).slice(0, 5);
  if (candidates.length === 0) return;

  for (const post of candidates) {
    try {
      const prompt = `你是 VTuber MilkyTube (みるきぃ) 的日程提取助手。
发布时间(UTC): ${post.published_at}
来源平台: ${post.platform}
正文:
${post.text}

如果正文包含**明确的未来直播/配信预告时间**，请提取为 JSON 数组（若没有明确开播日期和时间，返回空数组 []）。
注意：日文“21時”默认为日本时间 +09:00，中文“20点”默认为北京时间 +08:00。
每项格式严格如下：
[{"title":"简短直播标题","start_time":"ISO8601带时区如2026-11-26T21:00:00+09:00","platform":"三台同播"|"Bilibili"|"YouTube"|"Twitch","category":"game"|"watchalong"|"singing"|"bilibili"|"collab","notes":"简短备注"}]
只输出纯 JSON 数组，不要任何 Markdown 代码块或解释。`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const parsed = JSON.parse(raw.replace(/^```json|```$/g, "").trim());
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      for (let i = 0; i < parsed.length; i++) {
        const ev = parsed[i];
        if (!ev?.title || !ev?.start_time) continue;
        const dt = new Date(ev.start_time);
        if (Number.isNaN(dt.getTime())) continue;

        const row = {
          id: `auto-${post.platform}-${post.post_id}-${i}`,
          title: String(ev.title).slice(0, 120),
          start_time: dt.toISOString(),
          platform: ["三台同播", "Bilibili", "YouTube", "Twitch"].includes(ev.platform) ? ev.platform : "三台同播",
          category: ["game", "watchalong", "singing", "bilibili", "collab"].includes(ev.category) ? ev.category : "game",
          notes: String(ev.notes || "").slice(0, 200),
          source_url: post.url,
        };
        await sbFetch("schedules?on_conflict=id", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify(row),
        });
        console.log(`📅 已自动写入日程：${row.title} (${row.start_time})`);
      }

      await sbFetch(`social_posts?id=eq.${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ schedule_parsed: true }),
      });
    } catch (err) {
      console.warn(`⚠️ AI 日程解析跳过 (${post.id}):`, err.message);
    }
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量");
    process.exit(1);
  }

  const [biliPosts, xPosts] = await Promise.all([
    fetchBilibiliDynamics(),
    fetchTwitterViaNitter(),
  ]);
  const allPosts = [...biliPosts, ...xPosts];
  if (allPosts.length === 0) {
    console.log("ℹ️ 本次未抓到任何帖子");
    return;
  }

  const existing = await sbFetch("social_posts?select=id&order=published_at.desc&limit=200");
  const existingSet = new Set((existing || []).map((r) => r.id));
  const newPosts = allPosts.filter((p) => !existingSet.has(p.id));

  if (newPosts.length > 0) {
    await sbFetch("social_posts?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify(newPosts),
    });
    console.log(`🎉 新增入库 ${newPosts.length} 条动态/推文`);
    await extractAndSaveSchedules(newPosts);
  } else {
    console.log("✅ 所有抓取到的动态与推文均已是最新，无需新增");
  }
}

main().catch((err) => {
  console.error("❌ 同步任务异常：", err);
  process.exit(1);
});
