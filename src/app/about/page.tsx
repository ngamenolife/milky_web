import AboutPageClient from "@/components/AboutPageClient";
import { readFeaturedVideos } from "@/lib/store";


export default function AboutPage() {
  const initialVideos = readFeaturedVideos();
  return <AboutPageClient initialVideos={initialVideos} />;
}
