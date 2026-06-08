import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const BUNDLE_SHOTS = "evals/runs/latest/bundle/screenshots";

test("article renders MDX prose and an interactive simulator island", async ({
  page,
}) => {
  await page.goto("/articles/market-structure");

  // MDX prose rendered.
  await expect(
    page.getByRole("heading", { name: "Market Structure", level: 1 }),
  ).toBeVisible();

  // The embedded client island hydrated: a simulator control is present.
  await expect(
    page.getByRole("button", { name: /Reset/ }),
  ).toBeVisible();

  // Capture a screenshot artifact into the goal-eval bundle as concrete UI proof.
  mkdirSync(BUNDLE_SHOTS, { recursive: true });
  await page.screenshot({
    path: `${BUNDLE_SHOTS}/article.png`,
    fullPage: true,
  });
});

test("home page lists the article and links to it", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /Market Structure/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/articles\/market-structure$/);
});
