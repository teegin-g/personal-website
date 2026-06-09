import type { MDXComponents } from "mdx/types";

// Required by @next/mdx with the App Router. `useMDXComponents` binds every MDX
// element to the theme token contract (bg/surface/ink/body/accent/muted/...),
// so prose stays legible in BOTH the phosphor (night) and ledger (day) themes.
//
// Rule of thumb: headings and strong text use `text-ink`; running prose uses
// `text-body` (tuned to >=4.5:1 on `bg` in both themes). Never put body prose
// in `text-muted`, which is reserved for captions and secondary metadata.
//
// Reading measure and width are owned by ArticleShell, not here. Figures that
// need to break out of the measure use components/articles/Figure.tsx.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Rarely used inside body copy (the shell renders the article title), but
    // styled well for the occasional in-document top-level heading.
    h1: ({ children }) => (
      <h1 className="mb-6 mt-12 text-balance font-display text-[clamp(2.25rem,4vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-4 mt-16 text-balance font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-ink first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-3 mt-10 text-balance font-display text-[clamp(1.35rem,2vw,1.75rem)] font-semibold leading-[1.2] tracking-[-0.01em] text-ink first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 mt-8 text-balance font-display text-[clamp(1.1rem,1.5vw,1.35rem)] font-semibold leading-[1.25] text-ink first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mb-2 mt-6 text-balance font-display text-[1.05rem] font-semibold leading-[1.3] text-ink first:mt-0">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="mb-1 mt-6 text-balance font-display text-[1rem] font-semibold leading-[1.3] text-ink first:mt-0">
        {children}
      </h6>
    ),
    p: ({ children }) => (
      <p className="my-6 text-pretty text-[1.125rem] leading-7 text-body">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-ink">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ children, href }) => (
      <a
        href={href}
        className="rounded-sm font-medium text-accent underline decoration-accent/40 decoration-1 underline-offset-[3px] transition-colors hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-6 list-disc space-y-2 pl-6 text-[1.125rem] leading-7 text-body marker:text-muted">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-6 list-decimal space-y-2 pl-6 text-[1.125rem] leading-7 text-body marker:text-muted">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1.5">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-8 rounded-lg border border-grid-line bg-surface px-6 py-5 text-pretty text-[1.125rem] italic leading-7 text-ink [&>p]:my-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-8 overflow-x-auto rounded-lg border border-grid-line bg-panel p-5 font-mono text-sm leading-6 text-body [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-body">
        {children}
      </pre>
    ),
    hr: () => <hr className="my-12 border-0 border-t border-grid-line" />,
    ...components,
  };
}
