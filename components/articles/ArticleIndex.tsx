import Link from "next/link";

import {
  formatReadingTime,
  getPublishedArticles,
  type Article,
} from "@/lib/articles/registry";

interface EntryProps {
  article: Article;
  /** The newest entry leads the list and carries the most visual weight. */
  flagship: boolean;
}

/** A metadata line: topic, reading time, and an Interactive marker when set. */
function MetaLine({ article }: { article: Article }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.18em] text-body">
      <span>{article.topic}</span>
      <span aria-hidden="true" className="text-grid-line">
        &middot;
      </span>
      <span>{formatReadingTime(article.readingMinutes)}</span>
      {article.interactive && (
        <>
          <span aria-hidden="true" className="text-grid-line">
            &middot;
          </span>
          <span className="text-accent">Interactive</span>
        </>
      )}
    </p>
  );
}

function Entry({ article, flagship }: EntryProps) {
  const titleSize = flagship
    ? "text-[clamp(2.25rem,5.5vw,3.5rem)]"
    : "text-[clamp(1.75rem,3.5vw,2.5rem)]";
  const summarySize = flagship
    ? "text-xl leading-relaxed"
    : "text-lg leading-relaxed";

  return (
    <li className="border-t border-grid-line py-10 first:border-t-0 first:pt-0">
      <article className="copy-scrim max-w-[58ch]">
        <h2
          className={`text-balance font-display ${titleSize} font-extrabold leading-[1.0] tracking-[-0.03em] text-ink`}
        >
          <Link
            href={`/articles/${article.slug}`}
            className="group inline-flex rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
          >
            <span className="bg-[length:0%_1px] bg-gradient-to-r from-accent to-accent bg-left-bottom bg-no-repeat motion-safe:transition-[background-size] motion-safe:duration-300 motion-safe:ease-out group-hover:bg-[length:100%_1px]">
              {article.title}
            </span>
          </Link>
        </h2>

        <p className={`mt-5 text-pretty text-body ${summarySize}`}>
          {article.summary}
        </p>

        <MetaLine article={article} />
      </article>
    </li>
  );
}

/**
 * The articles reading list. A typographic stack of entries separated by
 * hairline rules (no card grid). The newest entry leads as the flagship with
 * the largest title and a more prominent summary; later entries step down for
 * a clear hierarchy.
 */
export function ArticleIndex() {
  const articles = getPublishedArticles();

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="copy-scrim mb-16 max-w-[52ch]">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Writing
        </p>
        <h1 className="text-balance font-display text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-ink">
          Notes on systems
        </h1>
        <p className="mt-6 text-pretty text-xl leading-relaxed text-body">
          Essays and interactive pieces on how markets, networks, and other
          complex systems settle into the shapes they take.
        </p>
      </header>

      {articles.length > 0 ? (
        <ul>
          {articles.map((article, i) => (
            <Entry key={article.slug} article={article} flagship={i === 0} />
          ))}
        </ul>
      ) : (
        <p className="copy-scrim text-lg leading-relaxed text-body">
          New pieces are on the way. Check back soon.
        </p>
      )}
    </section>
  );
}
