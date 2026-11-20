import { NextResponse } from "next/server";
import { fetchBilibiliLiveStatus } from "@/lib/bilibili";
import type { LiveStatus } from "@/lib/types";

export const revalidate = 60;

export async function GET() {
  const bili = await fetchBilibiliLiveStatus();
  const payload: LiveStatus = {
    youtube: {
      isLive: false,
      title: "YouTube 频道 (@milkytube0411)",
      url: "https://www.youtube.com/@milkytube0411/live",
    },
    bilibili: {
      isLive: bili.isLive,
      url: bili.url,
    },
    checkedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
