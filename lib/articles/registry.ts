export interface Article {
  slug: string;
  title: string;
  summary: string;
  topic: string;
  date: string; // ISO YYYY-MM-DD
  readingMinutes: number;
  interactive: boolean;
  status: "published" | "draft";
}

export const articles: Article[] = [
  {
    slug: "market-structure",
    title: "Market Structure",
    summary:
      "How the rules of an industry decide who can compete and who survives.",
    topic: "Economics",
    date: "2026-06-08",
    readingMinutes: 8,
    interactive: true,
    status: "published",
  },
];

export function getArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getPublishedArticles(): Article[] {
  return articles
    .filter((a) => a.status === "published")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min read`;
}
