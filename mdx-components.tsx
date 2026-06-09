import type { MDXComponents } from "mdx/types";

// Required by @next/mdx with the App Router. Styles MDX prose with Tailwind so
// articles render with sensible typographic defaults.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mb-6 text-4xl font-bold tracking-tight">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-10 text-2xl font-semibold tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-6 text-xl font-semibold">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="my-4 leading-7 text-slate-700">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-900">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ...components,
  };
}
