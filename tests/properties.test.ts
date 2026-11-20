import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseRssHubItems, signWbiParams } from "@/lib/bilibili";
import {
  computeScheduleStats,
  generateIcs,
  mergeVideosIdempotent,
  parseIcs,
} from "@/lib/ics";
import { dict } from "@/lib/i18n";
import {
  buildBiliEmbedUrl,
  formatSecToTime,
  parseTimeToSec,
  validateSongInput,
} from "@/lib/songs";
import type { ScheduleCategory, ScheduleItem, SchedulePlatform, VideoItem } from "@/lib/types";

const catArb = fc.constantFrom<ScheduleCategory>("game", "singing", "watchalong", "bilibili", "collab");
const platArb = fc.constantFrom<SchedulePlatform>("三台同播", "Twitch", "Twitch + YouTube", "YouTube", "Bilibili");
const safeStrArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.replace(/\r\n|\r/g, "\n"));

const scheduleArb: fc.Arbitrary<ScheduleItem> = fc
  .record({
    id: fc.stringMatching(/^[a-zA-Z0-9_-]{3,16}$/),
    title: safeStrArb,
    category: catArb,
    platform: platArb,
    ts: fc.integer({ min: 1700000000000, max: 1850000000000 }),
  })
  .map(({ ts, ...rest }) => {
    const start = new Date(Math.floor(ts / 1000) * 1000);
    const end = new Date(start.getTime() + 3600 * 1000);
    return { ...rest, startIso: start.toISOString(), endIso: end.toISOString() };
  });

const videoArb: fc.Arbitrary<VideoItem> = fc.record({
  id: fc.stringMatching(/^[a-zA-Z0-9_-]{3,16}$/),
  title: safeStrArb,
  platform: fc.constantFrom<"YouTube" | "Bilibili">("YouTube", "Bilibili"),
  tag: fc.constantFrom<"game" | "singing" | "clip">("game", "singing", "clip"),
  publishedAt: fc
    .integer({ min: 1700000000000, max: 1850000000000 })
    .map((t) => new Date(t).toISOString()),
  url: fc.constant("https://www.bilibili.com/video/BV15hsL6eEJ4"),
  thumbnail: fc.constant("https://i0.hdslb.com/bfs/archive/demo.jpg"),
});

describe("MilkyTube 属性测试 (Property-Based Testing)", () => {
  it("ICS 往返一致 (含三台同播平台)", () => {
    fc.assert(
      fc.property(fc.array(scheduleArb, { maxLength: 10 }), (items) => {
        expect(parseIcs(generateIcs(items))).toEqual(items);
      })
    );
  });

  it("视频合并幂等性 (Idempotency)", () => {
    fc.assert(
      fc.property(
        fc.array(videoArb, { maxLength: 10 }),
        fc.array(videoArb, { maxLength: 10 }),
        (existing, incoming) => {
          const once = mergeVideosIdempotent(existing, incoming);
          const twice = mergeVideosIdempotent(once, incoming);
          expect(twice).toEqual(once);
        }
      )
    );
  });

  it("日程统计不变量 (Invariant)", () => {
    fc.assert(
      fc.property(fc.array(scheduleArb, { maxLength: 20 }), (items) => {
        const stats = computeScheduleStats(items);
        const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
        expect(sum).toBe(stats.total);
      })
    );
  });

  it("歌回点唱机时间轴往返一致 & 支持仅填歌名入歌单", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 18000 }), (sec) => {
        expect(parseTimeToSec(formatSecToTime(sec))).toBe(sec);
      })
    );
    expect(validateSongInput({ title: "Lemon" }).ok).toBe(true);
    expect(validateSongInput({ title: "Lemon", bvid: "invalid" }).ok).toBe(false);
  });

  it("B站外链播放器 URL 构造安全", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^BV[a-zA-Z0-9]{8,12}$/),
        fc.integer({ min: -100, max: 10000 }),
        (bvid, sec) => {
          const url = buildBiliEmbedUrl(bvid, sec);
          expect(url.startsWith("https://player.bilibili.com/player.html?")).toBe(true);
          expect(url).toContain("bvid=" + bvid);
          expect(url).toContain("t=" + Math.max(0, sec));
        }
      )
    );
  });

  it("B站 WBI 签名不变量", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 32, maxLength: 32 }),
        fc.string({ minLength: 32, maxLength: 32 }),
        fc.integer({ min: 1, max: 999999999 }),
        (imgKey, subKey, mid) => {
          const qs = signWbiParams({ mid, kw: "test!'()*" }, imgKey, subKey, 1700000000);
          expect(qs).toMatch(/&w_rid=[a-f0-9]{32}$/);
        }
      )
    );
  });

  it("RSSHub JSON 解析不变量", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^BV[a-zA-Z0-9]{10}$/),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        (bvid, title) => {
          const items = parseRssHubItems({
            items: [
              {
                url: "https://www.bilibili.com/video/" + bvid,
                title,
                content_html: '<img src="http://i0.hdslb.com/bfs/archive/test.jpg" />',
                date_published: "2026-11-20T08:00:00.000Z",
              },
            ],
          });
          expect(items).toHaveLength(1);
          expect(items[0].id).toBe("bili-" + bvid);
        }
      )
    );
  });

  it("全站中/日双语词典键 100% 对齐 (zh vs ja)", () => {
    expect(Object.keys(dict.zh).sort()).toEqual(Object.keys(dict.ja).sort());
  });
});
