// A blog with an owner, for the tests that install a theme from a zip and look at the public pages
// it draws (ADR 0072, T2b). Each test file passes its own directory, for the reason `test/db.ts`
// names; the store directory is the blob store's, where the installer writes the package's files.
import { afterAll, beforeEach, expect } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { resetSettingsCache, saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { forgetInstalledTheme } from '@/content/chosen-theme'
import { payload } from '@/test/api'
import { MANIFEST } from '@/theme/test-zip'

/** A palette that clears the checker's contrast floor, with grounds no built-in palette has. */
export const NEWSPRINT = {
  id: 'newsprint', name: 'Newsprint',
  light: { bg: '#fff8e7', text: '#222222', heading: '#111111', meta: '#555555', link: '#1a4d8f', rule: '#e0d8c0', accent: '#1a4d8f' },
  dark: { bg: '#101820', text: '#e8e8e8', heading: '#ffffff', meta: '#a0a0a0', link: '#8fb8ff', rule: '#2a3440', accent: '#8fb8ff' },
}

const face = (weight: number) => [{ file: 'fonts/body.woff2', weight, style: 'normal' }]

/** Every switch, a palette and a font of each role, over the test package's files. */
export const RICH = {
  ...MANIFEST,
  layout: { menu: 'header', deepenMetaInk: true },
  palettes: [NEWSPRINT],
  fonts: [
    { id: 'body-serif', name: 'Body Serif', role: 'reading', faces: face(400) },
    { id: 'ui-face', name: 'UI Face', role: 'chrome', faces: face(500) },
    { id: 'headline', name: 'Headline', role: 'display', faces: face(700) },
  ],
  suggests: { palette: 'newsprint' },
  ownsSettings: ['table.head'],
}

export function themeBlog(dir: string) {
  const store = join(process.cwd(), `${dir}-store`)
  process.env.STORAGE_LOCAL_DIR = store
  rmSync(store, { recursive: true, force: true })
  freshDatabase(dir)
  afterAll(() => {
    dropDatabase(dir)
    try { rmSync(store, { recursive: true, force: true }) } catch { /* test hygiene only */ }
  })

  const app = createApp()
  let cookie = ''
  beforeEach(async () => {
    for (const t of ['sessions', 'users', 'themes', 'settings', 'server_secrets', 'posts', 'pages', 'post_terms']) {
      db().run(`delete from ${t}`)
    }
    rmSync(store, { recursive: true, force: true })
    mkdirSync(store, { recursive: true })
    resetSettingsCache()
    resetSecretCache()
    resetLimits()
    // The rows went behind the renderer's back, which no write in the product does.
    forgetInstalledTheme()
    clearCache()
    const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
    cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
    await saveSettings({ menu: [{ label: 'Colophon', href: '/colophon' }] })
    await savePost({ title: 'A post', slug: 'a-post', status: 'published', date: '2025-06-01T12:00:00.000Z',
      content: 'Words.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n' })
    clearCache()
  })

  const asOwner = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) } })

  /** Installs `zip` through the owner's route and answers its hash. */
  const install = async (zip: Uint8Array): Promise<string> => {
    const form = new FormData()
    form.append('file', new File([zip], 'theme.zip', { type: 'application/zip' }), 'theme.zip')
    const res = await asOwner('/api/themes', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    return (await payload<{ hash: string }>(res)).hash
  }

  /** A settings save through the owner's route, as the admin makes one. */
  const save = async (patch: Record<string, unknown>): Promise<Response> =>
    asOwner('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })

  /** A public page: its status and its HTML. */
  const page = async (path: string): Promise<{ status: number; html: string }> => {
    const res = await app.request(path)
    return { status: res.status, html: await res.text() }
  }

  return { app, asOwner, install, save, page }
}

export const htmlTag = (html: string): string => /<html[^>]*>/.exec(html)?.[0] ?? ''
/** The settings block, the one unnamed `<style>` in the head. */
export const inlineStyle = (html: string): string => /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? ''
export const sheetLink = (hash: string): string => `<link rel="stylesheet" href="/themes/${hash}/theme.css">`
