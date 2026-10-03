// The windowed counts must read the created_at range, not every event ever recorded. A bare
// `group by path` let SQLite pick analytics_events_path_idx and walk the whole table: 1.04 s for a
// 30-day window on a million events, 0.068 s through the range (2026-10-03). Asked of the planner,
// so a rewrite that drops the `+` fails here rather than on a big blog's front page.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'

const schema = readFileSync('src/store/schema-analytics.sql', 'utf8')

function plan(sql: string): string {
  const db = new Database(':memory:')
  db.exec(schema)
  const rows = db.query(`explain query plan ${sql}`).all({ $since: 0, $limit: 10 }) as { detail: string }[]
  db.close()
  return rows.map((r) => r.detail).join(' | ')
}

describe('a window over the views reads the window', () => {
  for (const [file, re] of [
    ['src/analytics/summary.ts', /select path, count\(\*\) as views, count\(distinct visitor\) as visitors from analytics_events\s+where created_at >= \$since group by [^\n`]+/],
    ['src/analytics/aggregate.ts', /select path, count\(\*\) as views, count\(distinct visitor\) as visitors from analytics_events\s+where created_at >= \$since group by [^\n`]+/],
  ] as const) {
    it(`${file}: through the created_at index, not the path index`, () => {
      const sql = re.exec(readFileSync(file, 'utf8'))?.[0]
      expect(sql).toBeDefined()
      const p = plan(sql!)
      expect(p).toContain('created')
      expect(p).not.toContain('analytics_events_path_idx')
    })
  }
})
