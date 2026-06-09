import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const BUNDLE_SHOTS = "evals/runs/latest/bundle/screenshots";

// ---------------------------------------------------------------------------
// WCAG contrast helpers.
//
// getComputedStyle resolves theme tokens (authored in oklch) to concrete
// `rgb(...)` / `rgba(...)` strings, so we only need to parse those. We compute
// relative luminance per WCAG 2.x and the contrast ratio (L1 + 0.05) /
// (L2 + 0.05). The regression we are guarding is "invisible prose": low-
// contrast body text on the page background in either theme.
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseRgb(input: string): Rgb | null {
  const m = input.match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/i,
  );
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** True when a color string is missing, transparent, or fully see-through. */
function isTransparent(input: string | null | undefined): boolean {
  if (!input) return true;
  if (input === "transparent") return true;
  const rgb = parseRgb(input);
  return rgb === null || rgb.a === 0;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Read the foreground color of a prose paragraph and the *painted* background
 * behind it. The paragraph's own background is transparent (it only carries
 * `text-body`), so we walk up the ancestor chain to the first element with a
 * non-transparent background — in this app that resolves to <body>/<html>,
 * which paint `var(--bg)`.
 *
 * The theme tokens are authored in oklch, and computed-style strings come back
 * as `oklch(...)` in this engine rather than `rgb(...)`. We therefore normalize
 * every color to sRGB *inside the page* via a canvas 2D context: painting an
 * opaque pixel through `fillStyle` resolves any CSS color (oklch included) to
 * the exact rgba the user sees, so the returned strings are always parseable
 * `rgb()`/`rgba()`.
 */
async function readProseColors(
  page: Page,
): Promise<{ fg: string; bg: string }> {
  return page.evaluate(() => {
    // Normalize any CSS color string to "rgb(r, g, b)" / "rgba(...)" by
    // painting it onto a 1x1 canvas and reading the pixel back.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const toRgb = (color: string): string => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = color; // ignored if the engine cannot parse `color`
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    };

    const p = document.querySelector("article p");
    if (!p) throw new Error("no prose paragraph found in <article>");

    const fg = toRgb(getComputedStyle(p).color);

    const opaque = (raw: string | null | undefined) => {
      if (!raw || raw === "transparent") return false;
      const norm = toRgb(raw);
      return !/rgba\([^)]*,\s*0(?:\.0+)?\)\s*$/i.test(norm);
    };

    // Walk up from the paragraph to the first ancestor that actually paints a
    // background, then fall back to <body>/<html> so we always report the
    // background the user really sees behind the text.
    let el: Element | null = p;
    let bgRaw = "";
    while (el) {
      const c = getComputedStyle(el).backgroundColor;
      if (opaque(c)) {
        bgRaw = c;
        break;
      }
      el = el.parentElement;
    }
    if (!bgRaw) {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      bgRaw = opaque(bodyBg)
        ? bodyBg
        : getComputedStyle(document.documentElement).backgroundColor;
    }
    return { fg, bg: toRgb(bgRaw) };
  });
}

/** Measure the prose-on-background contrast ratio currently rendered. */
async function measureContrast(page: Page): Promise<number> {
  const { fg, bg } = await readProseColors(page);
  expect(isTransparent(fg), `foreground color was transparent: ${fg}`).toBe(
    false,
  );
  expect(
    isTransparent(bg),
    `background color resolved transparent: ${bg}`,
  ).toBe(false);
  const fgRgb = parseRgb(fg)!;
  const bgRgb = parseRgb(bg)!;
  return contrastRatio(fgRgb, bgRgb);
}

/**
 * Pin the theme deterministically before any app script runs. The app resolves
 * the initial theme from localStorage (key `tg-theme`) first, falling back to
 * prefers-color-scheme — which is unreliable under headless Chromium. Seeding
 * the key makes each theme assertion measure the theme we actually name.
 */
async function pinTheme(page: Page, theme: "phosphor" | "ledger") {
  await page.addInitScript((t) => {
    window.localStorage.setItem("tg-theme", t);
  }, theme);
}

test("article renders MDX prose and an interactive simulator island", async ({
  page,
}) => {
  await page.goto("/articles/market-structure");

  // MDX prose rendered.
  await expect(
    page.getByRole("heading", { name: "Market Structure", level: 1 }),
  ).toBeVisible();

  // The embedded client island hydrated: a simulator control is present.
  await expect(page.getByRole("button", { name: /Reset/ })).toBeVisible();

  // Capture a screenshot artifact into the goal-eval bundle as concrete UI proof.
  mkdirSync(BUNDLE_SHOTS, { recursive: true });
  await page.screenshot({
    path: `${BUNDLE_SHOTS}/article.png`,
    fullPage: true,
  });
});

test("landing page links into the article via the nav", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /Articles/i });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/articles\/market-structure$/);
});

test("both themes keep prose legible (>=4.5:1 contrast regression lock)", async ({
  page,
}) => {
  mkdirSync(BUNDLE_SHOTS, { recursive: true });
  const html = page.locator("html");

  // --- Phosphor (near-black night) -------------------------------------
  await pinTheme(page, "phosphor");
  await page.goto("/articles/market-structure");
  await expect(html).toHaveAttribute("data-theme", "phosphor");
  await expect(page.locator("article p").first()).toBeVisible();

  const phosphorRatio = await measureContrast(page);
  expect(
    phosphorRatio,
    `phosphor prose contrast ${phosphorRatio.toFixed(2)}:1 < 4.5:1`,
  ).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({
    path: `${BUNDLE_SHOTS}/article-phosphor.png`,
    fullPage: true,
  });

  // --- Ledger (warm off-white day) -------------------------------------
  // Toggle live via the button so we also exercise the runtime theme switch,
  // not just a reload into a seeded value.
  await page.getByRole("button", { name: /Switch to/i }).click();
  await expect(html).toHaveAttribute("data-theme", "ledger");
  await expect(page.locator("article p").first()).toBeVisible();

  const ledgerRatio = await measureContrast(page);
  expect(
    ledgerRatio,
    `ledger prose contrast ${ledgerRatio.toFixed(2)}:1 < 4.5:1`,
  ).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({
    path: `${BUNDLE_SHOTS}/article-ledger.png`,
    fullPage: true,
  });

  // Surface the measured ratios in the test log for the run report.
  console.log(
    `[contrast] phosphor=${phosphorRatio.toFixed(2)}:1 ledger=${ledgerRatio.toFixed(2)}:1`,
  );
});

test("simulator stays hydrated and interactive across a theme toggle", async ({
  page,
}) => {
  await pinTheme(page, "phosphor");
  await page.goto("/articles/market-structure");

  // The embedded island lives inside the full-bleed figure.
  const figure = page.locator("figure.article-bleed");
  await expect(figure).toBeVisible();

  // Interactive controls present: a range slider and the Reset button.
  const slider = page.locator('input[type="range"]').first();
  await expect(slider).toBeVisible();
  const reset = page.getByRole("button", { name: /Reset/ });
  await expect(reset).toBeVisible();
  // Reset lives within the simulator figure (not stray page chrome).
  await expect(figure.getByRole("button", { name: /Reset/ })).toBeVisible();

  // Switch theme; the island must keep rendering (no crash / unmount).
  await page.getByRole("button", { name: /Switch to/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ledger");
  await expect(slider).toBeVisible();
  await expect(reset).toBeVisible();
});

test("reduced motion: prose, headings, and simulator are not gated", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/articles/market-structure");

  // Title and a section heading are present and visible (content not hidden
  // behind an animation gate).
  await expect(
    page.getByRole("heading", { name: "Market Structure", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /The 4 Factors/i }),
  ).toBeVisible();

  // First prose paragraph visible.
  await expect(page.locator("article p").first()).toBeVisible();

  // Simulator control present.
  await expect(page.getByRole("button", { name: /Reset/ })).toBeVisible();

  await context.close();
});
