import type { Metadata } from "next";

import { ArticleIndex } from "@/components/articles/ArticleIndex";
import { IndexCanvas } from "@/components/articles/IndexCanvas";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Writing · Teegin Groves",
  description:
    "Essays and interactive pieces on how markets, networks, and other complex systems settle into the shapes they take.",
};

export default function ArticlesPage() {
  return (
    <>
      <ThemeToggle />
      <IndexCanvas />
      <main className="relative z-10 min-h-screen px-[8vw] pb-32 pt-28">
        <ArticleIndex />
      </main>
    </>
  );
}
