import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const BUNDLE_SHOTS = "evals/runs/latest/bundle/screenshots";

/**
 * Pin the theme deterministically before any app script runs (see
 * article.spec.ts). The index page also resolves theme from `tg-theme`,
 * falling back to prefers-color-scheme, so we seed the key to make the
 * both-theme screenshots reflect the theme we name.
 */
async function pinTheme(page: Page, theme: "phosphor" | "ledger") {
  await page.addInitScript((t) => {
    window.localStorage.setItem("tg-theme", t);
  }, theme);
}

test("articles index lists the flagship entry and links into it", async ({
  page,
}) => {
  await page.goto("/articles");

  // It is a list of entries (typographic stack, not a card grid).
  await expect(page.locator("ul li").first()).toBeVisible();

  // The flagship entry: a link whose accessible name contains "Market
  // Structure" pointing at the article.
  const link = page.getByRole("link", { name: /Market Structure/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/articles/market-structure");

  // Clicking it navigates to the article.
  await link.click();
  await expect(page).toHaveURL(/\/articles\/market-structure$/);
  await expect(
    page.getByRole("heading", { name: "Market Structure", level: 1 }),
  ).toBeVisible();
});

test("field background toggle flips state and persists across reload", async ({
  page,
}) => {
  await page.goto("/articles");

  // Default ON: button reads "field on" and offers to disable.
  const toggle = page.getByRole("button", { name: /field background/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-label", "Disable field background");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText(/field on/i);

  // Turn it OFF.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "Enable field background");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText(/field off/i);

  // Preference persists across reload (localStorage key tg-index-canvas).
  await page.reload();
  const afterReload = page.getByRole("button", { name: /field background/i });
  await expect(afterReload).toHaveAttribute(
    "aria-label",
    "Enable field background",
  );
  await expect(afterReload).toHaveAttribute("aria-pressed", "false");
  await expect(afterReload).toHaveText(/field off/i);

  // Toggle back ON and confirm that also persists.
  await afterReload.click();
  await expect(afterReload).toHaveAttribute(
    "aria-label",
    "Disable field background",
  );
  await page.reload();
  const finalState = page.getByRole("button", { name: /field background/i });
  await expect(finalState).toHaveAttribute(
    "aria-label",
    "Disable field background",
  );
  await expect(finalState).toHaveAttribute("aria-pressed", "true");
});

test("articles index screenshots in both themes", async ({ browser }) => {
  mkdirSync(BUNDLE_SHOTS, { recursive: true });

  for (const theme of ["phosphor", "ledger"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await pinTheme(page, theme);
    await page.goto("/articles");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("heading", { name: /Notes on systems/i }),
    ).toBeVisible();
    await page.screenshot({
      path: `${BUNDLE_SHOTS}/articles-index-${theme}.png`,
      fullPage: true,
    });
    await context.close();
  }
});
