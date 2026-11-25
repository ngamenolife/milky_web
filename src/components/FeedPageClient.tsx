"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Repeat2, Search, Sparkles, X } from "lucide-react";
import TopNav from "@/components/TopNav";
import { useLocale } from "@/components/LocaleProvider";

interface SocialPost {
  id: string;
  platform: "bilibili" | "twitter";
  post_id: string;
  published_at: string;
  text: string;
  text_zh?: string | null;
  images: string[];
  url: string;
  is_repost: boolean;
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function formatTime(iso: string, isJa: boolean) {
  try {
    return new Intl.DateTimeFormat(isJa ? "ja-JP" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function FeedPageClient() {
  const { locale } = useLocale();
  const isJa = locale === "ja";

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState<"all" | "bilibili" | "twitter">("all");
  const [hideRepost, setHideRepost] = useState(false);
  const [query, setQuery] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setError(isJa ? "Supabase 未設定のため読み込めません。" : "未配置 Supabase，无法加载动态。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/social_posts?select=*&order=published_at.desc&limit=80`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SocialPost[];
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        isJa
          ? "読み込みに失敗しました。しばらくしてから再試行してください。"
          : "动态加载失败，请稍后点击刷新重试。"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isJa]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (platform !== "all" && p.platform !== platform) return false;
      if (hideRepost && p.is_repost) return false;
      if (q && !(p.text || "").toLowerCase().includes(q) && !(p.text_zh || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, platform, hideRepost, query]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <TopNav />

      <section className="mb-6 rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-stone-900">
              <Sparkles className="h-6 w-6 text-milky-500" />
              {isJa ? "Bilibili & X タイムライン" : "橘猫跨平台动态墙"}
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              {isJa
                ? "Bilibiliの投稿とX(@MilkyVtuber)のポストを時系列でまとめてチェック！"
                : "自动汇总 Milky 的 B 站动态与 X (@MilkyVtuber) 推文，按时间倒序排列"}
            </p>
          </div>
          <button
            type="button"
            onClick={loadPosts}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {isJa ? "更新" : "刷新动态"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 text-xs font-semibold">
            {(
              [
                { id: "all", label: isJa ? "すべて" : "全部" },
                { id: "bilibili", label: "Bilibili" },
                { id: "twitter", label: "X (Twitter)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlatform(tab.id)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
                  platform === tab.id
                    ? "bg-white text-milky-600 shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">
            <input
              type="checkbox"
              checked={hideRepost}
              onChange={(e) => setHideRepost(e.target.checked)}
              className="accent-orange-500"
            />
            {isJa ? "RT/転載を非表示" : "隐藏转发"}
          </label>

          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isJa ? "キーワードで検索..." : "搜索动态内容..."}
              className="w-full rounded-xl border border-stone-200 bg-white py-1.5 pr-3 pl-8 text-xs text-stone-800 outline-none focus:border-orange-400"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="rounded-3xl border border-stone-100 bg-white p-10 text-center text-sm text-stone-400">
          {isJa ? "タイムラインを読み込み中..." : "正在加载最新动态..."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-stone-100 bg-white p-10 text-center text-sm text-stone-400">
          {isJa
            ? "まだ表示できる投稿がありません（自動同期後に表示されます）"
            : "暂无符合条件的动态（触发一次 GitHub Actions 同步后就会显示）"}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const isBili = post.platform === "bilibili";
            const imgs = Array.isArray(post.images) ? post.images : [];
            return (
              <article
                key={post.id}
                className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${
                        isBili ? "bg-pink-500" : "bg-stone-900"
                      }`}
                    >
                      {isBili ? "Bilibili" : "X / Twitter"}
                    </span>
                    {post.is_repost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                        <Repeat2 className="h-3 w-3" />
                        {isJa ? "リポスト" : "转发"}
                      </span>
                    )}
                    <time className="text-xs text-stone-400">
                      {formatTime(post.published_at, isJa)}
                    </time>
                  </div>

                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    {isJa ? "元の投稿を見る" : "查看原帖"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                {!isJa && post.text_zh ? (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
                      {post.text_zh}
                    </p>
                    <div className="whitespace-pre-wrap break-words rounded-2xl bg-stone-50 px-3.5 py-2.5 text-xs leading-relaxed text-stone-500">
                      <span className="mr-1.5 inline-block rounded bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
                        原文
                      </span>
                      {post.text}
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
                    {post.text}
                  </p>
                )}

                {imgs.length > 0 && (
                  <div
                    className={`mt-3 grid gap-2 ${
                      imgs.length === 1
                        ? "max-w-md grid-cols-1"
                        : imgs.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-2 sm:grid-cols-3"
                    }`}
                  >
                    {imgs.map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewImg(src)}
                        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-stone-100 bg-stone-50"
                      >
                        <img
                          src={src}
                          alt="post attachment"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setPreviewImg(null)}
            aria-label="Close preview"
            className="absolute top-4 right-4 cursor-pointer rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImg}
            alt="preview"
            referrerPolicy="no-referrer"
            className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </main>
  );
}
