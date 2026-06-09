import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SHOTS = "evals/runs/latest/bundle/screenshots";

test("hero renders name and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Teegin Groves", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/make complex systems feel intuitive/i),
  ).toBeVisible();
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/landing-night.png`, fullPage: false });
});

test("scrolling reveals later beats", async ({ page }) => {
  await page.goto("/");
  const beat3 = page.getByRole("heading", { name: /Order isn't imposed/i });
  await beat3.scrollIntoViewIfNeeded();
  await expect(beat3).toBeVisible();
});

test("theme toggle flips palette and persists across reload", async ({
  page,
}) => {
  // Pin the starting theme so the test does not race ThemeProvider's
  // post-hydration prefers-color-scheme resolve (headless Chromium reports
  // `light`, which would flip the page to ledger a beat after load).
  await page.addInitScript(() => {
    window.localStorage.setItem("tg-theme", "phosphor");
  });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "phosphor");
  const toggle = page.getByRole("button", { name: /Switch to/i });
  // Wait for hydration so the toggle's click handler is wired.
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "ledger");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ledger");
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/landing-day.png`, fullPage: false });
});

test("reduced motion: content fully visible, no animation gating", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Teegin Groves", level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: /Order isn't imposed/i })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("heading", { name: /Order isn't imposed/i }),
  ).toBeVisible();
  await context.close();
});

test("keyboard navigation reaches the nav links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Articles/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Substack/i }).first(),
  ).toBeVisible();
});
