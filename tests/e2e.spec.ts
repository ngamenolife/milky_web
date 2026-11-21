import { test, expect } from "@playwright/test";

test("核心路径 + 歌回点唱机 E2E 冒烟测试", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // 1. 首页加载与歌回点唱机检查
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/Milky|みるきぃ/i, { timeout: 15000 });

  const searchInput = page.getByTestId("jukebox-search");
  if (await searchInput.isVisible().catch(() => false)) {
    const songItems = page.locator("[data-testid^=\"song-item-\"]");
    if (await songItems.first().isVisible({ timeout: 8000 }).catch(() => false)) {
      await songItems.first().click();
      await expect(page.getByTestId("now-playing-title")).toBeVisible();
      const nowTitle = ((await page.getByTestId("now-playing-title").textContent()) || "").trim();
      if (nowTitle) {
        await searchInput.fill(nowTitle.slice(0, 4));
        await expect(songItems.first()).toBeVisible();
        await searchInput.fill("");
      }
      const iframe = page.getByTestId("jukebox-iframe");
      if (await iframe.isVisible().catch(() => false)) {
        const iframeSrc = await iframe.getAttribute("src");
        expect(iframeSrc).toContain("player.bilibili.com/player.html");
      }
    }
  }

  // 2. 日历页加载检查
  const schedRes = await page.goto("/schedule", { waitUntil: "domcontentloaded" });
  expect(schedRes?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toContainText(/日历|日程|スケジュール|Schedule/i, { timeout: 10000 });

  // 3. 关于页加载检查
  const aboutRes = await page.goto("/about", { waitUntil: "domcontentloaded" });
  expect(aboutRes?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toContainText(/Milky|みるきぃ/i, { timeout: 10000 });

  expect(pageErrors, "页面不应出现未捕获 JS 运行时异常").toEqual([]);
});
