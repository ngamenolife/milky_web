import SchedulePageClient from "@/components/SchedulePageClient";
import { readScheduleStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const initialSchedule = readScheduleStore();
  return <SchedulePageClient initialSchedule={initialSchedule} />;
}
