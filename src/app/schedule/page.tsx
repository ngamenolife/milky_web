import SchedulePageClient from "@/components/SchedulePageClient";
import { readScheduleStore } from "@/lib/store";


export default function SchedulePage() {
  const initialSchedule = readScheduleStore();
  return <SchedulePageClient initialSchedule={initialSchedule} />;
}
