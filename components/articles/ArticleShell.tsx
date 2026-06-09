"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatReadingTime, getArticle } from "@/lib/articles/registry";

interface Props {
  slug: string;
  children: ReactNode;
}

/** Format an ISO YYYY-MM-DD date as e.g. "June 8, 2026". */
function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * The reading layout for an article. Looks up metadata from the registry by
 * slug, renders a themed header (back link, title, summary, metadata row), then
 * a centered reading column at a ~68ch measure. Non-bleed prose stays inside
 * the measure; Figure components with `bleed` break out to the viewport via the
 * `.article-bleed` utility, which ignores this column's width.
 */
export function ArticleShell({ slug, children }: Props) {
  const reduce = useReducedMotion();
  const article = getArticle(slug);

  // Reduced-motion: render fully visible immediately — no opacity gate, no animation.
  // Normal motion: animate on mount (initial + animate, not whileInView) so the header
  // unconditionally resolves to visible even in headless/background-tab renders.
  if (reduce) {
    return (
      <div className="min-h-screen bg-bg">
        <ThemeToggle />

        <article className="mx-auto max-w-[68ch] px-6 pb-32 pt-24 sm:px-8">
          <header>
            <nav className="mb-10">
              <Link
                href="/articles"
                className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-accent underline decoration-accent/40 decoration-1 underline-offset-4 transition-colors hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span aria-hidden="true">&larr;</span> Articles
              </Link>
            </nav>

            <div>
              <h1 className="text-balance font-display text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
                {article?.title ?? "Untitled"}
              </h1>

              {article?.summary && (
                <p className="mt-5 max-w-[58ch] text-pretty text-xl leading-8 text-body">
                  {article.summary}
                </p>
              )}

              {article && (
                <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  <span>{article.topic}</span>
                  <span aria-hidden="true" className="text-grid-line">
                    &middot;
                  </span>
                  <time dateTime={article.date}>{formatDate(article.date)}</time>
                  <span aria-hidden="true" className="text-grid-line">
                    &middot;
                  </span>
                  <span>{formatReadingTime(article.readingMinutes)}</span>
                </p>
              )}
            </div>

            <hr className="mt-10 border-0 border-t border-grid-line" />
          </header>

          {children}
        </article>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <ThemeToggle />

      <article className="mx-auto max-w-[68ch] px-6 pb-32 pt-24 sm:px-8">
        <header>
          <nav className="mb-10">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-accent underline decoration-accent/40 decoration-1 underline-offset-4 transition-colors hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span aria-hidden="true">&larr;</span> Articles
            </Link>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-balance font-display text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
              {article?.title ?? "Untitled"}
            </h1>

            {article?.summary && (
              <p className="mt-5 max-w-[58ch] text-pretty text-xl leading-8 text-body">
                {article.summary}
              </p>
            )}

            {article && (
              <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                <span>{article.topic}</span>
                <span aria-hidden="true" className="text-grid-line">
                  &middot;
                </span>
                <time dateTime={article.date}>{formatDate(article.date)}</time>
                <span aria-hidden="true" className="text-grid-line">
                  &middot;
                </span>
                <span>{formatReadingTime(article.readingMinutes)}</span>
              </p>
            )}
          </motion.div>

          <hr className="mt-10 border-0 border-t border-grid-line" />
        </header>

        {children}
      </article>
    </div>
  );
}
