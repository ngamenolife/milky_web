export interface FeaturedVideo {
  id: string;
  title: string;
  bvid: string;
  page?: number;
  tag: string;
  reason: string;
  contributor: string;
  addedAt: string;
}

export function validateFeaturedVideo(input: Partial<FeaturedVideo>): {
  ok: boolean;
  error?: string;
} {
  if (!input.title || input.title.trim().length < 1 || input.title.length > 100) {
    return { ok: false, error: "视频标题不能为空且需在 100 字以内" };
  }
  if (!input.bvid || !/^BV[a-zA-Z0-9]{8,14}$/.test(input.bvid.trim())) {
    return { ok: false, error: "请输入合法的 B 站 BV 号（如 BV1ab411x7FA）" };
  }
  return { ok: true };
}

export const SEED_FEATURED_VIDEOS: FeaturedVideo[] = [
  {
    id: "feat-intro-1",
    title: "【自我介绍 ①】にゃほーい！宇宙猫耳族 Milky 登场！",
    bvid: "BV1ab411x7FA",
    page: 1,
    tag: "入坑必看",
    reason: "官方自我介绍视频，快速认识橘猫 Milky 的人设与多变声线！",
    contributor: "站长初始收录",
    addedAt: "2026-11-20",
  },
  {
    id: "feat-intro-2",
    title: "【自我介绍 ②】欢迎来到 MilkyTube 的世界！",
    bvid: "BV1Rb411W7Ly",
    page: 1,
    tag: "自我介绍",
    reason: "新人入坑第二弹自我介绍，感受元气满满的猫耳实况主～",
    contributor: "站长初始收录",
    addedAt: "2026-11-20",
  },
];
