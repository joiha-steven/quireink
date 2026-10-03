// The `Connection` contract (`src/runtime/db.contract.ts`) against Bun's, opened the way the store
// opens it: a real file, with every PRAGMA `open` sets.
import { afterAll, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { dbContract } from '@/runtime/db.contract'
import { open } from './db'

const DIR = './.tmp/test-runtime-db'
rmSync(DIR, { recursive: true, force: true })
afterAll(() => { try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ } })

let n = 0
dbContract(test, () => open(join(DIR, `case-${++n}.db`), 'NORMAL'))
