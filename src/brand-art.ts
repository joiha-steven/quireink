// The quireINK mark, as outlines. GENERATED, not hand-written: see the note at the bottom.
//
// Both halves are letterforms turned into paths, and that is the whole point. The wordmark
// is the project's two faces standing next to each other — Literata for the words a reader
// reads, JetBrains Mono for everything that is the machine talking — so a mark drawn with
// live text would be a mark that changes with the owner's font settings, and on /login it
// would be a mark that arrives late or swaps face mid-paint. `brand.ts` already makes that
// argument for the symbol; it applies harder to the word.
//
// Shared by the server-rendered sign-in page and the React admin, which is why it sits at
// the root rather than under `web/`: `src/admin` has its own tsconfig and resolves `@/*` to
// the same `src/`, so one file feeds both and the two can never drift.

/** Two leaves and the fold between them: a quire is a gathering of folded sheets. */
export const MARK_VIEWBOX = '0 0 32 32'
export const MARK_PATHS = [
  'M16 8.2C13.4 6.5 9.9 5.5 6 5.5v17c3.9 0 7.4 1 10 2.7 2.6-1.7 6.1-2.7 10-2.7v-17c-3.9 0-7.4 1-10 2.7Z',
  'M16 8.2v17',
]

/** The word. Baseline at y=0, so the box starts negative. */
export const WORD_VIEWBOX = '0 -70.3 420 93.3'

/** `quire`, Literata 400. */
export const WORD_QUIRE =
  'M32.1 21.6V17.1L38.1 16.2Q39.9 15.9 40.6 14.8Q41.3 13.7 41.3 11.3V-6.8V-7.1Q39.3 -4.3 36.7 '
  + '-2.4Q34.1 -0.5 31.2 0.5Q28.2 1.4 24.8 1.4Q18.7 1.4 14.1 -1.7Q9.5 -4.8 7.1 -10.5Q4.7 -16.1 4.7 '
  + '-23.7Q4.7 -32.3 7.7 -38.8Q10.6 -45.2 16.1 -48.7Q21.6 -52.2 29 -52.2Q31.8 -52.2 34.4 -51.7Q37 '
  + '-51.2 39.2 -50.2Q41.5 -49.3 43.4 -47.8L48 -52.1L50.6 -51.3V11.6Q50.6 14.1 51.3 15.1Q52 16 53.6 '
  + '16.2L58.4 17V21.6ZM28.1 -5.5Q31.9 -5.5 34.9 -7.4Q37.9 -9.3 39.6 -12.7Q41.3 -16 41.3 '
  + '-20.3V-41.8Q38.9 -43.8 35.7 -44.9Q32.4 -46 28.9 -46Q24.1 -46 20.9 -43.7Q17.7 -41.3 16.1 '
  + '-36.6Q14.6 -31.9 14.6 -24.9Q14.6 -15.4 18.1 -10.4Q21.5 -5.5 28.1 -5.5Z M86.4 1.4Q78.6 1.4 74.5 '
  + '-3Q70.5 -7.3 70.5 -15.7V-39Q70.5 -42.6 69.9 -43.7Q69.3 -44.8 67.1 -45.2L62.7 -45.9L63.5 '
  + '-50.3L78.6 -51.4L79.8 -50.8V-18.3Q79.8 -13.6 80.7 -10.8Q81.6 -7.9 83.7 -6.7Q85.8 -5.5 89.4 '
  + '-5.5Q93.5 -5.5 96.5 -7.2Q99.5 -8.9 101.2 -12Q102.8 -15.1 102.8 -19.3V-39Q102.8 -42.5 102.2 '
  + '-43.7Q101.7 -44.8 99.4 -45.2L94.9 -45.9L95.7 -50.3L110.9 -51.4L112.1 -50.8V-9.8Q112.1 -7.4 112.8 '
  + '-6.5Q113.4 -5.6 115.3 -5.3L120.3 -4.4V0L104.7 0.6L103.3 -7.5H103.1Q100.5 -4.4 98 -2.5Q95.4 -0.5 '
  + '92.6 0.5Q89.7 1.4 86.4 1.4Z M127.3 0V-4.6L133 -5.5Q134.9 -5.8 135.4 -6.8Q136 -7.8 136 '
  + '-10.5V-38.6Q136 -42.2 135.4 -43.4Q134.7 -44.6 132.4 -44.9L127.6 -45.6L128.3 -50.3L144.2 '
  + '-51.1L145.3 -50.6V-10.1Q145.3 -8.2 145.8 -7.1Q146.3 -5.9 148.5 -5.5L154.1 -4.5V0ZM139.2 '
  + '-62Q136.3 -62 134.4 -63.9Q132.5 -65.7 132.5 -68.6Q132.5 -71.5 134.4 -73.4Q136.3 -75.3 139.2 '
  + '-75.3Q142.2 -75.3 144.1 -73.5Q146 -71.6 146 -68.7Q146 -65.8 144.1 -63.9Q142.2 -62 139.2 -62Z '
  + 'M161.9 0V-4.5L166.7 -5.4Q168.3 -5.7 168.8 -6.7Q169.3 -7.6 169.3 -10.2V-38.9Q169.3 -42.4 168.7 '
  + '-43.6Q168.1 -44.8 165.9 -45.1L161 -45.8L161.6 -50.4L175.4 -51.4L176.6 -50.8L177.6 '
  + '-41.7H177.9Q180.7 -46.8 184.5 -49.5Q188.3 -52.2 192.7 -52.2Q197.4 -52.2 200.2 -49.6Q203 -47 203 '
  + '-42.7Q203 -40.1 202.2 -38.4Q201.5 -36.6 200 -35.7Q198.5 -34.8 196.3 -34.8Q193.5 -34.8 191.9 '
  + '-36Q190.4 -37.2 190.4 -39.2Q190.4 -40.1 190.7 -40.9Q190.9 -41.7 191.4 -42.8Q191.8 -43.8 192.5 '
  + '-45.2Q190.2 -46.2 187.8 -45.5Q185.4 -44.7 183.3 -42.6Q181.2 -40.5 179.9 -37.5Q178.6 -34.4 178.6 '
  + '-30.9V-10Q178.6 -7.6 179.1 -6.8Q179.5 -5.9 181.1 -5.7L189.7 -4.4V0Z M232.2 1.4Q224.9 1.4 219.6 '
  + '-1.8Q214.3 -5 211.4 -10.8Q208.4 -16.7 208.4 -24.7Q208.4 -33.1 211.4 -39.2Q214.5 -45.4 220 '
  + '-48.8Q225.5 -52.2 232.8 -52.2Q238.3 -52.2 242.5 -50Q246.6 -47.8 248.9 -43.8Q251.1 -39.7 251.1 '
  + '-34.4Q251.1 -32.4 250.8 -30Q250.5 -27.6 249.8 -25H218.5Q218.7 -19 220.7 -14.7Q222.6 -10.4 226.2 '
  + '-8.2Q229.8 -5.9 234.6 -5.9Q238.4 -5.9 242 -7.5Q245.6 -9.1 248.5 -12L251.8 -8.7Q248.4 -3.9 243.1 '
  + '-1.2Q237.8 1.4 232.2 1.4ZM218.5 -30.2H241.4Q241.6 -31.2 241.7 -32.4Q241.7 -33.5 241.7 '
  + '-34.8Q241.7 -41 239.2 -44.1Q236.7 -47.2 231.7 -47.2Q227.9 -47.2 225.2 -45.3Q222.4 -43.4 220.7 '
  + '-39.6Q219 -35.8 218.5 -30.2Z'

/** `INK`, JetBrains Mono 700, set at 88% so its caps meet Literata's ascenders
 *  instead of towering over them. */
export const WORD_INK =
  'M269.5 0V-9.7H282.5V-54.6H269.5V-64.2H306.5V-54.6H293.5V-9.7H306.5V0Z M320.7 0V-64.2H334.2L352.1 '
  + '-12.3Q351.8 -15.1 351.5 -19Q351.2 -22.8 351 -26.8Q350.8 -30.8 350.8 '
  + '-33.8V-64.2H360.9V0H347.4L329.7 -51.9Q329.9 -49.4 330.2 -45.8Q330.4 -42.2 330.6 -38.4Q330.8 '
  + '-34.6 330.8 -31.4V0Z M373.9 0V-64.2H384.9V-38.3H392.5L404.6 -64.2H416.6L402.2 -33.4L417.3 '
  + '0H405L392.4 -28.2H384.9V0Z'

// Regenerate with `.tmp-shots/wordmark.py` (throwaway) against the shipped woff2 files:
//   python wordmark.py out.svg 100 88 0 6 INK
// The numbers are em size for `quire`, em size for `INK`, tracking, and the gap between
// them. Nothing reads this file at runtime except the two functions in `web/brand.ts`.
