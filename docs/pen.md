# The pen, on any page

The highlighter, the underline and the ring that mark this blog's posts are one stylesheet,
and any Quire Ink serves it at `/pen.css` ([ADR 0048](decisions/0048-the-pen-is-a-stylesheet-anyone-may-link.md)).
Link it from a page that is not a Quire Ink — a WordPress theme, a static site, a slide —
and write the same three elements the blog's renderer writes.

## Link it

```html
<link rel="stylesheet" href="https://your-quire-ink.example/pen.css">
```

- Any Quire Ink will do; the sheet comes in **that blog's inks** and follows them. Point at
  your own if you have one, so your marks match your posts.
- The path is stable. The file is fresh for an hour and stale for a day while a new copy is
  fetched; a conditional request gets a `304`. CORS is open.
- It is the whole pen: about 35 KB compressed. The blog itself links one half at a time and
  only on pages that carry a mark; a host page takes all of it, once.

## Wrap the text

The rules hang off the class `pen`. Put it on any container — an article, a section, the
body — and every mark inside it is drawn by hand:

```html
<article class="pen">
  <p>A <mark data-pen="12">highlighted phrase</mark>, a <u data-pen="3">line under words</u>,
     and a <mark data-form="o" data-pen="47">ringed</mark> word.</p>
</article>
```

For a dark page put the class `dark` on an ancestor (the `html` or `body` element is the
usual place): the same marks in the inks measured for dark paper.

## Write the marks

| Gesture | Markup | Colour |
|---|---|---|
| Highlight | `<mark data-pen="N">…</mark>` | yellow, or `data-ink="green"` · `pink` · `blue` · `orange` |
| Underline | `<u data-pen="N">…</u>` | pencil, or `data-ink="yellow"` · `green` · `pink` · `blue` · `orange` for a ballpoint |
| Ring | `<mark data-form="o" data-pen="N">…</mark>` | red ballpoint, or `data-ink` as above |

`N` is a whole number from 0 to 79 and picks the stroke: its weight, where it sits, how far
it runs past the words. Variants 0 to 39 are long strokes for a phrase; 40 to 79 are the
short hand for a word or two. Any number works — a mark with no `data-pen` gets the first
stroke — but the reason the blog looks hand-made is that no two marks on a page share one.

The blog picks `N` by hashing the marked words, so the same words always get the same
stroke and neighbouring marks almost never do. If you write marks by script, this is the
hash:

```js
function penSeed(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (text.length <= 28 ? 40 : 0) + (h >>> 0) % 40
}
```

## What it does not bring

- **The list marks** (ink dots, level dashes, hand-written numerals). They belong to the
  blog's typography and need a font served from the blog.
- **The link's dashes.** Same reason.
- **The reader's pen.** The bar that lets a reader mark a page is an island of the blog's
  own ([ADR 0043](decisions/0043-the-reader-gets-a-pen.md)); this sheet only paints.
- **A fallback for very old browsers.** The strokes are SVG data-URIs with filters and
  gradients; a browser that cannot draw them shows the plain `mark` and `u` elements.
