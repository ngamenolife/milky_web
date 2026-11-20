import { NextRequest, NextResponse } from "next/server";
import { computeScheduleStats } from "@/lib/ics";
import {
  appendScheduleToStore,
  deleteScheduleFromStore,
  readScheduleStore,
  updateScheduleInStore,
  validateScheduleInput,
} from "@/lib/store";
import type { ScheduleCategory, ScheduleItem, SchedulePlatform } from "@/lib/types";

export const dynamic = "force-dynamic";

function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

function safeCategory(c: unknown): ScheduleCategory {
  if (c === "singing" || c === "watchalong" || c === "bilibili" || c === "collab") return c;
  return "game";
}

function safePlatform(p: unknown): SchedulePlatform {
  if (
    p === "三台同播" ||
    p === "Twitch" ||
    p === "Twitch + YouTube" ||
    p === "YouTube" ||
    p === "Bilibili"
  ) {
    return p;
  }
  return "三台同播";
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const all = readScheduleStore();
  const items =
    category && category !== "all" ? all.filter((i) => i.category === category) : all;
  return NextResponse.json({ items, stats: computeScheduleStats(all) });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ScheduleItem>;
    const check = validateScheduleInput(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const result = appendScheduleToStore({
      title: body.title!.trim(),
      category: safeCategory(body.category),
      platform: safePlatform(body.platform),
      startIso: new Date(body.startIso!).toISOString(),
      endIso: new Date(body.endIso!).toISOString(),
      sourceUrl: body.sourceUrl?.trim() || undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能修改日程" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<ScheduleItem>;
    if (!body.id) return NextResponse.json({ error: "缺少日程 ID" }, { status: 400 });
    const check = validateScheduleInput(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const result = updateScheduleInStore(body.id, {
      title: body.title!.trim(),
      category: safeCategory(body.category),
      platform: safePlatform(body.platform),
      startIso: new Date(body.startIso!).toISOString(),
      endIso: new Date(body.endIso!).toISOString(),
      sourceUrl: body.sourceUrl?.trim() || undefined,
    });
    if (!result.found) return NextResponse.json({ error: "未找到对应日程" }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "需要管理员口令才能删除日程" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少日程 ID" }, { status: 400 });
  const result = deleteScheduleFromStore(id);
  if (!result.found) return NextResponse.json({ error: "未找到对应日程" }, { status: 404 });
  return NextResponse.json({ ok: true, saved: result.saved }, { status: 200 });
}
