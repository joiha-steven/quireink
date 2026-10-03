// The windowed counts must read the created_at range, not every event ever recorded. A bare
// `group by path` let SQLite pick analytics_events_path_idx and walk the whole table: 1.04 s for a
// 30-day window on a million events, 0.068 s through the range (2026-10-03). Asked of the planner,
// so a rewrite that drops the `+` fails here rather than on a big blog's front page.
//
// Same day, same copy, three more of the shape: one page's chart walked that page's whole history
// once per bucket (10.4 s for 365 days of the front page), the one-page-only count walked the whole
// visitor index for a 7-day window (2.06 s), and the visitor-cut pieces of `chunked.ts` and
// `window.ts` are only cheap if each one SEEKS its range rather than scanning past it.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { PART_SQL } from '@/analytics/chunked'
import { WINDOW_PART_SQL } from '@/analytics/window'

const schema = readFileSync('src/store/schema-analytics.sql', 'utf8')

const PARAMS = {
  $since: 0, $limit: 10, $path: '/', $from: 0, $upper: 1, $now: 1, $topN: 5,
  $lo: '0', $hi: '8', $bounds: '[[0,1],[1,2]]',
}

function plan(sql: string): string {
  const db = new Database(':memory:')
  db.exec(schema)
  // The bounds CTE is a template literal in the source; the test reads it as written.
  const text = sql.replace('${BOUNDS_CTE}', `with bounds(i, lo, hi) as (
    select key, json_extract(value, '$[0]'), json_extract(value, '$[1]') from json_each($bounds))`)
  const rows = db.query(`explain query plan ${text}`).all(PARAMS) as { detail: string }[]
  db.close()
  return rows.map((r) => r.detail).join(' | ')
}

const source = (file: string, re: RegExp): string => {
  const sql = re.exec(readFileSync(file, 'utf8'))?.[0]
  expect(sql).toBeDefined()
  return sql!
}

describe('a window over the views reads the window', () => {
  for (const [file, re] of [
    ['src/analytics/aggregate.ts', /select path, count\(\*\) as views, count\(distinct visitor\) as visitors from analytics_events\s+where created_at >= \$since group by [^\n`]+/],
    ['src/analytics/summary.ts', /select path, count\(\*\) as c from analytics_events where created_at >= \? group by [^\n`]+/],
  ] as const) {
    it(`${file}: through the created_at index, not the path index`, () => {
      const p = plan(source(file, re).replace('?', '$since'))
      expect(p).toContain('created')
      expect(p).not.toContain('analytics_events_path_idx')
    })
  }

  it('one page\'s chart reads each bucket\'s day, not the page\'s whole history once per bucket', () => {
    const p = plan(source('src/analytics/aggregate.ts', /\$\{BOUNDS_CTE\}\s+select b\.i as i[^`]+where \+?e\.path = \$path[^`]+/))
    expect(p).toContain('created')
    expect(p).not.toContain('analytics_events_path_idx')
  })

  it('one-page-only visitors read the window, not the whole visitor index', () => {
    const p = plan(source('src/analytics/window.ts', /select count\(\*\) as n from \(\s+select visitor from analytics_events where created_at >= \$since\s+group by \+?visitor having count\(distinct path\) = 1\)/))
    expect(p).toContain('created_at>?')
    expect(p).not.toMatch(/SCAN analytics_events USING (COVERING )?INDEX analytics_events_visitor_created_idx/)
  })

  it('who is reading right now reads five minutes, not the path index', () => {
    const p = plan(source('src/analytics/summary.ts', /select path, count\(distinct visitor\) as visitors from analytics_events\s+where created_at >= \$since and created_at <= \$now\s+group by [^`]+/))
    expect(p).toContain('created')
    expect(p).not.toContain('analytics_events_path_idx')
  })
})

describe('a piece of a cut window seeks its own range of visitors', () => {
  for (const [name, sql] of Object.entries({ ...PART_SQL, window: WINDOW_PART_SQL })) {
    it(name, () => {
      const p = plan(sql)
      expect(p).toMatch(/SEARCH (e|analytics_events) USING (COVERING )?INDEX analytics_events_visitor_created_idx \(visitor>\? AND visitor<\?\)/)
      expect(p).not.toMatch(/analytics_events_(created(_path|_visitor)?|path)_idx/)
    })
  }
})
