import { NextRequest, NextResponse } from "next/server";
import { validateSongInput, type SongItem } from "@/lib/songs";
import {
  appendSongToStore,
  deleteSongFromStore,
  readSongsStore,
  updateSongInStore,
} from "@/lib/store";

export const dynamic = "force-dynamic";

function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const genre = req.nextUrl.searchParams.get("genre") ?? "all";
  const store = readSongsStore();

  const items = store.songs.filter((s) => {
    const okGenre =
      genre === "all" ||
      (genre === "推荐"
        ? s.tags.includes("推荐")
        : genre === "歌单"
        ? s.tags.includes("歌单") || !s.bvid
        : s.genre === genre);
    const okQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.streamTitle.toLowerCase().includes(q);
    return okGenre && okQ;
  });

  return NextResponse.json({
    items,
    unindexedStreams: store.unindexedStreams,
    total: items.length,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SongItem>;
    const check = validateSongInput(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const bvid = (body.bvid ?? "").trim();
    const rawTags = Array.isArray(body.tags) ? [...body.tags] : [];
    if (!bvid && !rawTags.includes("歌单")) rawTags.push("歌单");

    const result = appendSongToStore({
      title: body.title!.trim(),
      artist: (body.artist ?? "待补充").trim() || "待补充",
      language: body.language === "zh" || body.language === "en" ? body.language : "ja",
      genre: (body.genre ?? (bvid ? "动漫" : "歌单")).trim() || "歌单",
      tags: rawTags,
      bvid: bvid || undefined,
      page: Number(body.page) > 0 ? Number(body.page) : 1,
      startTime: (body.startTime ?? "").trim() || (bvid ? "00:00" : ""),
      date: (body.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
      streamTitle:
        (body.streamTitle ?? "").trim() || (bvid ? "粉丝贡献时间轴" : "点歌单收录"),
      contributor: (body.contributor ?? "匿名粉丝").trim() || "匿名粉丝",
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能修改曲目" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<SongItem>;
    if (!body.id) return NextResponse.json({ error: "缺少曲目 ID" }, { status: 400 });
    const check = validateSongInput(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const bvid = (body.bvid ?? "").trim();
    const rawTags = Array.isArray(body.tags) ? [...body.tags] : [];
    if (!bvid && !rawTags.includes("歌单")) rawTags.push("歌单");

    const result = updateSongInStore(body.id, {
      title: body.title!.trim(),
      artist: (body.artist ?? "待补充").trim() || "待补充",
      language: body.language === "zh" || body.language === "en" ? body.language : "ja",
      genre: (body.genre ?? "动漫").trim() || "动漫",
      tags: rawTags,
      bvid: bvid || undefined,
      page: Number(body.page) > 0 ? Number(body.page) : 1,
      startTime: (body.startTime ?? "").trim() || (bvid ? "00:00" : ""),
      date: (body.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
      streamTitle: (body.streamTitle ?? "").trim(),
      contributor: body.contributor?.trim() || undefined,
    });

    if (!result.found) return NextResponse.json({ error: "未找到对应曲目" }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能删除曲目" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少曲目 ID" }, { status: 400 });
  const result = deleteSongFromStore(id);
  if (!result.found) return NextResponse.json({ error: "未找到对应曲目" }, { status: 404 });
  return NextResponse.json({ ok: true, saved: result.saved }, { status: 200 });
}
