// What `theme:preview` deletes, and when (scripts/theme-preview-work.ts): leftover instances only
// when their owner process is gone, an output directory only when it is empty or one the command
// made, and everything a run started when it ends, whatever stopped it.
import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  briefChildOutput, checkedPreviewOut, createWork, LOCK, MARKER, pidAlive, RunResources, sweepStaleWork, WORK_PREFIX,
} from '../../scripts/theme-preview-work'

const root = mkdtempSync(join(tmpdir(), 'theme-preview-work-test-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))
let n = 0
const freshTmp = (): string => {
  const dir = join(root, `tmp${n++}`, '.tmp')
  mkdirSync(dir, { recursive: true })
  return dir
}
const workWithLock = (tmp: string, name: string, lock: string | null): string => {
  const dir = join(tmp, `${WORK_PREFIX}${name}`)
  mkdirSync(join(dir, 'pristine'), { recursive: true })
  if (lock !== null) writeFileSync(join(dir, LOCK), lock)
  return dir
}

describe('createWork and pidAlive', () => {
  it('makes a fresh directory per run with a lock naming this process', () => {
    const tmp = freshTmp()
    const a = createWork(tmp)
    const b = createWork(tmp)
    expect(a).not.toBe(b)
    expect(JSON.parse(readFileSync(join(a, LOCK), 'utf8')).pid).toBe(process.pid)
  })

  it('knows this process is alive and an exited one is not', async () => {
    expect(pidAlive(process.pid)).toBe(true)
    const child = Bun.spawn([process.execPath, '-e', '0'])
    await child.exited
    expect(pidAlive(child.pid)).toBe(false)
  })
})

describe('sweepStaleWork', () => {
  it('deletes a directory whose owner is gone and keeps one whose owner is alive, whatever the port', () => {
    const tmp = freshTmp()
    const dead = workWithLock(tmp, 'dead', JSON.stringify({ pid: 41, started: '' }))
    const alive = workWithLock(tmp, 'alive', JSON.stringify({ pid: 42, started: '' }))
    const swept = sweepStaleWork(tmp, (pid) => pid === 42)
    expect(swept).toEqual([dead])
    expect(existsSync(dead)).toBe(false)
    expect(existsSync(join(alive, 'pristine'))).toBe(true)
  })

  it('keeps a live run in the middle of seeding, which serves nothing on any port', () => {
    const tmp = freshTmp()
    const running = createWork(tmp)
    expect(sweepStaleWork(tmp)).toEqual([])
    expect(existsSync(running)).toBe(true)
  })

  it('leaves alone a directory with no lock, or one that does not read, and anything not an instance', () => {
    const tmp = freshTmp()
    const none = workWithLock(tmp, 'none', null)
    const junk = workWithLock(tmp, 'junk', 'not json')
    const other = join(tmp, 'theme-matrix-3411')
    mkdirSync(other)
    expect(sweepStaleWork(tmp, () => false)).toEqual([])
    for (const d of [none, junk, other]) expect(existsSync(d)).toBe(true)
  })
})

describe('checkedPreviewOut', () => {
  it('takes an absent or empty directory strictly inside .tmp/', () => {
    const tmp = freshTmp()
    expect(checkedPreviewOut(join(tmp, 'theme-preview', 'x'), false, tmp)).toBe(join(tmp, 'theme-preview', 'x'))
    mkdirSync(join(tmp, 'empty'))
    expect(checkedPreviewOut(join(tmp, 'empty'), false, tmp)).toBe(join(tmp, 'empty'))
  })

  it('refuses .tmp itself, anything outside it, and an instance directory', () => {
    const tmp = freshTmp()
    expect(() => checkedPreviewOut(tmp, false, tmp)).toThrow('must be inside')
    expect(() => checkedPreviewOut(join(tmp, '..', 'out'), false, tmp)).toThrow('must be inside')
    expect(() => checkedPreviewOut(`${tmp}-other`, false, tmp)).toThrow('must be inside')
    expect(() => checkedPreviewOut(join(tmp, `${WORK_PREFIX}abc`), true, tmp)).toThrow('keeps its instance')
    expect(() => checkedPreviewOut(join(tmp, `${WORK_PREFIX}abc`, 'out'), true, tmp)).toThrow('keeps its instance')
  })

  it('never nests one preview output inside another', () => {
    const tmp = freshTmp()
    const outer = join(tmp, 'theme-preview')
    mkdirSync(join(outer, 'broadsheet'), { recursive: true })
    writeFileSync(join(outer, MARKER), '')
    writeFileSync(join(outer, 'broadsheet', MARKER), '')
    writeFileSync(join(outer, 'broadsheet', 'tag__default__375__light.png'), 'x')
    expect(() => checkedPreviewOut(join(outer, 'other'), false, tmp)).toThrow('inside an earlier preview')
    expect(() => checkedPreviewOut(outer, true, tmp)).toThrow("holds another preview's output")
    expect(checkedPreviewOut(join(outer, 'broadsheet'), true, join(tmp, 'theme-preview'))).toBe(join(outer, 'broadsheet'))
  })

  it('refuses a directory holding files at any depth unless forced', () => {
    const tmp = freshTmp()
    const parent = join(tmp, 'theme-preview')
    mkdirSync(join(parent, 'broadsheet'), { recursive: true })
    writeFileSync(join(parent, 'broadsheet', 'tag__default__375__light.png'), 'x')
    expect(() => checkedPreviewOut(parent, false, tmp)).toThrow('not empty')
    const notes = join(tmp, 'review')
    mkdirSync(notes)
    writeFileSync(join(notes, 'notes.txt'), 'x')
    expect(() => checkedPreviewOut(notes, false, tmp)).toThrow('not empty')
  })

  it('lets --force empty only a directory theme:preview made', () => {
    const tmp = freshTmp()
    const mine = join(tmp, 'theme-preview', 'broadsheet')
    mkdirSync(mine, { recursive: true })
    writeFileSync(join(mine, MARKER), '')
    writeFileSync(join(mine, 'tag__default__375__light.png'), 'x')
    expect(checkedPreviewOut(mine, true, tmp)).toBe(mine)
    // The parent of every theme's previews, and a matrix baseline, are not its to empty.
    expect(() => checkedPreviewOut(join(tmp, 'theme-preview'), true, tmp)).toThrow('did not make it')
    const baseline = join(tmp, 'theme-baseline-t2b')
    mkdirSync(baseline)
    writeFileSync(join(baseline, 'plain__home-list__375__light.png'), 'x')
    expect(() => checkedPreviewOut(baseline, true, tmp)).toThrow('did not make it')
  })
})

describe('briefChildOutput', () => {
  it("keeps Bun's error line and drops the source excerpt, the caret, the frames and the version", () => {
    const stderr = [
      '56 |   if (after.home.front.kind !== wantKind) wrong.push(`x`)',
      '57 |   if (wrong.length) throw new Error(`settings were not saved as asked: ${wrong.join(\'; \')}`)',
      '                                   ^',
      'error: settings were not saved as asked: theme plain != x',
      '      at C:\\repo\\scripts\\theme-preview-setup.ts:57:31',
      '',
      'Bun v1.3.14 (Windows x64)',
    ].join('\n')
    expect(briefChildOutput(stderr)).toBe('error: settings were not saved as asked: theme plain != x')
  })

  it('falls back to the last lines of stdout when stderr says nothing', () => {
    expect(briefChildOutput('', 'a\nb\nseed failed: no posts\n')).toBe('a\nb\nseed failed: no posts')
  })
})

describe('RunResources.release', () => {
  it('stops the server, closes the browser and deletes the instance, even when stopping throws', async () => {
    const tmp = freshTmp()
    const run = new RunResources()
    const calls: string[] = []
    run.work = createWork(tmp)
    run.server = { stop: async () => { calls.push('server'); throw new Error('already exited') } }
    run.browser = { close: async () => { calls.push('browser') } }
    const work = run.work
    await run.release()
    expect(calls).toEqual(['server', 'browser'])
    expect(existsSync(work)).toBe(false)
    await run.release()
    expect(calls).toEqual(['server', 'browser'])
  })
})
