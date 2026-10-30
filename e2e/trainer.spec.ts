import { expect, test } from "@playwright/test";

const saveKey = "poker-trainer-session-v1";

test("trainer renders a private, playable hand without the retired demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /play the hand/i })).toBeVisible();
  await expect(page.getByRole("region", { name: "Poker table and coaching" })).toBeVisible();
  await expect(page.locator(".poker-table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Your actions" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Opponent profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player statistics" })).toBeVisible();
  await expect(page.getByLabel("Opponent cards hidden")).toBeVisible();
  await expect(page.getByLabel("Board card not yet dealt")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Verified solver demo" })).toHaveCount(0);
  await expect(page.getByText("1 verified demo spot")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/solver|GTO/i);
  const call = page.getByRole("button", { name: /^Call 1/ });
  await call.focus();
  await expect(call).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".action-list li").first()).toBeVisible();
  await expect(page.locator(".action-list li").first()).toContainText("You");
});

test("coaching modes preserve the practice/challenge disclosure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice/ }).click();
  await expect(page.getByText("Choose first")).toBeVisible();
  await expect(page.getByText("Get a hint")).toBeVisible();
  await page.getByRole("button", { name: "Get a hint" }).click();
  await expect(page.getByText("RULE-BASED SUGGESTION")).toBeVisible();
  await page.getByRole("button", { name: /Challenge/ }).click();
  await expect(page.getByText("No live hint")).toBeVisible();
  await page.getByRole("button", { name: "Fold" }).click();
  await expect(page.getByText("POST-HAND REVIEW")).toBeVisible();
  await page.getByRole("button", { name: "Review challenge choices" }).click();
  await expect(page.locator(".challenge-review")).toContainText("You chose Fold");
  await expect(page.getByText(/does not grade correctness or optimality/i)).toBeVisible();
  await expect(page.locator(".replay-panel")).toBeVisible();
  await page.getByRole("button", { name: /Next action/ }).click();
  await expect(page.locator(".replay-holes").getByLabel("Opponent card hidden")).toHaveCount(2);
});

test("match setup applies custom blinds and elimination ends a short-stack match", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Match setup" }).locator("summary").click();
  await page.getByLabel("Starting stack").fill("2");
  await page.getByLabel("Small blind").fill("1");
  await page.getByLabel("Big blind").fill("2");
  await page.getByLabel("Match seed").fill("mobile-allin-seed");
  await page.getByRole("button", { name: "Start new match" }).click();
  await expect(page.locator(".hand-stats")).toContainText("1 / 2");
  await page.getByRole("button", { name: /^Call 1/ }).click();
  await expect(page.getByText("Match complete", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Start a new match" })).toBeVisible();
  await expect(page.getByText("completed matches saved")).toBeVisible();
});

test("refresh resumes the saved hand and malformed storage recovers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Call 1/ }).click();
  await expect.poll(() => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).match.hand.actions.length : 0;
  }, saveKey)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /player statistics/i })).toBeVisible();
  await expect(page.locator(".action-list li").first()).toContainText("You");

  await page.addInitScript((key) => localStorage.setItem(key, "{broken"), saveKey);
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: /saved session could not be restored/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Call 1/ })).toBeVisible();
});

test("the opponent stall warning offers a working retry", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    let stalledOnce = false;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 420 && !stalledOnce) {
        stalledOnce = true;
        return nativeTimeout(() => undefined, timeout);
      }
      return nativeTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Call 1/ }).click();
  await expect(page.getByRole("alert")).toContainText("taking too long", { timeout: 7_000 });
  await page.getByRole("button", { name: "Retry opponent turn" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator(".action-list li")).toHaveCount(2, { timeout: 5_000 });
});

test("simulation lab runs and exports a seeded heuristic batch", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("HANDS").fill("100");
  await page.getByLabel("Simulation seed").fill("e2e-seed");
  await page.getByRole("button", { name: "Run batch" }).click();
  await expect(page.getByText("100 hands", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Empirical heuristic behavior only/)).toBeVisible();
  const pdfButton = page.getByRole("button", { name: /PDF report/ });
  const [report] = await Promise.all([page.waitForEvent("download"), pdfButton.click()]);
  expect(report.suggestedFilename()).toBe("poker-trainer-report.pdf");
});

test("mobile, tablet, and desktop layouts keep actions visible without page overflow", async ({ page }) => {
  await page.goto("/");
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("region", { name: "Your actions" })).toBeVisible();
    const measurements = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.width);
    const call = page.getByRole("button", { name: /^Call 1/ });
    const box = await call.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
  }
});
