import { NextRequest, NextResponse } from "next/server";
import { validateFeaturedVideo, type FeaturedVideo } from "@/lib/featured";
import {
  appendFeaturedVideo,
  deleteFeaturedVideo,
  readFeaturedVideos,
  updateFeaturedVideo,
} from "@/lib/store";

export const dynamic = "force-dynamic";

function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET() {
  return NextResponse.json({ items: readFeaturedVideos() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<FeaturedVideo>;
    const check = validateFeaturedVideo(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const result = appendFeaturedVideo({
      title: body.title!.trim(),
      bvid: body.bvid!.trim(),
      page: Number(body.page) > 0 ? Number(body.page) : 1,
      tag: (body.tag ?? "粉丝安利").trim() || "粉丝安利",
      reason: (body.reason ?? "粉丝精选推荐").trim() || "粉丝精选推荐",
      contributor: (body.contributor ?? "匿名みるにゃんず").trim() || "匿名みるにゃんず",
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能修改视频" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<FeaturedVideo>;
    if (!body.id) return NextResponse.json({ error: "缺少视频 ID" }, { status: 400 });
    const check = validateFeaturedVideo(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const result = updateFeaturedVideo(body.id, {
      title: body.title!.trim(),
      bvid: body.bvid!.trim(),
      page: Number(body.page) > 0 ? Number(body.page) : 1,
      tag: (body.tag ?? "粉丝安利").trim() || "粉丝安利",
      reason: (body.reason ?? "").trim(),
      contributor: (body.contributor ?? "匿名みるにゃんず").trim() || "匿名みるにゃんず",
    });
    if (!result.found) return NextResponse.json({ error: "未找到对应视频" }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能删除视频" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少视频 ID" }, { status: 400 });
  const result = deleteFeaturedVideo(id);
  if (!result.found) return NextResponse.json({ error: "未找到对应视频" }, { status: 404 });
  return NextResponse.json({ ok: true, saved: result.saved }, { status: 200 });
}
