import fs from "node:fs";
import path from "node:path";

const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJPNd_nAzGkXdL4Wy87ADg";
const OUT_FILE = path.resolve(process.cwd(), "data/youtube-cache.json");

async function main() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error("RSS fetch failed: " + res.status);
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  const parsed = entries
    .map((e) => ({
      id: "yt-" + (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? ""),
      title: e.match(/<title>([^<]+)<\/title>/)?.[1] ?? "",
      publishedAt: e.match(/<published>([^<]+)<\/published>/)?.[1] ?? "",
    }))
    .filter((x) => x.id !== "yt-");

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2), "utf8");
  console.log("Synced " + parsed.length + " YouTube videos -> " + OUT_FILE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
