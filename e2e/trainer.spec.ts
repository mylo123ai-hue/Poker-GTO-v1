import { expect, test } from "@playwright/test";

test("trainer renders a playable hand and hides the opponent cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /every decision/i })).toBeVisible();
  await expect(page.getByRole("region", { name: "Poker table and coach" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "OPPONENT" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action history" })).toBeVisible();
  await expect(page.getByLabel("Opponent cards hidden")).toBeVisible();
  await expect(page.getByLabel("Undealt community card")).toHaveCount(5);
  await expect(page.getByText("1 verified demo spot")).toBeVisible();
  const solverDemo = page.getByRole("region", { name: "Verified solver demo" });
  await expect(solverDemo).toBeVisible();
  await expect(solverDemo.getByRole("heading", { name: "Solver-backed river demo" })).toBeVisible();
  await expect(solverDemo.getByRole("list").getByText("Check", { exact: true })).toBeVisible();
  await expect(solverDemo.getByText("Bet 10 chips", { exact: true })).toBeVisible();
  await expect(solverDemo.getByText("Root range-average EV · OOP")).toBeVisible();
  const actionButton = page.getByRole("button", { name: /^(Call|Check)/ }).first();
  await actionButton.click();
  await expect(page.getByText("1 actions")).toBeVisible({ timeout: 5_000 });
});

test("simulation lab starts a seeded worker batch", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("HANDS").fill("100");
  await page.getByLabel("SEED").last().fill("e2e-seed");
  await page.getByRole("button", { name: "Run batch" }).click();
  await expect(page.getByText("100 hands", { exact: false })).toBeVisible({ timeout: 30_000 });
  const pdfButton = page.getByRole("button", { name: "PDF report" });
  await expect(pdfButton).toBeVisible();
  const [report] = await Promise.all([page.waitForEvent("download"), pdfButton.click()]);
  expect(report.suggestedFilename()).toBe("poker-gto-report.pdf");
});
