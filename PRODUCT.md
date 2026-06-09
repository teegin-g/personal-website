# Product

## Register

brand

## Users

Two audiences. Primary: curious readers (friends, peers, people who find Teegin's
writing) who land to read interactive essays on economics and complex systems. Secondary:
professional visitors (recruiters, collaborators) assessing who Teegin is. Both arrive
with no prior context and decide in seconds whether this feels worth their attention.

Teegin Groves is a quantitative economics/math analyst (Business Development at
Continental Resources) who builds interactive economics simulations. The site is his
portfolio and writing home.

## Product Purpose

A personal site that is **articles-first long-term**, but **aesthetics-first today**: an
enjoyable interface before it is a navigation utility. It exists to host interactive
essays (markdown prose + embedded React simulations the reader can manipulate) and to
showcase projects. Success: a first-time visitor wants to move the cursor and scroll
before they read a word, and leaves with a clear sense that this is the work of someone
who makes complex systems feel intuitive.

## Brand Personality

Exploratory, systems-minded, alive. The voice is "the essayist who codes" — precise but
human, curious, never corporate. Emotionally the site should feel like an inviting lab:
calm, intelligent, a little playful. Motion and interactivity carry the personality; copy
stays specific and unpretentious.

## Anti-references

- Generic AI-portfolio slop: particle backgrounds with no meaning, hero-metric templates,
  identical icon-heading-text card grids, eyebrow kickers above every section.
- Fintech navy-and-gold, and the cream/beige "editorial-magazine" default.
- Over-minimalist "safe" portfolios that read as templates.
- Decorative glassmorphism. The living visual must *mean something* (an economic system),
  not be ambient decoration.

## Design Principles

1. **The visual is the argument.** Any hero/animation must allude to Teegin's actual work
   (markets, equilibrium, emergence), not be generic motion.
2. **Interaction before instruction.** The interface should respond and invite play before
   the user clicks or reads (cursor gravity, drag-to-shock, scroll-driven morph).
3. **Two worlds, both first-class.** Night (Phosphor) and day (Ledger) are each designed
   to spec, not one theme with a mechanical inverse.
4. **Craft over flash.** Semantic motion that explains relationships; contrast and
   legibility never sacrificed for effect.
5. **Additive and testable.** New work extends the system without breaking existing
   content; logic is unit-tested, behavior is Playwright-tested, completion is gated.

## Accessibility & Inclusion

- Body text ≥ 4.5:1 contrast in both themes; large text ≥ 3:1.
- `prefers-reduced-motion`: animation freezes to a static frame; content is never gated on
  a JS animation firing.
- Decorative canvas is `aria-hidden`; navigation is semantic HTML, fully keyboard- and
  screen-reader-navigable.
- Device tiering: effects scale down on low-power/mobile; render loop pauses when the tab
  is hidden.
