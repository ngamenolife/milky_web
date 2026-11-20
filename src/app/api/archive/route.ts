import { NextRequest, NextResponse } from "next/server";
import { fetchBilibiliVideos } from "@/lib/bilibili";
import { fetchYouTubeRss, SEED_VIDEOS } from "@/lib/data";
import { mergeVideosIdempotent } from "@/lib/ics";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const platform = req.nextUrl.searchParams.get("platform") ?? "all";

  // 以 B 站投稿为主，YouTube RSS 作为补充
  const [biliRes, ytVideos] = await Promise.all([
    fetchBilibiliVideos(18),
    fetchYouTubeRss(),
  ]);

  const combined = mergeVideosIdempotent(
    mergeVideosIdempotent(SEED_VIDEOS, ytVideos),
    biliRes.items
  );

  const filtered = combined.filter((v) => {
    const matchPlatform = platform === "all" || v.platform === platform;
    const matchQ = !q || v.title.toLowerCase().includes(q);
    return matchPlatform && matchQ;
  });

  return NextResponse.json({
    items: filtered,
    total: filtered.length,
    bilibiliSource: biliRes.source,
  });
}
