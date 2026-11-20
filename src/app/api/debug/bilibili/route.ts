import { NextResponse } from "next/server";
import { BILIBILI_UID, fetchBilibiliVideos } from "@/lib/bilibili";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchBilibiliVideos(10);
  return NextResponse.json({
    uid: BILIBILI_UID,
    activeSource: result.source,
    count: result.items.length,
    diagnostics: result.diagnostics,
    sampleTitles: result.items.slice(0, 5).map((i) => i.title),
  });
}
