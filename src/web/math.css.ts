// How a formula sits on the page. `render/math.ts` decides WHAT is a formula; this decides
// what it looks like, and the split is the same one the pen makes: rendered bodies are cached
// under a hash of their Markdown, so anything baked into the HTML could not be restyled
// without evicting every body on the site.
//
// There is almost nothing here, and that is the design. The glyphs, the spacing, the size of
// a fraction bar and the stretch of a bracket are the browser's MathML layout, drawn in its
// own maths face. Restating any of it would be replacing a typographer's work with a guess,
// and it is the reason this feature costs a reader zero bytes.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

export const MATH_CSS = `
/* A formula inherits the reading colour and nothing else. Size is left to the browser: a
   MathML fragment is already set relative to its surrounding text, and forcing it to
   --fs-body would flatten the smaller script sizes inside a subscript or an integral. */
.prose math{color:var(--c-text)}

/* THE ONE RULE THAT EARNS ITS PLACE. A derivation is routinely wider than the measure, and
   an element that cannot scroll widens the PAGE instead — which on a phone means every
   paragraph in the article gets a horizontal scrollbar because of one formula. A code block
   answers this on the element itself; a table cannot be wrapped (the golden compare fixes
   its markup byte for byte) so prose.css.ts scrolls the article around it. A formula has
   a wrapper of its own, so it takes the direct answer. In all three the page never moves. */
.math-block{overflow-x:auto;overflow-y:hidden;margin:1.4em 0}

/* Display maths is centred, which is the convention every printed text follows, and it is
   also what makes an overflowing formula obviously overflowing rather than merely long. */
.math-block math{margin-inline:auto}

/* Book mode indents paragraphs; a formula is not a paragraph and must not carry the indent
   into its own block. The same exemption the headings take. */
.book-text .prose .math-block{text-indent:0}

/* A formula Temml could not parse, shown as the writer's own source so it can be corrected
   on the page where it is visibly wrong. Deliberately NOT red: colour here would have to be
   a literal (the palettes carry no error token), and a cached body cannot be restyled later.
   The dotted rule under mono text already reads as "this is not finished" in every palette. */
.math-error{font-family:var(--font-mono);font-size:var(--fs-code);
  line-height:var(--lh-code);letter-spacing:var(--ls-code);
  border-bottom:1px dotted var(--c-rule);opacity:.75}
`.trim()
