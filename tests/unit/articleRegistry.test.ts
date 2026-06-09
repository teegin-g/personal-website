import { describe, expect, it } from "vitest";
import {
  getArticles,
  getArticle,
  getPublishedArticles,
  formatReadingTime,
} from "@/lib/articles/registry";

describe("articleRegistry", () => {
  it("getArticles() returns a non-empty array", () => {
    const articles = getArticles();
    expect(Array.isArray(articles)).toBe(true);
    expect(articles.length).toBeGreaterThan(0);
  });

  it("flagship article 'market-structure' is present with correct flags", () => {
    const articles = getArticles();
    const flagship = articles.find((a) => a.slug === "market-structure");
    expect(flagship).toBeDefined();
    expect(flagship!.interactive).toBe(true);
    expect(flagship!.status).toBe("published");
  });

  it("every entry has the correct shape and sensible types", () => {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const validStatuses = new Set(["published", "draft"]);

    for (const article of getArticles()) {
      expect(typeof article.slug).toBe("string");
      expect(article.slug.length).toBeGreaterThan(0);

      expect(typeof article.title).toBe("string");
      expect(article.title.length).toBeGreaterThan(0);

      expect(typeof article.summary).toBe("string");
      expect(article.summary.length).toBeGreaterThan(0);

      expect(typeof article.topic).toBe("string");
      expect(article.topic.length).toBeGreaterThan(0);

      expect(isoDate.test(article.date)).toBe(true);

      expect(typeof article.readingMinutes).toBe("number");
      expect(article.readingMinutes).toBeGreaterThan(0);

      expect(typeof article.interactive).toBe("boolean");

      expect(validStatuses.has(article.status)).toBe(true);
    }
  });

  it("getArticle() returns the entry for a known slug", () => {
    const article = getArticle("market-structure");
    expect(article).toBeDefined();
    expect(article!.slug).toBe("market-structure");
  });

  it("getArticle() returns undefined for an unknown slug", () => {
    expect(getArticle("does-not-exist")).toBeUndefined();
  });

  it("getPublishedArticles() returns only published entries sorted newest-first", () => {
    const published = getPublishedArticles();

    for (const article of published) {
      expect(article.status).toBe("published");
    }

    for (let i = 1; i < published.length; i++) {
      expect(published[i - 1].date >= published[i].date).toBe(true);
    }
  });

  it("formatReadingTime(7) returns '7 min read'", () => {
    expect(formatReadingTime(7)).toBe("7 min read");
  });
});
