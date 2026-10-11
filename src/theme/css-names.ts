// The closed lists the theme checker compares against. Every entry is lowercase, because
// every comparison goes through `asciiLower` first.

/** CSS Color 4 named colours: all 148. `transparent` and `currentcolor` are not among them. */
export const NAMED_COLOURS: ReadonlySet<string> = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
  'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
  'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
])

/**
 * System colours, current and deprecated (CSS Color 4 section 6.2 and appendix A), and the
 * prefixed keywords engines still resolve to a colour. Each is a colour the palette does not
 * choose, so each is a hardcoded colour as far as C1 is concerned.
 */
export const SYSTEM_COLOURS: ReadonlySet<string> = new Set([
  'accentcolor', 'accentcolortext', 'activetext', 'buttonborder', 'buttonface', 'buttontext',
  'canvas', 'canvastext', 'field', 'fieldtext', 'graytext', 'highlight', 'highlighttext',
  'linktext', 'mark', 'marktext', 'selecteditem', 'selecteditemtext', 'visitedtext',
  'activeborder', 'activecaption', 'appworkspace', 'background', 'buttonhighlight',
  'buttonshadow', 'captiontext', 'inactiveborder', 'inactivecaption', 'inactivecaptiontext',
  'infobackground', 'infotext', 'menu', 'menutext', 'scrollbar', 'threeddarkshadow',
  'threedface', 'threedhighlight', 'threedlightshadow', 'threedshadow', 'window', 'windowframe',
  'windowtext', '-webkit-link', '-webkit-text', '-webkit-activelink', '-webkit-focus-ring-color',
  '-moz-hyperlinktext', '-moz-visitedhyperlinktext', '-moz-activehyperlinktext',
  '-moz-default-color', '-moz-default-background-color', '-moz-buttontext', '-moz-field',
  '-moz-fieldtext', '-moz-dialog', '-moz-dialogtext', '-moz-cellhighlight',
  '-moz-cellhighlighttext', '-moz-buttondefault', '-moz-buttonhoverface',
  '-moz-buttonhovertext', '-moz-combobox', '-moz-comboboxtext', '-moz-menuhover',
  '-moz-menuhovertext', '-moz-menubartext', '-moz-menubarhovertext', '-moz-oddtreerow',
  '-moz-eventreerow', '-moz-nativehyperlinktext',
])

/** Functions that write a colour from numbers. Allowed only as relative colour from a var(). */
export const COLOUR_FUNCTIONS: ReadonlySet<string> = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'device-cmyk',
])

/**
 * Properties whose idents are author-chosen NAMES, not colours: an animation, counter, grid
 * area or container may well be called `red` or `menu`. Colour-name idents are not refused
 * here; hex and colour functions still are.
 */
export const NAME_PROPERTIES: ReadonlySet<string> = new Set([
  'animation', 'animation-name', 'animation-timeline', 'container', 'container-name',
  'counter-increment', 'counter-reset', 'counter-set', 'grid-area', 'grid-column',
  'grid-column-end', 'grid-column-start', 'grid-row', 'grid-row-end', 'grid-row-start',
  'grid-template-areas', 'view-transition-name', 'view-transition-class', 'anchor-name',
  'position-anchor', 'transition', 'transition-property', 'will-change', 'timeline-scope',
  'scroll-timeline-name', 'scroll-timeline', 'view-timeline-name', 'view-timeline',
  'list-style-type', 'font-family', 'font',
])

/**
 * Properties other than `content` that put author text in front of a reader, so S3 holds them
 * to the same rule: `quotes: "Hello"` is `content: open-quote` with the words moved.
 */
export const TEXT_PROPERTIES: ReadonlySet<string> = new Set([
  'quotes', 'list-style', 'list-style-type', 'text-overflow', 'hyphenate-character',
  'text-emphasis', 'text-emphasis-style',
])

/** Generated-content functions that produce text from somewhere other than a `--l-*` label. */
export const TEXT_FUNCTIONS: ReadonlySet<string> = new Set([
  'attr', 'string', 'content', 'leader', 'target-text', 'target-counter', 'target-counters',
])

/** Math functions T1 accepts around a `--fs-*` variable. */
export const MATH_FUNCTIONS: ReadonlySet<string> = new Set(['calc', 'min', 'max', 'clamp'])

export const FONT_FAMILY_VARS: ReadonlySet<string> = new Set([
  '--font-reading', '--font-sans', '--font-mono', '--font-display',
])

export const ALLOWED_AT_RULES: ReadonlySet<string> = new Set(['media', 'supports', 'container', 'keyframes'])

/**
 * Properties that run code in some engine (IE behaviours, Gecko XBL). Compared after the
 * vendor prefix is removed, so `-moz-binding` arrives here as `binding`.
 */
export const CODE_PROPERTIES: ReadonlySet<string> = new Set(['behavior', 'binding'])

/** Properties that resize text without a font-size, refused by T1. Unprefixed names. */
export const SIZE_PROPERTIES: ReadonlySet<string> = new Set(['zoom', 'text-size-adjust', 'font-size-adjust'])

/**
 * Counter styles that print digits or symbols. Alphabetic styles spell: `counter-reset: a 8`
 * with `upper-alpha` prints H, and a row of counters prints a word.
 */
export const COUNTER_STYLES: ReadonlySet<string> = new Set([
  // Not the roman styles: I V X L C D M spell words ("LIVID" from five counters).
  'decimal', 'decimal-leading-zero', 'disc', 'circle', 'square', 'none',
])

/** Other idents `list-style` and `list-style-type` take besides a counter style. */
export const LIST_STYLE_KEYWORDS: ReadonlySet<string> = new Set([
  'inside', 'outside', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
])
