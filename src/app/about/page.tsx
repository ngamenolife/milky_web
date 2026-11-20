import AboutPageClient from "@/components/AboutPageClient";
import { readFeaturedVideos } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  const initialVideos = readFeaturedVideos();
  return <AboutPageClient initialVideos={initialVideos} />;
}
