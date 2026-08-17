// Presentational building blocks shared by the analytics overview and the
// per-page drill-down. No 'use client', no i18n hook — every label comes in as a
// prop so these render in either tree and never drift. Admin is monochrome
// (neutral scale only), matching the rest of the kit.
import Link from '@/admin/router'
import type { ReactNode } from 'react'
import { CARD, StatCard } from './kit'
import type { DailyPoint } from '@/analytics/types'

// Period-over-period change vs the previous window. Null when there's no prior
// data (a zero baseline) — the arrow simply doesn't render.
export function Trend({ cur, prev }: { cur: number; prev?: number }) {
  if (prev == null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return null
  const up = pct > 0
  return (
    <span className="ml-2 align-middle text-xs font-medium text-neutral-500 dark:text-neutral-400">
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

// Flag emoji from an ISO 3166-1 alpha-2 code (regional indicators); '' if invalid.
export function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// Human dwell time. 0 for missing; seconds under a minute, else "m s".
export function formatDuration(ms?: number): string {
  const secs = Math.round((ms ?? 0) / 1000)
  if (secs <= 0) return '0s'
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

/**
 * One headline metric, which is `StatCard` with a trend arrow in it.
 *
 * It used to be a second copy of the same twelve classes, and the copy had already drifted:
 * its sub-line was `neutral-400` against the kit's `neutral-500`, so the line under
 * "Visitors" on Analytics was a shade lighter than the line under "Posts" on the Overview
 * for no reason anyone chose. The trend is the only real difference and it is now a prop.
 */
export function StatTile({ label, value, prev, sub }: { label: ReactNode; value: number | string; prev?: number; sub?: ReactNode }) {
  return (
    <StatCard
      label={label}
      value={typeof value === 'number' ? value.toLocaleString() : value}
      after={typeof value === 'number' && prev != null ? <Trend cur={value} prev={prev} /> : undefined}
      sub={sub}
    />
  )
}

export type BarRow = { key: string; label: ReactNode; value: number; href?: string }

// Horizontal bar list (Plausible-style): the proportional bar is the row's
// background, label + count sit on top. Bars scale to the biggest value.
export function BarList({ title, rows, unit, empty, bare = false }: { title: ReactNode; rows: BarRow[]; unit: ReactNode; empty: ReactNode; bare?: boolean }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1
  return (
    // `bare` inside the one-sheet page: the sheet draws the edges, hairlines divide.
    <div className={bare ? 'p-5' : `${CARD} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const body = (
              <>
                <div
                  className="absolute inset-y-0 left-0 rounded bg-neutral-100 dark:bg-neutral-800"
                  style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                />
                <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-200">{r.label}</span>
                  <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{r.value.toLocaleString()}</span>
                </div>
              </>
            )
            return (
              <li key={r.key} className="relative overflow-hidden rounded">
                {r.href ? (
                  <Link href={r.href} className="block transition-colors hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Compact dual-series time chart (pure SVG, no deps): a filled area for views and
// a line for visitors, stretched to full width. Transparent hover columns carry a
// per-bucket <title> tooltip. `peakLabel`/`viewsLabel`/`visitorsLabel` are localized.
export function TrendChart({
  points,
  peakLabel,
  viewsLabel,
  visitorsLabel,
}: {
  points: DailyPoint[]
  peakLabel: string
  viewsLabel: string
  visitorsLabel: string
}) {
  const W = 720
  const H = 150
  const n = points.length
  const max = points.reduce((m, p) => Math.max(m, p.views), 0) || 1
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const yv = (v: number) => H - (v / max) * (H - 6) - 3
  const viewsPts = points.map((p, i) => `${x(i)},${yv(p.views)}`).join(' ')
  const visitorPts = points.map((p, i) => `${x(i)},${yv(p.visitors)}`).join(' ')
  const area = n > 0 ? `M0,${H} L${points.map((p, i) => `${x(i)},${yv(p.views)}`).join(' L')} L${W},${H} Z` : ''
  const colW = n > 0 ? W / n : W

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-neutral-400 dark:bg-neutral-500" />{viewsLabel}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-neutral-800 dark:bg-neutral-200" />{visitorsLabel}</span>
        </div>
        <span>{peakLabel}: <span className="tabular-nums">{max.toLocaleString()}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img">
        {area && <path d={area} className="fill-neutral-200/50 dark:fill-neutral-700/30" />}
        <polyline points={viewsPts} fill="none" className="stroke-neutral-400 dark:stroke-neutral-500" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polyline points={visitorPts} fill="none" className="stroke-neutral-800 dark:stroke-neutral-200" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <rect key={p.day} x={x(i) - colW / 2} y={0} width={colW} height={H} fill="transparent">
            <title>{`${p.day} · ${p.views} ${viewsLabel} · ${p.visitors} ${visitorsLabel}`}</title>
          </rect>
        ))}
      </svg>
      {points.length > 1 && (
        <div className="mt-1.5 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
          <span className="tabular-nums">{points[0].day}</span>
          <span className="tabular-nums">{points[points.length - 1].day}</span>
        </div>
      )}
    </div>
  )
}
