// The assistant's own flows.
//
// ⚠️ NOT ONE OF THESE ASKS THE MODEL ANYTHING. `POST /api/assistant` reaches a paid provider
// and then runs registry tools against the live blog — up to nine requests for one question,
// and the consent gate covers eleven tool names out of the whole registry, so a question can
// publish a post without pausing for anybody. The tour's instance has no provider key, which
// makes that route inert (`runAssistant` refuses before it collects a single tool), and two of
// the flows below store a fake one to see the configured face. While that key is stored the
// route stops being inert, so the flows that run under it touch the composer and never the
// send: they type, read the button, and clear the box again.
//
// What IS driven: the chat CRUD routes, which are cheap and local, and everything the island
// does to markup the server already sent.
import type { Tour } from './tour'
import { SCREEN_FORMS } from './tour-ask'

// Storing and clearing the fake key, in the two flows that need the configured face. Never
// used to call anything: a key is what the SCREEN reads to decide whether to open its
// composer, and no flow here posts a question.
const KEY = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const ai = (body) => fetch('/api/integrations/ai', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })`

const CLEAR = `fetch('/api/integrations/ai', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ aiProvider: '', aiApiKey: '', aiModel: '' }),
}).then((r) => r.ok ? 'ok' : 'clear failed: ' + r.status)`

export function registerAiFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  /**
   * ⚠️ THE SAFETY FLOW, and it is the same shape as the newsletter's.
   *
   * `ui/Button` renders a `<button>` with NO `type`, which HTML reads as `type="submit"`. The
   * day this screen grows a `<form>`, Enter pressed in the composer fires a native submit — and
   * what would be submitted is a question to a paid model that can change this blog. There is
   * no latch in front of it and no way to recall what a tool did.
   *
   * So: no form, and every button typed. Asserted on the rendered page rather than in the
   * source, because a `<form>` could arrive from the kit, from an island, or from a screen
   * three refactors from now that no grep of this file would see.
   */
  flow('admin: the assistant is a page, and nothing on it is a form', () => expect('/admin/assistant', `
    (() => {
      const screen = document.querySelector('[data-screen="assistant"]')
      if (!screen) return 'the assistant did not come from the server'
      if (document.documentElement.dataset.adminScreen !== 'assistant') return 'the page is not stamped'
      ${SCREEN_FORMS}
      const forms = screenForms().length
      if (forms) return forms + ' form(s) on a screen that must have none'
      const buttons = [...document.querySelectorAll('button')]
      const untyped = buttons.filter((b) => b.getAttribute('type') !== 'button')
      if (untyped.length) return untyped.length + ' button(s) with no type="button": ' + untyped.map((b) => b.textContent.trim()).join(' | ')
      if (!buttons.length) return 'no buttons at all, so this flow proves nothing'
      const inputs = document.querySelectorAll('textarea, input')
      for (const el of inputs) {
        // The confirm dialog's own box is named for the same reason screenForms names it: it is
        // on every admin page, hidden, and Return submitting it is the point of it.
        const owner = el.closest('form')
        if (owner && !owner.hasAttribute('data-confirm-form')) return 'a field sits inside a form'
      }
      return 'ok (' + buttons.length + ' buttons, 0 forms, ' + inputs.length + ' fields)'
    })()`, 900))

  // With no key the screen is not silently broken: it is a LINK to the place a key goes, and
  // the composer is shut so nothing can be typed into a page that cannot answer.
  flow('admin: with no model the assistant offers the screen that fixes that', () => expect('/admin/assistant', `
    (() => {
      const box = document.querySelector('[data-ai-box]')
      const send = document.querySelector('[data-ai-send]')
      if (!box || !send) return 'no composer'
      if (!box.disabled) return 'the composer is open with no model connected'
      if (!send.disabled) return 'Send is live with no model connected'
      if (document.querySelector('[data-ai-eg]')) return 'example questions offered with no model to answer them'
      const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/admin/settings?tab=server')
      if (!link) return 'no way from here to the screen that stores a key'
      const empty = document.querySelector('[data-ai-empty]')
      if (!empty || empty.hidden) return 'the empty state is not showing on an empty screen'
      return 'ok (' + link.textContent.trim() + ')'
    })()`, 900))

  // ⚠️ A key is stored for this one, which un-inerts `POST /api/assistant`. The flow types into
  // the composer and reads the button; it never presses Send, and it clears the key afterwards.
  flow('admin: a stored key opens the composer and offers three questions', async () => {
    const stored = await expect('/admin/assistant', `(async () => {${KEY}
      const r = await ai({ aiProvider: 'openai', aiApiKey: 'tour-not-a-real-key', aiModel: 'tour-model' })
      return r.ok ? 'ok' : 'could not store a key: ' + r.status
    })()`, 900)
    if (stored !== 'ok') return stored
    try {
      return await expect('/admin/assistant', `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const chips = [...document.querySelectorAll('[data-ai-eg]')]
        if (chips.length !== 3) return 'the empty screen offers ' + chips.length + ' questions'
        const box = document.querySelector('[data-ai-box]')
        const send = document.querySelector('[data-ai-send]')
        if (box.disabled) return 'the composer is shut with a key stored'
        if (!send.disabled) return 'Send is live with nothing typed'
        // Typing arms it and clearing stands it down. Nothing is ever sent.
        box.value = 'a question this flow will not ask'
        box.dispatchEvent(new Event('input', { bubbles: true })); await sleep(150)
        if (send.disabled) return 'Send stayed shut with a question typed'
        const grew = parseInt(box.style.height || '0', 10)
        box.value = ''
        box.dispatchEvent(new Event('input', { bubbles: true })); await sleep(150)
        if (!send.disabled) return 'Send stayed live with the box emptied'
        if (!document.body.innerText.includes('tour-model')) return 'the page does not name the model that would answer'
        return 'ok (3 questions, composer grew to ' + grew + 'px, nothing sent)'
      })()`, 1200)
    } finally {
      await expect('/admin', CLEAR, 600)
    }
  })

  /**
   * The conversation is in the ADDRESS, which it was not in the React face.
   *
   * A chat row is a real link now, so a reload reopens what you were reading and Back walks the
   * conversations you opened. Everything here goes through the chat CRUD routes, which write
   * one small local row and reach nothing outside this process. It cleans up after itself.
   */
  flow('admin: a conversation is a link, and the address survives a reload', async () => {
    const made = await expect('/admin/assistant', `
      fetch('/api/assistant/chats', { method: 'POST' })
        .then((r) => r.json())
        .then((j) => j.success && j.data ? String(j.data.id) : 'could not open a conversation')`, 900)
    if (!/^\d+$/.test(made)) return made
    try {
      const seen = await expect('/admin/assistant', `
        (() => {
          const rows = [...document.querySelectorAll('[data-ai-chat]')]
          if (!rows.length) return 'the column is empty right after a conversation was opened'
          const mine = rows.find((li) => li.dataset.aiChat === '${made}')
          if (!mine) return 'the new conversation is not in the column'
          const link = mine.querySelector('a')
          if (link.getAttribute('href') !== '/admin/assistant?chat=${made}') return 'the row is not a link to itself: ' + link.getAttribute('href')
          if (document.querySelector('[data-ai-no-chats]:not([hidden])')) return 'the column says it is empty while holding a row'
          return 'ok'
        })()`, 900)
      if (seen !== 'ok') return seen

      return await expect('/admin/assistant?chat=' + made, `
        (() => {
          const screen = document.querySelector('[data-screen="assistant"]')
          if (screen.dataset.aiOpen !== '${made}') return 'the address named a conversation the screen did not open'
          // A row's own name must never be on the screen: the rule that keeps a delete confirm
          // shut is written against an ancestor, and a second element wearing that attribute
          // made every confirm in the column unopenable.
          if (screen.hasAttribute('data-ai-chat')) return 'the screen is wearing a row name'
          const open = document.querySelector('[data-ai-chat="${made}"] a')
          if (!open.className.includes('shadow-[inset')) return 'the open conversation is not marked as open'
          return 'ok'
        })()`, 900)
    } finally {
      await expect('/admin/assistant', `fetch('/api/assistant/chats/${made}', { method: 'DELETE' })
        .then((r) => r.ok ? 'ok' : 'cleanup failed: ' + r.status)`, 600)
    }
  })

  /**
   * Delete asks in place, and BOTH answers are already on the page.
   *
   * The cross and the confirm pair are drawn together and CSS picks between them, which is the
   * rule every converted screen follows. It is also where this screen's one real bug was: the
   * confirm could never open, because the screen root wore the same attribute the rule reads
   * from a row's ancestor. A browser is the only thing that would have noticed.
   */
  flow('admin: deleting a conversation asks first, in place', async () => {
    const made = await expect('/admin/assistant', `
      fetch('/api/assistant/chats', { method: 'POST' })
        .then((r) => r.json())
        .then((j) => j.success && j.data ? String(j.data.id) : 'could not open a conversation')`, 900)
    if (!/^\d+$/.test(made)) return made
    let deleted = false
    try {
      const out = await expect('/admin/assistant', `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const row = document.querySelector('[data-ai-chat="${made}"]')
        if (!row) return 'the conversation is not in the column'
        const tall = (el) => el && el.getBoundingClientRect().height > 0
        const confirm = () => row.querySelector('[data-ai-confirm]')
        const cross = () => row.querySelector('[data-ai-del]')
        if (tall(confirm())) return 'the confirm is showing before anybody asked to delete'
        if (!tall(cross())) return 'there is no way to delete a conversation'
        cross().click(); await sleep(150)
        if (!tall(confirm())) return 'the cross did not open the confirm'
        if (tall(cross())) return 'the cross is still there while the confirm is open'
        row.querySelector('[data-ai-del-no]').click(); await sleep(150)
        if (tall(confirm())) return 'Close did not stand the confirm down'
        if (!tall(cross())) return 'Close left the row with no cross'
        cross().click(); await sleep(150)
        row.querySelector('[data-ai-del-yes]').click(); await sleep(600)
        if (document.querySelector('[data-ai-chat="${made}"]')) return 'the row is still in the column after Delete'
        return 'ok (asked, stood down, asked again, gone)'
      })()`, 1500)
      deleted = out.startsWith('ok')
      return out
    } finally {
      if (!deleted) {
        await expect('/admin/assistant', `fetch('/api/assistant/chats/${made}', { method: 'DELETE' })
          .then(() => 'ok')`, 600)
      }
    }
  })

  // The raw record is open by default and stays how it was left. Only at 1600 and up, because
  // a control that toggles something invisible at this width is a control that does nothing.
  flow('admin: what it did is open by default and remembers being shut', () => expect('/admin/assistant', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      localStorage.removeItem('quireink-admin-assistant-log')
      const pane = document.querySelector('[data-ai-log]')
      const toggle = document.querySelector('[data-ai-log-toggle]')
      if (!pane || !toggle) return 'no record column'
      if (pane.hidden) return 'the record column starts shut'
      if (toggle.getAttribute('aria-pressed') !== 'true') return 'the control disagrees with the column'
      toggle.click(); await sleep(150)
      if (!pane.hidden) return 'the control did not shut the column'
      if (localStorage.getItem('quireink-admin-assistant-log') !== '0') return 'shutting it was not remembered'
      toggle.click(); await sleep(150)
      if (pane.hidden) return 'the control did not open the column again'
      if (localStorage.getItem('quireink-admin-assistant-log') !== '1') return 'opening it was not remembered'
      return 'ok'
    })()`, 900))
}
