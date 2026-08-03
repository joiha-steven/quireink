// The quireINK logo, as outlines. GENERATED, not hand-written: see the note at the bottom.
//
// Two faces, and that pairing IS the brand: Inter for the interface, JetBrains Mono for
// everything that is the machine talking. Both are already shipped with the product, so the
// logo states the type system rather than decorating it.
//
// Outlines rather than live text, for three reasons and only the first is aesthetic:
//   1. /login is the one page where "did this load?" is a security question, so a mark that
//      arrives on its own request can arrive late or swap face mid-paint.
//   2. The admin renders in whatever chrome font the owner picked. As text the logo would
//      have been a different logo per install.
//   3. `pageStyles` declares only the owner's own faces plus Inter and JetBrains Mono, so a
//      logo may not assume any other family is even declared.
//
// Shared by the server-rendered sign-in page and the React admin, which is why it sits at
// the root rather than under `web/`: `src/admin` has its own tsconfig and resolves `@/*` to
// the same `src/`, so one file feeds both and the two can never drift.

/**
 * `Qi` — the logo at the size where a five-letter word is a smear: the app icon, the
 * favicon, the collapsed admin rail. Same two faces as the word, in the same order.
 *
 * Baseline at y=0, so the box starts negative.
 */
export const MARK_VIEWBOX = '0 -102.0 129.9 125.4'

/** `Q`, Inter 500. */
export const MARK_Q =
  'M34.8 -23.5H45.5L53.2 -13.5L56.5 -9.3L68.7 6.6H57.6L49.5 -4L46.8 -7.7ZM38.4 1Q28.9 1 21.5 '
  + '-3.5Q14.1 -8 9.8 -16.3Q5.5 -24.7 5.5 -36.3Q5.5 -48 9.8 -56.4Q14.1 -64.7 21.5 -69.2Q28.9 -73.7 '
  + '38.4 -73.7Q47.8 -73.7 55.2 -69.2Q62.6 -64.7 66.9 -56.4Q71.2 -48 71.2 -36.3Q71.2 -24.7 66.9 '
  + '-16.3Q62.6 -8 55.2 -3.5Q47.8 1 38.4 1ZM38.4 -9.2Q44.6 -9.2 49.5 -12.3Q54.4 -15.4 57.2 -21.5Q60.1 '
  + '-27.6 60.1 -36.3Q60.1 -45.2 57.2 -51.3Q54.4 -57.4 49.5 -60.5Q44.6 -63.6 38.4 -63.6Q32.1 -63.6 '
  + '27.2 -60.4Q22.3 -57.3 19.4 -51.2Q16.6 -45.1 16.6 -36.3Q16.6 -27.6 19.4 -21.5Q22.3 -15.4 27.2 '
  + '-12.3Q32.1 -9.2 38.4 -9.2Z'

/** `i`, JetBrains Mono 700. */
export const MARK_I =
  'M81 0V-11.4H100.2V-43.7H83.5V-55H112.2V-11.4H129.2V0ZM105.2 -64.2Q101.4 -64.2 99.2 -66.1Q97 '
  + '-68.1 97 -71.4Q97 -74.7 99.1 -76.7Q101.3 -78.6 105.1 -78.6Q109 -78.6 111.2 -76.7Q113.4 -74.7 '
  + '113.4 -71.4Q113.4 -68.1 111.2 -66.1Q109 -64.2 105.2 -64.2Z'

/** The word. Baseline at y=0, so the box starts negative. */
export const WORD_VIEWBOX = '0 -96.9 377.6 120.3'

/** `quire`, Inter 400. */
export const WORD_QUIRE =
  'M53.5 20.4H44.7V-8.4H44Q43.2 -6.9 41.4 -4.7Q39.7 -2.4 36.5 -0.6Q33.4 1.2 28.2 1.2Q21.4 1.2 16.2 '
  + '-2.3Q10.9 -5.8 8 -12.1Q5.1 -18.5 5.1 -27.1Q5.1 -35.8 8 -42.1Q11 -48.4 16.2 -51.9Q21.4 -55.3 28.2 '
  + '-55.3Q33.5 -55.3 36.7 -53.5Q39.8 -51.8 41.5 -49.5Q43.2 -47.3 44 -45.8H45V-54.6H53.5ZM29.5 '
  + '-6.7Q34.5 -6.7 37.9 -9.3Q41.3 -11.9 43.1 -16.6Q44.8 -21.2 44.8 -27.2Q44.8 -33.3 43.1 -37.8Q41.4 '
  + '-42.3 37.9 -44.9Q34.5 -47.4 29.5 -47.4Q24.3 -47.4 20.9 -44.7Q17.4 -42 15.7 -37.5Q14 -32.9 14 '
  + '-27.2Q14 -21.5 15.7 -16.9Q17.5 -12.2 20.9 -9.4Q24.4 -6.7 29.5 -6.7Z M85.5 0.7Q79.9 0.7 75.8 '
  + '-1.6Q71.6 -3.9 69.3 -8.4Q66.9 -13 66.9 -19.9V-54.6H75.7V-20.7Q75.7 -14.4 79.1 -10.8Q82.4 -7.2 '
  + '88.1 -7.2Q92 -7.2 95.1 -8.9Q98.2 -10.6 100 -13.9Q101.8 -17.2 101.8 '
  + '-21.9V-54.6H110.6V0H102.2V-13.2H103.3Q100.8 -5.6 96.1 -2.4Q91.5 0.7 85.5 0.7Z M124.1 '
  + '0V-54.6H132.9V0ZM128.5 -63.5Q126 -63.5 124.2 -65.2Q122.4 -66.9 122.4 -69.3Q122.4 -71.8 124.2 '
  + '-73.5Q126 -75.1 128.5 -75.1Q131.1 -75.1 132.9 -73.5Q134.7 -71.8 134.7 -69.3Q134.7 -66.9 132.9 '
  + '-65.2Q131.1 -63.5 128.5 -63.5Z M146.3 0V-54.6H154.8V-46.2H155.4Q156.9 -50.3 160.8 -52.9Q164.7 '
  + '-55.4 169.5 -55.4Q170.5 -55.4 171.9 -55.3Q173.2 -55.3 174 -55.2V-46.4Q173.6 -46.5 172 '
  + '-46.7Q170.5 -46.9 168.7 -46.9Q164.8 -46.9 161.7 -45.2Q158.6 -43.6 156.8 -40.7Q155.1 -37.9 155.1 '
  + '-34.2V0Z M204.9 1.2Q197 1.2 191.2 -2.3Q185.5 -5.9 182.4 -12.2Q179.3 -18.5 179.3 -26.9Q179.3 '
  + '-35.3 182.3 -41.7Q185.4 -48 190.9 -51.7Q196.4 -55.3 203.9 -55.3Q208.2 -55.3 212.4 -53.8Q216.7 '
  + '-52.4 220.1 -49.2Q223.5 -46 225.6 -40.8Q227.6 -35.5 227.6 -28V-24.3H185.3V-31.7H222.9L218.8 '
  + '-29Q218.8 -34.4 217.1 -38.5Q215.4 -42.7 212.1 -45.1Q208.8 -47.5 203.9 -47.5Q198.9 -47.5 195.4 '
  + '-45Q191.9 -42.6 190 -38.7Q188.2 -34.9 188.2 -30.4V-25.5Q188.2 -19.4 190.3 -15.2Q192.4 -11 196.2 '
  + '-8.8Q200 -6.6 204.9 -6.6Q208.2 -6.6 210.8 -7.6Q213.4 -8.5 215.3 -10.4Q217.2 -12.3 218.3 '
  + '-15L226.8 -12.7Q225.5 -8.6 222.5 -5.5Q219.4 -2.3 215 -0.6Q210.5 1.2 204.9 1.2Z'

/**
 * `INK`, JetBrains Mono 700, set at 88% so its caps meet Inter's ascenders instead of
 * towering over them.
 */
export const WORD_INK =
  'M232.4 0V-9.7H245.4V-54.6H232.4V-64.2H269.4V-54.6H256.5V-9.7H269.4V0Z M281.9 0V-64.2H295.4L313.2 '
  + '-12.3Q313 -15.1 312.7 -19Q312.4 -22.8 312.2 -26.8Q312 -30.8 312 -33.8V-64.2H322V0H308.6L290.9 '
  + '-51.9Q291.1 -49.4 291.3 -45.8Q291.6 -42.2 291.8 -38.4Q291.9 -34.6 291.9 -31.4V0Z M333.3 '
  + '0V-64.2H344.3V-38.3H352L364 -64.2H376L361.6 -33.4L376.7 0H364.4L351.8 -28.2H344.3V0Z'

// Regenerate with `.tmp/shots/wordmark.py` (throwaway) against the shipped woff2 files:
//   python wordmark.py word.svg "quire:inter:400:100" "INK:jetbrainsmono:700:88" -20 -6
//   python wordmark.py mark.svg "Q:inter:500:100"     "i:jetbrainsmono:700:100"  -35 0
// The trailing numbers are tracking (em/1000, negative tightens) and the gap between the
// runs. Nothing reads this file at runtime except `web/brand.ts` and the admin's Wordmark.
