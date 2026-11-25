/**
 * 定时同步 Milky (UID 410741448 / @MilkyVtuber) 的 B站动态与 X 推文到 Supabase
 * 并使用 Gemini 2.5 Flash 自动：1) 将日文动态/推文翻译为自然中文；2) 提取开播预告写入 schedules
 */

const BILI_UID = "410741448";
const X_HANDLE = "MilkyVtuber";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BILIBILI_COOKIE = process.env.BILIBILI_COOKIE || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const X_RSS_URL = (process.env.X_RSS_URL || "").trim();
const TWITTERAPI_IO_KEY = (process.env.TWITTERAPI_IO_KEY || "").trim();

const DEFAULT_NITTER_HOSTS = [
  "nitter.jaydenha.uk",
  "d420.net",
  "nitter.privacyredirect.com",
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

function parseRssXmlToTweets(xml, host = "") {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const posts = [];
  for (const block of items.slice(0, 20)) {
    const title = decodeEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.at(1) || "");
    const link = decodeEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.at(1) || "").trim();
    const guid = decodeEntities(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.at(1) || "").trim();
    const pubDate = decodeEntities(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.at(1) || "").trim();
    const desc = block.match(/<description>([\s\S]*?)<\/description>/)?.at(1) || "";

    const postId = (link + " " + guid).match(/\/status\/(\d+)/)?.at(1);
    if (!postId) continue;
    const parsedTime = new Date(pubDate);
    if (Number.isNaN(parsedTime.getTime())) continue;

    const imgMatches = [
      ...decodeEntities(desc).matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
      ...block.matchAll(/<media:content[^>]+url=["']([^"']+)["']/gi),
      ...block.matchAll(/<enclosure[^>]+url=["']([^"']+)["']/gi),
    ];
    const images = [...new Set(imgMatches.map((m) => normalizeNitterImg(m.at(1), host)).filter(Boolean))].slice(0, 9);

    const isRepost = /^RT\s+(by\s+)?@/i.test(title) || /^RT by\s+/i.test(title);
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

// ---------- 2. 抓取 X (Twitter) 推文（4 层自动通道） ----------
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
      console.warn("⚠️ TwitterAPI.io 抓取失败：", err.message);
    }
  }

  if (X_RSS_URL) {
    try {
      const res = await fetch(X_RSS_URL, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const xml = await res.text();
        const posts = parseRssXmlToTweets(xml);
        if (posts.length > 0) {
          console.log(`✅ X 推文抓取成功（自定义 RSS）：${posts.length} 条`);
          return posts;
        }
      } else {
        console.warn(`⚠️ 自定义 X_RSS_URL 返回 HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("⚠️ 自定义 X_RSS_URL 抓取失败：", err.message);
    }
  }

  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(X_HANDLE)}`,
      { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(15000) }
    );
    if (res.ok) {
      const html = await res.text();
      const nextJson = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.at(1);
      if (nextJson) {
        const nextData = JSON.parse(nextJson);
        const entries = nextData?.props?.pageProps?.timeline?.entries || [];
        const posts = [];
        for (const entry of entries.slice(0, 20)) {
          const tw = entry?.content?.tweet;
          if (!tw?.id_str) continue;
          const postId = String(tw.id_str);
          const created = new Date(tw.created_at || Date.now());
          if (Number.isNaN(created.getTime())) continue;
          const media = tw.extended_entities?.media || tw.entities?.media || [];
          const images = media.map((m) => m.media_url_https || m.media_url).filter(Boolean).slice(0, 9);
          posts.push({
            id: `twitter:${postId}`,
            platform: "twitter",
            post_id: postId,
            published_at: created.toISOString(),
            text: String(tw.full_text || tw.text || "").trim() || "（无正文推文）",
            images,
            url: `https://x.com/${X_HANDLE}/status/${postId}`,
            is_repost: Boolean(tw.retweeted_status_id_str || /^RT @/i.test(tw.full_text || "")),
          });
        }
        if (posts.length > 0) {
          console.log(`✅ X 推文抓取成功（官方 Syndication）：${posts.length} 条`);
          return posts;
        }
      }
    } else {
      console.warn(`⚠️ X Syndication 返回 HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("⚠️ X Syndication 抓取失败：", err.message);
  }

  const tried = new Set();
  for (const host of NITTER_HOSTS) {
    if (tried.has(host)) continue;
    tried.add(host);
    try {
      const res = await fetch(`https://${host}/${X_HANDLE}/rss`, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.warn(`⚠️ Nitter 节点 ${host} 返回 HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const posts = parseRssXmlToTweets(xml, host);
      if (posts.length > 0) {
        console.log(`✅ X 推文抓取成功（Nitter ${host}）：${posts.length} 条`);
        return posts;
      }
    } catch (err) {
      console.warn(`⚠️ Nitter 节点 ${host} 失败：`, err.message);
    }
  }

  console.warn("⚠️ 全部 X 通道暂不可用，建议去 rss.app 生成免费 RSS 填入 GitHub Secrets: X_RSS_URL");
  return [];
}

// ---------- 3. Supabase 读写辅助 ----------
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

// ---------- 4. Gemini 批量日译中（含历史旧帖自动补翻） ----------
async function translatePendingPosts() {
  if (!GEMINI_API_KEY) {
    console.log("ℹ️ 未配置 GEMINI_API_KEY，跳过自动翻译");
    return;
  }
  const pending = await sbFetch("social_posts?select=id,text&text_zh=is.null&order=published_at.desc&limit=25");
  if (!Array.isArray(pending) || pending.length === 0) return;

  const needTranslate = [];
  for (const row of pending) {
    const t = String(row.text || "").trim();
    // 含日文假名或纯英文推文才调用翻译，纯中文动态直接标记为空串免重复扫
    if (t && /[\u3040-\u30ff]/.test(t)) {
      needTranslate.push({ id: row.id, text: t });
    } else {
      await sbFetch(`social_posts?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ text_zh: "" }),
      });
    }
  }
  if (needTranslate.length === 0) return;

  for (let i = 0; i < needTranslate.length; i += 10) {
    const batch = needTranslate.slice(i, i + 10);
    try {
      const prompt = `你是 VTuber 字幕组翻译，请将以下 Milky (みるきぃ) 的日文动态/推文精准翻译成自然、可爱的简体中文。
要求：
1. 准确使用二次元/VTuber 圈常用译法（如：配信=直播、歌枠=歌回、同時視聴=同时视听、メン限=会员限定、耐久=耐久、おつみる=辛苦啦）。
2. 保留原有的换行、emoji、游戏名和人名，不要添加多余解释。
3. 严格返回一个 JSON 对象，key 为输入中的 id，value 为对应的简体中文翻译。

输入数据：
${JSON.stringify(batch)}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!res.ok) {
        console.warn(`⚠️ Gemini 翻译接口返回 HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const raw = data?.candidates?.at(0)?.content?.parts?.at(0)?.text || "{}";
      const map = JSON.parse(raw.replace(/^```json|```$/g, "").trim());

      let count = 0;
      for (const item of batch) {
        const zh = typeof map[item.id] === "string" ? map[item.id].trim() : "";
        if (!zh) continue;
        await sbFetch(`social_posts?id=eq.${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ text_zh: zh }),
        });
        count++;
      }
      console.log(`🈳 本批已自动翻译 ${count} 条动态/推文为中文`);
    } catch (err) {
      console.warn("⚠️ Gemini 批量翻译失败：", err.message);
    }
  }
}

// ---------- 5. Gemini 自动解析开播预告写入 schedules ----------
const SCHEDULE_HINT_RE = /(配信|予定|直播|开播|開播|歌枠|歌回|同時視聴|同时视听|FF14|枠|時|点|\d{1,2}[:：]\d{2})/i;

async function extractAndSaveSchedules(newPosts) {
  if (!GEMINI_API_KEY) return;
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
      const raw = data?.candidates?.at(0)?.content?.parts?.at(0)?.text || "[]";
      const parsed = JSON.parse(raw.replace(/^```json|```$/g, "").trim());
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      for (let i = 0; i < parsed.length; i++) {
        const ev = parsed.at(i);
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
      await extractAndSaveSchedules(newPosts);
    } else {
      console.log("✅ 所有抓取到的动态与推文均已是最新");
    }
  }

  // 自动翻译所有还没翻译的日文帖子（含刚入库和之前未翻的旧帖）
  await translatePendingPosts();
}

main().catch((err) => {
  console.error("❌ 同步任务异常：", err);
  process.exit(1);
});
