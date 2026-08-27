# The brand files

The logo is the pen's own marks on one glyph: a Literata **Q** with the highlighter behind
it, the red ballpoint ring around it, the graphite underline beneath it, and a full stop in
ink. Every colour is the product's own — the highlighter and ballpoint pigments from
[`src/render/pen.ts`](../../src/render/pen.ts) (light and dark values both), paper
`#fcfcfc`, ink `#161513`. The letterforms are outlines, not live text, so the files render
identically with no font installed.

| File | What it is |
|---|---|
| [`icon-light.svg`](./icon-light.svg) / [`icon-dark.svg`](./icon-dark.svg) | The square app icon. The light PNG ships as [`src/assets/static/app-icon.png`](../../src/assets/static/app-icon.png) — every install's default home-screen icon |
| [`icon-dark-512.png`](./icon-dark-512.png) | The dark icon rendered, for stores that ask for one |
| [`wordmark-light.svg`](./wordmark-light.svg) / [`wordmark-dark.svg`](./wordmark-dark.svg) | The horizontal wordmark: *quire* in Literata, *INK* in JetBrains Mono ringed in ballpoint — the same two faces the product pairs on every page |

The favicon ([`src/assets/static/favicon.ico`](../../src/assets/static/favicon.ico)) is
16/32/48 — the 16px cut is simplified to the Q, the highlighter and the full stop, because
the full set of marks at 16px reads as a smudge, and a favicon that cannot be recognised is
not a favicon.
