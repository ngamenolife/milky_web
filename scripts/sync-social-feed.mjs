/**
 * 定时同步 Milky (UID 410741448 / @MilkyVtuber) 的 B站动态与 X 推文到 Supabase
 * 1) X 推文支持：TwitterAPI.io / 自定义 RSS (X_RSS_URL) / FxTwitter / 实测存活 Nitter 节点
 * 2) 中文翻译：Gemini 2.5 Flash 优先 + Google Translate 免费接口 100% 兜底
 * 3) 自动解析开播预告写入 schedules 日历表（含历史未解析帖补扫）
 */

const BILI_UID = "410741448";
const X_HANDLE = "MilkyVtuber";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BILIBILI_COOKIE = process.env.BILIBILI_COOKIE || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim();
const X_RSS_URL = (process.env.X_RSS_URL || "").trim();
const TWITTERAPI_IO_KEY = (process.env.TWITTERAPI_IO_KEY || "").trim();

const FREE_X_FEEDS = [
  { name: "FxTwitter", url: `https://fxtwitter.com/${X_HANDLE}/feed.xml`, host: "" },
  { name: "nitter.mie.foundation", url: `https://nitter.mie.foundation/${X_HANDLE}/rss`, host: "nitter.mie.foundation" },
  { name: "nitter.mizuki.st", url: `https://nitter.mizuki.st/${X_HANDLE}/rss`, host: "nitter.mizuki.st" },
];

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

function normalizeImg(src, host) {
  if (!src) return "";
  let url = decodeEntities(src).trim();
  if (url.startsWith("//")) url = "https:" + url;
  else if (url.startsWith("/") && host) url = `https://${host}${url}`;

  const picPath = url.match(/\/pic\/(.+)$/)?.at(1);
  if (picPath) {
    const decoded = decodeURIComponent(picPath);
    if (decoded.startsWith("orig/")) return "https://pbs.twimg.com/" + decoded.slice(5);
    if (decoded.startsWith("media/") || decoded.startsWith("ext_tw_video_thumb/")) {
      return "https://pbs.twimg.com/" + decoded;
    }
    if (decoded.startsWith("pbs.twimg.com/")) return "https://" + decoded;
  }
  return url;
}

// 兼容 RSS 2.0 (<item>) 和 Atom (<entry>)
function parseFeedXmlToTweets(xml, host = "") {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/g) || [];
  const posts = [];
  for (const block of blocks.slice(0, 20)) {
    const title = decodeEntities(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.at(1) || "");
    const linkTag =
      block.match(/<link[^>]*href=["']([^"']+)["']/)?.at(1) ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.at(1) ||
      "";
    const guid = decodeEntities(
      block.match(/<(?:guid|id)[^>]*>([\s\S]*?)<\/(?:guid|id)>/)?.at(1) || ""
    ).trim();
    const pubDate = decodeEntities(
      block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/)?.at(1) || ""
    ).trim();
    const bodyRaw =
      block.match(/<(?:description|content|summary)[^>]*>([\s\S]*?)<\/(?:description|content|summary)>/)?.at(1) || "";

    const postId = (decodeEntities(linkTag) + " " + guid).match(/\/status\/(\d+)/)?.at(1);
    if (!postId) continue;
    const parsedTime = new Date(pubDate);
    if (Number.isNaN(parsedTime.getTime())) continue;

    const imgMatches = [
      ...decodeEntities(bodyRaw).matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
      ...block.matchAll(/<media:content[^>]+url=["']([^"']+)["']/gi),
      ...block.matchAll(/<enclosure[^>]+url=["']([^"']+)["']/gi),
    ];
    const images = [...new Set(imgMatches.map((m) => normalizeImg(m.at(1), host)).filter(Boolean))].slice(0, 9);

    const linkAuthor = (decodeEntities(linkTag) + " " + guid).match(/https?:\/\/[^/]+\/([^/]+)\/status\/\d+/i)?.at(1) || "";
    const isRepost = (Boolean(linkAuthor) && linkAuthor.toLowerCase() !== X_HANDLE.toLowerCase()) || /^(RT\b|🔁|Retweeted)/i.test(title.trim());
    const text = stripHtml(bodyRaw) || stripHtml(title);

    posts.push({
      id: `twitter:${postId}`,
      platform: "twitter",
      post_id: postId,
      published_at: parsedTime.toISOString(),
      text: text || "（无正文推文）",
      images,
      url: `https://x.com/${linkAuthor || X_HANDLE}/status/${postId}`,
      is_repost: isRepost,
    });
  }
  return posts;
}

// ---------- 1. 抓取 B 站动态 ----------
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
      console.warn(`⚠️ B站动态接口异常 (code=${json.code}, msg=${json.message || "unknown"})`);
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

// ---------- 2. 抓取 X (Twitter) 推文 ----------
async function fetchTwitterPosts() {
  if (TWITTERAPI_IO_KEY) {
    try {
      const res = await fetch(
        `https://api.twitterapi.io/twitter/user/last_tweets?userName=${encodeURIComponent(X_HANDLE)}`,
        { headers: { "X-API-Key": TWITTERAPI_IO_KEY }, signal: AbortSignal.timeout(15000) }
      );
      if (res.ok) {
        const json = await res.json();
        const list = json?.data?.tweets || json?.tweets || [];
        const posts = list
          .slice(0, 20)
          .map((t) => {
            const postId = String(t.id || "");
            const media = t.extendedEntities?.media || t.entities?.media || [];
            const images = media.map((m) => m.media_url_https || m.media_url).filter(Boolean).slice(0, 9);
            return {
              id: `twitter:${postId}`,
              platform: "twitter",
              post_id: postId,
              published_at: new Date(t.createdAt || Date.now()).toISOString(),
              text: String(t.text || "").trim() || "（无正文推文）",
              images,
              url: t.url || `https://x.com/${X_HANDLE}/status/${postId}`,
              is_repost: Boolean(t.retweeted_tweet || /^RT @/i.test(t.text || "")),
            };
          })
          .filter((p) => p.post_id);
        if (posts.length > 0) {
          console.log(`✅ X 推文抓取成功（TwitterAPI.io）：${posts.length} 条`);
          return posts;
        }
      }
    } catch (err) {
      console.warn("⚠️ TwitterAPI.io 失败：", err.message);
    }
  }

  const feedsToTry = [
    ...(X_RSS_URL ? [{ name: "自定义 X_RSS_URL", url: X_RSS_URL, host: "" }] : []),
    ...FREE_X_FEEDS,
  ];

  for (const feed of feedsToTry) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`⚠️ X 源 [${feed.name}] 返回 HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const posts = parseFeedXmlToTweets(xml, feed.host);
      if (posts.length > 0) {
        console.log(`✅ X 推文抓取成功（${feed.name}）：${posts.length} 条`);
        return posts;
      }
      console.warn(`⚠️ X 源 [${feed.name}] 返回 200 但未解析到推文`);
    } catch (err) {
      console.warn(`⚠️ X 源 [${feed.name}] 请求失败：`, err.message);
    }
  }

  console.warn("⚠️ 本次所有免费 X 源均未返回推文（可配置 X_RSS_URL 指向 rss.app 或 xgo.ing）");
  return [];
}

// ---------- 3. Supabase & AI / 免费翻译辅助 ----------
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

async function callGeminiJson(prompt, temperature = 0.2) {
  if (GROQ_API_KEY) {
    for (const m of ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"]) {
      try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ model: m, temperature, messages: [{ role: "user", content: prompt }] }),
          signal: AbortSignal.timeout(25000),
        });
        if (!r.ok) { console.warn("⚠️ Groq (" + m + ") HTTP " + r.status); continue; }
        const d = await r.json();
        const txt = (d?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        const cleaned = txt.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, "").trim();
        if (cleaned) return JSON.parse(cleaned);
      } catch (e) { console.warn("⚠️ Groq (" + m + ") 异常：", e.message); }
    }
  }
  if (!GEMINI_API_KEY) return null;
  const models = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ Gemini (${model}) HTTP ${res.status}: ${errText.slice(0, 180)}`);
        continue;
      }
      const data = await res.json();
      const raw = data?.candidates?.at(0)?.content?.parts?.at(0)?.text || "";
      if (raw) return JSON.parse(raw.replace(/^```json|```$/g, "").trim());
    } catch (err) {
      console.warn(`⚠️ Gemini (${model}) 调用异常：`, err.message);
    }
  }
  return null;
}

// 100% 免费兜底：Google Translate 公开接口
async function googleTranslateToZh(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text.slice(0, 1800))}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return "";
    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data.at(0))) return "";
    return data
      .at(0)
      .map((seg) => (Array.isArray(seg) ? seg.at(0) || "" : ""))
      .join("")
      .trim();
  } catch {
    return "";
  }
}

// ---------- 4. 全部非中文动态/推文自动翻译（Gemini 优先 + Google Translate 兜底） ----------
async function translatePendingPosts() {
  const rows = await sbFetch("social_posts?select=id,text,text_zh&order=published_at.desc&limit=40");
  if (!Array.isArray(rows) || rows.length === 0) return;

  const needTranslate = rows
    .filter((r) => !String(r.text_zh || "").trim() && /[\u3040-\u30ff]/.test(String(r.text || "")))
    .slice(0, 20);

  console.log(`🈳 检测到含日文且未翻译的帖子：${needTranslate.length} 条`);
  if (needTranslate.length === 0) return;

  let translated = 0;

  if (GROQ_API_KEY || GEMINI_API_KEY) {
    const prompt = `你是 VTuber 字幕组翻译，请将以下 Milky (みるきぃ) 的日文动态/推文翻译成自然可爱的简体中文。
要求：配信=直播、歌枠=歌回、同時視聴=同时视听、メン限=会员限定；保留换行和emoji。
严格返回 JSON 对象：{"帖子id": "中文翻译"}。
输入：
${JSON.stringify(needTranslate.map((r) => ({ id: r.id, text: r.text })))}`;

    const map = await callGeminiJson(prompt, 0.2);
    if (map && typeof map === "object") {
      for (const item of needTranslate) {
        const zh = typeof map[item.id] === "string" ? map[item.id].trim() : "";
        if (zh) {
          await sbFetch(`social_posts?id=eq.${encodeURIComponent(item.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ text_zh: zh }),
          });
          item._done = true;
          translated++;
        }
      }
    }
  }

  const remaining = needTranslate.filter((r) => !r._done);
  if (remaining.length > 0) {
    console.log(`🔄 切换免费 Google Translate 兜底翻译剩余 ${remaining.length} 条...`);
    for (const item of remaining) {
      const zh = await googleTranslateToZh(item.text);
      if (zh) {
        await sbFetch(`social_posts?id=eq.${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ text_zh: zh }),
        });
        translated++;
      }
    }
  }

  console.log(`✅ 本次共成功写入 ${translated} 条中文翻译`);
}

// ---------- 5. Gemini 自动解析开播预告写入 schedules ----------
const SCHEDULE_HINT_RE = /(配信|予定|直播|开播|開播|歌枠|歌回|同時視聴|同时视听|FF14|枠|時|点|\d{1,2}[:：]\d{2})/i;

async function parsePendingSchedules() {
  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    console.warn("⚠️ 未检测到 AI Key，跳过自动日历解析");
    return;
  }
  const pending = await sbFetch(
    "social_posts?select=id,platform,post_id,published_at,text,url,is_repost&schedule_parsed=eq.false&order=published_at.desc&limit=15"
  );
  console.log(`📅 待检测日程的帖子数量：${Array.isArray(pending) ? pending.length : 0}`);
  if (!Array.isArray(pending) || pending.length === 0) return;

  for (const post of pending) {
    try {
      if (post.is_repost || !SCHEDULE_HINT_RE.test(post.text || "")) {
        await sbFetch(`social_posts?id=eq.${encodeURIComponent(post.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ schedule_parsed: true }),
        });
        continue;
      }

      const prompt = `你是 VTuber MilkyTube (みるきぃ) 的日程提取助手。
发布时间(UTC): ${post.published_at}
来源平台: ${post.platform}
正文:
${post.text}

如果正文包含**明确的直播/配信预告日期和时间**，请提取为 JSON 数组（无明确开播时间返回 []）。
日文“21時”默认日本时间 +09:00，中文“20点”默认北京时间 +08:00。
格式：[{"title":"简短直播标题","start_time":"ISO8601如2026-11-26T21:00:00+09:00","platform":"三台同播"|"Bilibili"|"YouTube"|"Twitch","category":"game"|"watchalong"|"singing"|"bilibili"|"collab","notes":"备注"}]`;

      const parsed = await callGeminiJson(prompt, 0.1);
      if (!Array.isArray(parsed)) continue;
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (let i = 0; i < parsed.length; i++) {
          const ev = parsed.at(i);
          if (!ev?.title || !ev?.start_time) continue;
          const dt = new Date(ev.start_time);
          if (Number.isNaN(dt.getTime())) continue;

          const endDt = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
          const row = {
            id: `auto-${post.platform}-${post.post_id}-${i}`,
            title: String(ev.title).slice(0, 120),
            start_iso: dt.toISOString(),
            end_iso: endDt.toISOString(),
            platform: ["三台同播", "Bilibili", "YouTube", "Twitch"].includes(ev.platform) ? ev.platform : "三台同播",
            category: ["game", "watchalong", "singing", "bilibili", "collab"].includes(ev.category) ? ev.category : "game",
            source_url: post.url,
          };
          await sbFetch("schedules?on_conflict=id", {
            method: "POST",
            headers: { Prefer: "resolution=ignore-duplicates" },
            body: JSON.stringify(row),
          });
          console.log(`📅 已自动写入日历：${row.title} (${row.start_time})`);
        }
      }

      await sbFetch(`social_posts?id=eq.${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ schedule_parsed: true }),
      });
    } catch (err) {
      console.warn(`⚠️ 日程解析跳过 (${post.id}):`, err.message);
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
    fetchTwitterPosts(),
  ]);
  const allPosts = [...biliPosts, ...xPosts];

  if (allPosts.length > 0) {
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
    } else {
      console.log("✅ 抓取到的动态与推文均已在库中");
    }
  }

  await translatePendingPosts();
  await parsePendingSchedules();
}

main().catch((err) => {
  console.error("❌ 同步任务异常：", err);
  process.exit(1);
});
