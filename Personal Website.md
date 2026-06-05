# Overview
going through a breakup after a 3.5 year relationship so I'm trying to do like stuff thats beneficial to me and fun. So basically I want to create a personal website where I can host essentially a portfolio of stuff I've been working on, like articles I've written, or github projects I'm working on. For the articles in particular I'm drawn to the idea of react / javascript interactive articles, i.e. i discuss a topic in detail and embed an interactive react visualization/simulation for the reader to mess with to build intuition on the topic.

I'd like to link it to substack or beehiiv so friends of mine can see when I write new stuff. Nothing too convoluted, as the substack posts would link to the relevant article, so all I'd really need is include a link to it

# Styling / Theme
Most portfolio sites I see are AI slop or too minimalist, I want this to uniquely reflect my personality, so very design oriented, aesthetically pleasing, maybe sporadic or unorthodox. If you want references, look over some of the projects in ./Programming like Slopcast, Wildcat, etc. Ideally at some point I'd like to integrate the slopcast theming system to the website for fun.

## Aesthetic vision
I'm a big fan of Apple and Steve Jobs, particularly their eye for aesthetics. I want the entire site to be very lively, like using animations and 3d renderings to make unique or cool visuals / user experience. 

Here's some snippets

### 1. The cursor has gravity

Interactions should not feel binary. Instead of only changing when something is directly hovered, nearby elements can respond to the cursor’s proximity.

Examples:

- Dock items scale as the cursor approaches.
- Cards subtly tilt or brighten based on pointer position.
- Buttons can feel magnetic.
- Background details can react softly to cursor movement.
- Tags, links, or nav items can feel like they exist inside a shared physical field.
**Proximity Scaling on Hover**
Use proximity, not just hover. When the cursor gets close, nearby elements can subtly scale and darken based on distance.

It makes interfaces feel more responsive, less binary, and way more alive

```
onpointermove = e =>
document.querySelectorAll(".dock>*").forEach(el => {
const r = el.getBoundingClientRect();
const t = Math.max(0, 1 - Math.abs(e.clientX - r.x - r.width/2) / 120);
el. style.scale = 1 + t * .5;
});
```

The interface should feel responsive before the user explicitly clicks something.

### 2. Surfaces should feel tactile

Cards, panels, article blocks, and navigation elements should feel like physical objects rather than flat rectangles.

Possible techniques:

- Layered cards
- Soft shadows
- Translucent glass-like panels
- Subtle texture or grain
- Pointer-aware lighting
- Depth-based hover states
- Shared layout transitions when opening/closing content

The goal is not generic glassmorphism, but a coherent material system.

### 3. Motion should have meaning

Animations should not just be decorative. They should explain relationships between objects and make the site feel spatially continuous.

Examples:

- A project card expands into its detail page.
- Related articles cluster together.
- Filters physically rearrange cards instead of abruptly hiding them.
- Modals emerge from the clicked object.
- Sections reveal themselves like staged scenes instead of static blocks.

Useful phrase: **semantic motion**.

## Development
Since this will be AI driven I prefer to use impeccable skills because it has by far the most sophisticated UI dev suite. I'm open to any JS/TS stack, I imagine by default I'd use
- Remotion - for animation
- 3JS / React 3-fiber or Drei - for 3D rendering and details
- D3.js - Used for interactive visuals

# Components

## Articles / Writing
This is the first class feature of the site and what I'm primarily interested in. I'd want articles to be displayed in a normal traditional like newspage set up or something, but with some dynamism like mentioned above. 

Essentially the ways articles would work is that I'd fill out a markdown doc of my writing for the article, place it in the project and then work with claude/codex/etc to help me build out interactive elements I want. Right now in the interactive-visuals folder I have some components I made w/ chatgpt for my current article.

## Github Showcase / App's I've developed
This would take less precedent b/c I don't have a lot of apps, but ideally there'd be a page that's like a showcase of projects from github that take you to the project on click, but maybe on hover it gives you a project overview, maybe even store them in a carousel. Regardless, the work for these will be done on github and not the site itself.