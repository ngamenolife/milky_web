import type { Metadata } from "next";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MilkyTube 粉丝站 | みるきぃ Fan Portal",
  description: "非官方 MilkyTube (みるきぃ / 宇宙猫耳族) 跨平台直播日历、专属歌台与档案门户",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
