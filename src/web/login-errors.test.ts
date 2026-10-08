// Where a sign-in error is printed, and what the recovery-codes step offers. Pure renders: no
// database, no server.
import { describe, expect, it } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { passwordScreen, recoveryCodesScreen } from '@/web/login-page'
import { claimScreen } from '@/web/setup-claim-page'

describe('a password error sits next to the password field', () => {
  const page = claimScreen(DEFAULT_SETTINGS, {
    token: 't', error: 'Too short.', username: 'tester', email: 't@example.com', errorAtPassword: true,
  })
  it('names the error on the field and puts it beside it, not in a banner above the form', () => {
    expect(page).toContain('id="password-error"')
    expect(page).toMatch(/<input id="password"[^>]*aria-invalid="true"[^>]*aria-describedby="password-error"/)
    expect(page.indexOf('id="password-error"')).toBeGreaterThan(page.indexOf('id="password"'))
    expect(page.match(/class="login-error/g)?.length).toBe(1)
  })
  it('keeps the other fields and never echoes the password', () => {
    expect(page).toContain('value="tester"')
    expect(page).toContain('value="t@example.com"')
    expect(page).not.toMatch(/id="password"[^>]*value=/)
  })
  it('leaves an error about another field in the banner', () => {
    const other = claimScreen(DEFAULT_SETTINGS, { token: 't', error: 'Bad address.' })
    expect(other).not.toContain('id="password-error"')
    expect(other).not.toContain('aria-invalid="true"')
  })
  it('does the same for a refused sign-in, and focuses the password', () => {
    const login = passwordScreen(DEFAULT_SETTINGS, { error: 'No match.', username: 'tester', errorAtPassword: true })
    expect(login).toContain('aria-describedby="password-error"')
    expect(login).toMatch(/id="password"[^>]*autofocus/)
    expect(login).not.toMatch(/id="username"[^>]*autofocus/)
  })
})

describe('the recovery-codes step', () => {
  const page = recoveryCodesScreen(DEFAULT_SETTINGS, { ticket: 'x', codes: ['AAAAA-BBBBB'], download: 'data:,x' })
  it('says why Continue waits, and offers Copy beside Download', () => {
    expect(page).toContain('data-needs-saved')
    expect(page).toContain('Tick the box above to continue.')
    expect(page).toContain('data-copy-codes')
    expect(page).toContain('quire-recovery-codes.txt')
  })
})
