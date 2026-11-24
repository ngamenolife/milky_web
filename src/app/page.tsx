import LivePreviewStrip from "@/components/LivePreviewStrip";
import PortalApp from "@/components/PortalApp";
import { fetchBilibiliVideos } from "@/lib/bilibili";
import { fetchYouTubeRss, SEED_VIDEOS } from "@/lib/data";
import { mergeVideosIdempotent } from "@/lib/ics";
import { readScheduleStore, readSongsStore } from "@/lib/store";


export default async function HomePage() {
  const [biliRes, ytVideos] = await Promise.all([
    fetchBilibiliVideos(18),
    fetchYouTubeRss(),
  ]);
  const initialVideos = mergeVideosIdempotent(
    mergeVideosIdempotent(SEED_VIDEOS, ytVideos),
    biliRes.items
  );
  const songsStore = readSongsStore();
  const initialSchedule = readScheduleStore();

  return (
    <>
      <LivePreviewStrip />
      <PortalApp
      initialSchedule={initialSchedule}
      initialVideos={initialVideos}
      initialSongs={songsStore.songs}
      initialUnindexed={songsStore.unindexedStreams}
    />
    </>
  );
}
