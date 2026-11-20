import { generateIcs } from "@/lib/ics";
import type { ScheduleItem } from "@/lib/types";

export function downloadScheduleIcs(items: ScheduleItem[]) {
  const content = generateIcs(items);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "milkytube-schedule.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
