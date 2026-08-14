import { chromePath } from './chrome-path'
// Screenshot a page, so a visual change can be LOOKED AT instead of reasoned about.
//
// This script exists because its absence cost a milestone. The whole public renderer was
// built without anyone seeing it: two attempts to drive a browser on the Windows dev
// machine hung and died, the gap was written down as "not visually verified", and work
// continued anyway. The result reproduced the theme tokens exactly and the LAYOUT not at
// all — which is the first thing the owner saw and the only thing they could judge.
//
// It runs against `chrome-headless-shell` (Chrome for Testing): a standalone binary, no
// snap confinement, no Playwright. Install once:
//
//   VER=$(curl -s https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json | ...)
//   curl -sL ".../$VER/linux64/chrome-headless-shell-linux64.zip" -o /tmp/chs.zip && unzip ...
//   apt install libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 \
//     libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
//     libasound2t64 libnss3
//
// Usage:
//   bun run shot <url> <out.png> [width] [height]
//   bun run shot http://127.0.0.1:3100/ v2-home.png 1280 2400

const CHROME = chromePath()

const [url, out, width = '1280', height = '2400'] = process.argv.slice(2)

if (!url || !out) {
  console.error('usage: bun run shot <url> <out.png> [width] [height]')
  process.exit(1)
}

const proc = Bun.spawnSync([
  CHROME,
  '--headless',
  '--disable-gpu',
  // The screenshots are taken on a server, as root or as a service user; neither has a
  // usable sandbox and neither is rendering untrusted pages.
  '--no-sandbox',
  // Without this the scrollbar is painted INTO the image, so two shots of the same page
  // differ by 15px of width whenever one of them happens to overflow.
  '--hide-scrollbars',
  `--window-size=${width},${height}`,
  `--screenshot=${out}`,
  url,
])

const stderr = new TextDecoder().decode(proc.stderr)
// Chrome writes its "N bytes written" confirmation to stderr along with sandbox warnings
// that are not failures. The file existing is the real check.
if (!(await Bun.file(out).exists())) {
  console.error(`shot: no image produced for ${url}`)
  console.error(stderr.split('\n').filter((l) => !l.includes('InitializeSandbox')).join('\n'))
  process.exit(1)
}

const size = Bun.file(out).size
console.log(`${out}  ${width}x${height}  ${(size / 1024).toFixed(0)} KB  <- ${url}`)
