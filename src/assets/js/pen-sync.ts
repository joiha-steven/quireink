// Tier two of the reader's pen (ADR 0047): the same marks, kept on the server under a name
// that is not the reader's, so they are there on the next device.
//
// Two ways to be named. A NOTEBOOK CODE this browser holds and sends as a header; or the
// commenter cookie the reader already has after signing in with Google to comment, which
// the browser sends by itself. This module knows which of the two is in play, talks to the
// four routes in `web/pen-routes.ts`, and nothing else: what is sent is the page's list of
// marks exactly as `pen-store.ts` keeps it.
//
// The server's copy is the truth once a page has one: on load it replaces what this browser
// had, and every change here is written back. A page the server has never seen is seeded
// from this browser. Two devices marking the same page at the same moment overwrite each
// other, which is the trade for having no merge to get wrong.

import type { Ann } from './pen-store'

/** The code, or the letter `g` meaning the commenter cookie was chosen here. */
const KEY = 'quire:pen:keep'
const HEADER = 'x-quire-pen'

export type Via = 'code' | 'google' | null

const readKey = (): string => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
export const writeKey = (v: string): void => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch { /* then it is asked again */ } }
/** The code this browser holds, or empty when it keeps by cookie or not at all. */
export const codeHere = (): string => { const k = readKey(); return k === 'g' ? '' : k }
export const keepsHere = (): boolean => readKey() !== ''

function headers(code = codeHere()): Record<string, string> {
  return code ? { [HEADER]: code } : {}
}

async function call(path: string, init: RequestInit = {}, code?: string): Promise<Response | null> {
  try {
    return await fetch(path, { ...init, headers: { ...headers(code), ...(init.headers as Record<string, string> ?? {}) } })
  } catch {
    return null
  }
}

const data = async <T>(res: Response | null): Promise<T | null> => {
  if (!res?.ok) return null
  try { return ((await res.json()) as { data: T }).data } catch { return null }
}

/** Who this browser is to the server right now, trying `code` instead of the stored one. */
export async function whoami(code?: string): Promise<Via> {
  return (await data<{ via: Via }>(await call('/api/pen/me', {}, code)))?.via ?? null
}

/** The server's list for a page; null when it has none, or nothing could be asked. */
export async function pull(path: string): Promise<Ann[] | null> {
  return (await data<{ items: Ann[] }>(await call(`/api/pen?path=${encodeURIComponent(path)}`)))?.items ?? null
}

export async function push(path: string, items: Ann[]): Promise<boolean> {
  const res = await call(`/api/pen?path=${encodeURIComponent(path)}`, {
    method: 'PUT', body: JSON.stringify({ items }), headers: { 'content-type': 'application/json' },
  })
  return res?.status === 204
}

/** A new code from the server; this browser starts keeping by it at once. */
export async function mint(): Promise<string> {
  const code = (await data<{ code: string }>(await call('/api/pen/code', { method: 'POST' })))?.code ?? ''
  if (code) writeKey(code)
  return code
}

/** Everything under this name, gone from the server and from here. */
export async function forgetAll(): Promise<void> {
  await call('/api/pen', { method: 'DELETE' })
  writeKey('')
}
