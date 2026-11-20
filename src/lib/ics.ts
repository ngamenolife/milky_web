import type { ScheduleCategory, ScheduleItem, SchedulePlatform, VideoItem } from "./types";

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function unescapeIcs(value: string): string {
  return value.replace(/\\([\\n,;])/g, (_, ch: string) =>
    ch === "n" ? "\n" : ch
  );
}

function toIcsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function fromIcsDate(icsDate: string): string {
  const m = icsDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) throw new Error("Invalid ICS date: " + icsDate);
  return m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + ".000Z";
}

function parsePlatform(raw: string): SchedulePlatform {
  if (
    raw === "三台同播" ||
    raw === "Twitch" ||
    raw === "Twitch + YouTube" ||
    raw === "Bilibili" ||
    raw === "YouTube"
  ) {
    return raw;
  }
  return "三台同播";
}

export function generateIcs(items: ScheduleItem[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MilkyTube Fan Portal//Schedule//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const item of items) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + escapeIcs(item.id),
      "DTSTART:" + toIcsDate(item.startIso),
      "DTEND:" + toIcsDate(item.endIso),
      "SUMMARY:" + escapeIcs(item.title),
      "CATEGORIES:" + item.category,
      "LOCATION:" + escapeIcs(item.platform),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function parseIcs(icsText: string): ScheduleItem[] {
  const blocks = icsText.split("BEGIN:VEVENT").slice(1);
  return blocks.map((block) => {
    const body = block.split("END:VEVENT")[0] ?? "";
    const map: Record<string, string> = {};
    for (const rawLine of body.split(/\r?\n/)) {
      const idx = rawLine.indexOf(":");
      if (idx > 0) map[rawLine.slice(0, idx)] = rawLine.slice(idx + 1);
    }
    return {
      id: unescapeIcs(map.UID ?? ""),
      title: unescapeIcs(map.SUMMARY ?? ""),
      category: (map.CATEGORIES as ScheduleCategory) || "game",
      platform: parsePlatform(unescapeIcs(map.LOCATION ?? "")),
      startIso: fromIcsDate(map.DTSTART ?? ""),
      endIso: fromIcsDate(map.DTEND ?? ""),
    };
  });
}

export function computeScheduleStats(items: ScheduleItem[]) {
  const byCategory: Record<ScheduleCategory, number> = {
    game: 0,
    singing: 0,
    watchalong: 0,
    bilibili: 0,
    collab: 0,
  };
  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }
  return { total: items.length, byCategory };
}

export function mergeVideosIdempotent(
  existing: VideoItem[],
  incoming: VideoItem[]
): VideoItem[] {
  const map = new Map<string, VideoItem>();
  for (const v of existing) map.set(v.id, v);
  for (const v of incoming) map.set(v.id, v);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
