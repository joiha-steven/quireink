# 0008. Hand-write the public CSS, drop Tailwind from the reader path

Date: 2026-07-27
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Asked which parts of the stack would go obsolete over ten years, the honest ranking put no
language in the danger zone. The danger zone was the tooling layer, and its mortality
ordering was: bundlers (historically ~100% over a decade), CSS frameworks, UI framework
idiom, then everything else. Tailwind v3 to v4 already broke once.

Quire's theme system is **already** custom properties: `themesToCss` emits every palette's
variables. Half the work was done, and 2026 CSS (nesting, `:has()`, container queries,
cascade layers, `color-mix()`) covers what the framework was providing.

## Decision

The public site gets roughly 1,000 lines of hand-written CSS on custom properties, and no
CSS framework and no build step. Tailwind stays for the admin SPA
([0006](0006-admin-stays-react-spa.md)), where its churn is contained.

## Consequences

- The public site stops needing a bundler at all. Combined with hand-written vanilla
  islands, the reader path has no build tooling in it.
- `public.css` becomes small enough to inline, so an article page makes zero blocking
  stylesheet requests.
- The golden harness gets stricter for free: it no longer has to sort `class` attribute
  tokens to work around Tailwind's build-order output, so a class difference is now a real
  difference.
- **Cost accepted:** utility classes enforce consistency that hand CSS does not. The
  mitigation is that one ~1,000-line file can be read in full in one pass, where Tailwind
  classes are spread across a hundred components.
