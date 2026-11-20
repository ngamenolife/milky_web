import { expect, test } from "@playwright/test";

test("核心路径 + 歌回点唱机 E2E 冒烟测试", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("live-badge")).toBeVisible();

  // 1. 歌回点唱机：搜索并点击切歌，验证 B 站 iframe 空降时间轴更新
  await page.getByTestId("jukebox-search").fill("小幸运");
  await page.getByTestId("song-item-song-2").click();
  await expect(page.getByTestId("now-playing-title")).toContainText("小幸运");
  const iframeSrc = await page.getByTestId("jukebox-iframe").getAttribute("src");
  expect(iframeSrc).toContain("player.bilibili.com/player.html");
  expect(iframeSrc).toContain("t=755"); // 12:35 = 755 秒

  // 2. 清空搜索并测试随机点歌按钮
  await page.getByTestId("jukebox-search").fill("");
  await page.getByTestId("jukebox-random").click();
  await expect(page.getByTestId("jukebox-iframe")).toBeVisible();

  // 3. 验证后端歌单 & ICS 接口
  const songsRes = await request.get("/api/songs?lang=ja");
  expect(songsRes.status()).toBe(200);
  const icsRes = await request.get("/api/schedule/ics");
  expect(icsRes.status()).toBe(200);

  // 4. 移动端无横向溢出
  await page.setViewportSize({ width: 390, height: 844 });
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasOverflow).toBe(false);
  expect(consoleErrors).toEqual([]);
});
