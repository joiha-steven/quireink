// The parts of `theme:preview` that delete things, kept apart so each rule can be tested on its own:
// which output directory may be emptied, which leftover instance may be swept, and what is stopped
// when a run ends however it ends.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Every run's instance is `<.tmp>/theme-preview-work-<random>`, made by `mkdtemp`, so two runs never share one. */
export const WORK_PREFIX = 'theme-preview-work-'
/** In each instance directory: the process that owns it. */
export const LOCK = 'owner.json'
/** In each output directory the command made: what lets `--force` empty it again. */
export const MARKER = '.theme-preview'

export type Lock = { pid: number; started: string }

/** Makes this run's instance directory and writes its lock before anything else goes in it. */
export function createWork(tmpRoot: string, pid: number = process.pid): string {
  mkdirSync(tmpRoot, { recursive: true })
  const work = mkdtempSync(join(tmpRoot, WORK_PREFIX))
  const lock: Lock = { pid, started: new Date().toISOString() }
  writeFileSync(join(work, LOCK), JSON.stringify(lock))
  return work
}

/** Whether a process with this id exists. EPERM is a process we may not signal, which is alive. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function readLock(dir: string): Lock | null {
  try {
    const v = JSON.parse(readFileSync(join(dir, LOCK), 'utf8')) as Partial<Lock>
    return Number.isInteger(v.pid) && (v.pid as number) > 0 ? { pid: v.pid as number, started: String(v.started ?? '') } : null
  } catch {
    return null
  }
}

/**
 * Deletes instance directories whose owner process is gone: a run killed outright (on Windows,
 * TerminateProcess runs no handler; its server and browser die with it, its directory stays).
 * A directory whose lock names a live process is left alone, and so is one with no lock that
 * reads, since nothing says whose it is: a recycled process id can only keep a directory, never
 * delete a live one. Answers the directories it deleted.
 */
export function sweepStaleWork(tmpRoot: string, alive: (pid: number) => boolean = pidAlive): string[] {
  if (!existsSync(tmpRoot)) return []
  const swept: string[] = []
  for (const name of readdirSync(tmpRoot)) {
    if (!name.startsWith(WORK_PREFIX)) continue
    const dir = join(tmpRoot, name)
    const lock = readLock(dir)
    if (!lock || alive(lock.pid)) continue
    rmSync(dir, { recursive: true, force: true })
    swept.push(dir)
  }
  return swept
}

/**
 * The output directory is emptied before a run. It must be strictly inside `.tmp/`, not an
 * instance directory or inside one, and either empty (or absent) or one this command made
 * (`MARKER` at its top) with --force. Anything else that holds files, at any depth, is refused:
 * `.tmp/theme-preview` holds every theme's shots, and a matrix baseline holds no marker.
 */
export function checkedPreviewOut(out: string, force: boolean, root: string): string {
  const abs = resolve(out)
  const rel = relative(root, abs)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`refusing ${abs}: the output directory must be inside ${root}`)
  }
  if (rel.split(sep)[0]!.toLowerCase().startsWith(WORK_PREFIX)) {
    throw new Error(`refusing ${abs}: that is where a run keeps its instance, which is deleted afterwards`)
  }
  // A preview's own output never nests another: forcing the outer one would take the inner one's
  // shots with it. Checked upward from the parent (the default `.tmp/theme-preview/<id>` has no
  // marked ancestor) and, under --force, downward below the top.
  const parts = rel.split(sep)
  for (let i = 1; i < parts.length; i++) {
    if (existsSync(join(root, ...parts.slice(0, i), MARKER))) {
      throw new Error(`refusing ${abs}: it is inside an earlier preview's output, ${join(root, ...parts.slice(0, i))}`)
    }
  }
  if (!existsSync(abs)) return abs
  if (!statSync(abs).isDirectory()) throw new Error(`refusing ${abs}: it is a file`)
  if (readdirSync(abs).length === 0) return abs
  if (!force) throw new Error(`refusing ${abs}: it is not empty. Pass --force to replace a previous preview.`)
  if (!existsSync(join(abs, MARKER))) {
    throw new Error(`refusing ${abs}: it is not empty and theme:preview did not make it, so --force does not apply. Choose another --out.`)
  }
  if (holdsNestedMarker(abs)) {
    throw new Error(`refusing ${abs}: it holds another preview's output, which --force would delete. Choose another --out.`)
  }
  return abs
}

function holdsNestedMarker(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const sub = join(dir, entry.name)
    if (existsSync(join(sub, MARKER)) || holdsNestedMarker(sub)) return true
  }
  return false
}

/**
 * A failed child's output without Bun's source excerpt and stack frames: the `error:` line and
 * anything else it said. The author sees what went wrong, not where in our scripts.
 */
export function briefChildOutput(stderr: string, stdout = ''): string {
  const keep = (text: string) => text.split(/\r?\n/).filter((line) =>
    line.trim() !== '' && !/^\s*\d+ \| /.test(line) && !/^\s*\^+\s*$/.test(line) && !/^\s+at /.test(line) && !/^Bun v\d/.test(line))
  const lines = keep(stderr)
  return (lines.length ? lines : keep(stdout).slice(-5)).slice(0, 10).join('\n')
}

type Stoppable = { stop(): Promise<void> }
type Closable = { close(): Promise<void> }

/** What a run has started. `release` stops and deletes all of it, each step whatever the one before did. */
export class RunResources {
  server?: Stoppable
  browser?: Closable
  work?: string

  async release(): Promise<void> {
    const { server, browser, work } = this
    this.server = undefined
    this.browser = undefined
    this.work = undefined
    try { await server?.stop() } catch { /* already gone */ }
    try { await browser?.close() } catch { /* already gone */ }
    if (work) rmSync(work, { recursive: true, force: true })
  }
}
