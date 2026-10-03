// The ONE door to sharp, and the two libvips settings that are wrong by default here.
//
// sharp is loaded on first use rather than at boot, and three files needed it: this codec is
// the largest single import in the tree, `bun build --compile` bundles its JavaScript and not
// its native module (ADR 0022), and a blog whose owner has uploaded nothing since the process
// started should not be holding an image codec resident. Each of the three deferred it
// separately and said so in its own comment; what none of them could do alone is configure
// libvips, because those settings are PROCESS-global and belong to whichever call site
// happened to run first. So there is one door now, and the settings live behind it.
import type { default as Sharp } from 'sharp'

let mod: typeof Sharp | null = null

/**
 * sharp, configured, loaded once.
 *
 * ⚠️ `cache(false)` IS NOT A TUNING KNOB, IT IS A CORRECTION. libvips keeps an operation cache
 * of up to 50 MB by default, sized for a long-lived image SERVER re-deriving the same picture
 * for many callers. Nothing here is that: every variant is encoded once, stored, and served
 * afterwards as a file, so the cache is memory reserved to answer a question that is never
 * asked twice. Measured 2026-09-21 over three rounds of six variants from a 402 KB photo,
 * 2,955 ms with it and 2,927 ms without — no cost at all, against a high-water mark of 15 MB
 * it stops holding.
 *
 * ⚠️ `concurrency()` IS DELIBERATELY LEFT ALONE, and that is the measurement worth keeping.
 * libvips sizes its thread pool from the HOST's core count and cannot see a cgroup limit, so
 * capping it looks like the same correction `--smol` is for the JavaScript heap. It is not:
 * the same benchmark ran 2,965 ms at the default and 18,005 ms at `concurrency(1)`, six times
 * slower, and the resident peak did not move. The threads are where the speed is; they are not
 * where the memory is.
 */
export async function sharp(): Promise<typeof Sharp> {
  if (mod === null) {
    mod = (await import('sharp')).default
    mod.cache(false)
  }
  return mod
}
