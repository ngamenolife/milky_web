import { NextResponse } from "next/server";
import { generateIcs } from "@/lib/ics";
import { readScheduleStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ics = generateIcs(readScheduleStore());
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="milkytube-schedule.ics"',
    },
  });
}
