import Link from "next/link";

const links = [
  {
    href: "/articles/market-structure",
    label: "Articles",
    hint: "Interactive essays on how systems work",
  },
  { href: "/projects", label: "Projects", hint: "Things I've built" },
  {
    href: "https://substack.com",
    label: "Follow",
    hint: "New writing in your inbox",
    external: true,
  },
];

export function LandingNav() {
  return (
    <footer className="flex min-h-screen flex-col justify-center px-[8vw] pb-[10vh]">
      <p className="mb-8 font-mono text-xs uppercase tracking-[0.22em] text-accent">
        Where to go
      </p>
      <nav className="flex flex-col gap-2">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noreferrer" : undefined}
            className="group flex flex-col border-t border-ink/10 py-6 transition-colors hover:border-accent sm:flex-row sm:items-baseline sm:justify-between"
          >
            <span className="font-display text-3xl font-bold text-ink transition-transform duration-300 ease-out group-hover:translate-x-2">
              {l.label}
            </span>
            <span className="mt-1 text-sm text-body sm:mt-0">{l.hint}</span>
          </Link>
        ))}
      </nav>
    </footer>
  );
}
