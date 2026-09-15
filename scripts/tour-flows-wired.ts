// THE CONTROLS THAT WERE DRAWN AND WIRED TO NOTHING, pressed in a real browser.
//
// Every key in this file did nothing when pressed until 2026-09-15. The markup was right, the
// types were right, the suite was green, and `check:all` had nothing to say — because what was
// missing was the JOIN between a screen and its island, and no unit test crosses that seam.
// `check:admin-wired` catches the seam now; these flows catch the BEHAVIOUR, which is the other
// half: a hook can have a reader and still do the wrong thing.
//
// ⚠️ NOT ONE DANGEROUS ROUTE IS FIRED HERE. Nothing mints or revokes an MCP token, takes or
// deletes a backup, purges a CDN, starts an import or asks a provider for a model list. What is
// pressed is what the browser does on its own: a dialog that must OPEN before a delete, a key
// that must arm itself, and a list that must write the value the Save key would send. The one
// delete that is confirmed here is answered with Cancel.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions. Each one is a template literal:
// a backtick in a comment closes it, and a backslash is eaten before the browser sees it.
import type { Tour } from './tour'

export function registerWiredFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  /**
   * ⚠️ THE ONE DELETE ON THIS SCREEN THAT NOTHING CAN UNDO. `server/backup.ts` unlinks the
   * archive: no trash, no restore, and if it was the only copy of a blog the blog is gone with
   * it. Between 2026-09-12 and 2026-09-15 the key fetched on its first statement and the toast
   * afterwards said "Moved to Trash", which names a place the owner could go and look.
   *
   * The flow answers CANCEL, so nothing is deleted — which is also the assertion that matters:
   * a question that cannot be refused is not a question.
   */
  flow('admin: deleting a backup asks first, and Cancel means no', () => expect('/admin/settings?tab=server', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const rows = document.querySelector('[data-backup-list]')
      const tpl = document.querySelector('template[data-backup-row]')
      if (!rows || !tpl) return 'the snapshot list did not arrive drawn'
      // A row of our own, so nothing real is at risk even if the question is answered wrongly.
      const row = tpl.content.firstElementChild.cloneNode(true)
      row.dataset.backup = 'tour-not-a-real-archive.tar.gz'
      rows.append(row)
      const key = row.querySelector('[data-backup-delete]')
      if (!key) return 'the planted row has no delete key'
      let asked = false
      const seen = (e) => { asked = true }
      window.addEventListener('quire:confirm', seen, { capture: true })
      key.click()
      await wait(120)
      window.removeEventListener('quire:confirm', seen, { capture: true })
      if (!asked) return 'it deleted without asking'
      const box = document.querySelector('[data-confirm]')
      if (!box || box.hidden) return 'the question was raised and no dialog opened'
      const title = document.querySelector('[data-confirm-title]').textContent.trim()
      const body = document.querySelector('[data-confirm-body]').textContent.trim()
      if (!title) return 'the dialog opened with no question in it'
      if (body.indexOf('tour-not-a-real-archive') < 0) return 'the dialog does not name the archive'
      // And the way out. A dialog whose only answer is yes is a delay, not a question.
      document.querySelector('[data-confirm-no]').click()
      await wait(120)
      if (!document.querySelector('[data-confirm]').hidden) return 'Cancel did not close it'
      if (!row.isConnected) return 'Cancel deleted the row anyway'
      row.remove()
      return 'ok (asked, named the archive, and Cancel kept it)'
    })()`, 2500))

  /**
   * ⚠️ THE ADD KEY SHIPS DISABLED AND SOMETHING HAS TO ARM IT. The server cannot know whether
   * the two boxes beside it are empty, so it draws the only state it can be sure of — and for
   * three days nothing changed that state, which left a complete handler unreachable and manual
   * redirects impossible to create from the admin.
   */
  flow('admin: the redirect key arms itself once both boxes have something in them', () => expect('/admin/settings?tab=server', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const from = document.querySelector('[data-redirect-source]')
      const to = document.querySelector('[data-redirect-destination]')
      const key = document.querySelector('[data-redirect-add]')
      if (!from || !to || !key) return 'the redirect card did not arrive drawn'
      if (!key.disabled) return 'it shipped live, which is a key that acts on two empty boxes'
      from.value = '/old-path'
      from.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      if (!key.disabled) return 'one box was enough to arm it'
      to.value = '/new-path'
      to.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      if (key.disabled) return 'both boxes are filled and the key is still asleep'
      // Put the screen back the way it was found. Nothing was posted.
      from.value = ''
      to.value = ''
      from.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      if (!key.disabled) return 'it stayed armed over two empty boxes'
      return 'ok (asleep, asleep, awake, asleep)'
    })()`, 2500))

  /**
   * ⚠️ A LIST IS ONE VALUE. The rows used to carry a field each, and the screen sends a deep
   * partial: editing one field sent an array with holes in every other index, and REMOVING a row
   * could not be expressed at all — the survivors renumbered back onto their own stored values,
   * so nothing was dirty and the row returned on the next load.
   *
   * This asserts the value the Save key WOULD send, not the rows on screen. Nothing is saved.
   */
  flow('admin: adding and removing a menu row changes what Save would send', () => expect('/admin/settings?tab=home', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const held = document.querySelector('[data-k="menu"]')
      if (!held) return 'the menu does not ride as one value'
      const read = () => JSON.parse(held.value)
      const before = read()
      if (!Array.isArray(before)) return 'the menu field is not an array'
      const rows = () => document.querySelectorAll('[data-menu-row]').length
      const started = rows()
      if (started !== before.length) return started + ' row(s) drawn against ' + before.length + ' stored'
      document.querySelector('[data-menu-add]').click()
      await wait(60)
      if (rows() !== started + 1) return 'Add drew no row'
      if (read().length !== before.length + 1) return 'Add drew a row the value knows nothing about'
      // Typing in it reaches the value, which is the half a per-row field could do too.
      const boxes = document.querySelectorAll('[data-menu-label]')
      const last = boxes[boxes.length - 1]
      last.value = 'Tour'
      last.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      if (read()[before.length].label !== 'Tour') return 'what was typed did not reach the value'
      // And the half it could not: a removal.
      const keys = document.querySelectorAll('[data-menu-remove]')
      keys[keys.length - 1].click()
      await wait(60)
      if (rows() !== started) return 'Remove took no row away'
      if (read().length !== before.length) return 'the row went and the value kept it'
      if (JSON.stringify(read()) !== JSON.stringify(before)) return 'the menu came back different'
      return 'ok (' + before.length + ' rows, one added, typed into, removed, back to ' + before.length + ')'
    })()`, 3000))

  /**
   * The featured list's two move keys and the select that feeds it. All of it is local: the
   * order is a settings value and goes nowhere until Save.
   */
  flow('admin: the featured list reorders, and the ends cannot move past themselves', () => expect('/admin/settings?tab=home', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const held = document.querySelector('[data-k="featured"]')
      const pick = document.querySelector('[data-featured-add]')
      if (!held || !pick) return 'the featured card did not arrive drawn'
      const read = () => JSON.parse(held.value)
      // Start from a known shape by adding two, whatever the seed left behind.
      const free = [...pick.options].filter((o) => o.value && !o.hidden)
      if (free.length < 2) return 'only ' + free.length + ' post(s) left to feature'
      for (const want of free.slice(0, 2)) {
        pick.value = want.value
        pick.dispatchEvent(new Event('change', { bubbles: true }))
        await wait(60)
      }
      const added = read()
      if (added.length < 2) return 'the select added nothing'
      const first = document.querySelectorAll('[data-featured-up]')[0]
      const downs = document.querySelectorAll('[data-featured-down]')
      if (!first.disabled) return 'the first row can be moved up'
      if (!downs[downs.length - 1].disabled) return 'the last row can be moved down'
      // Move the last one up and watch the order follow.
      const ups = document.querySelectorAll('[data-featured-up]')
      ups[ups.length - 1].click()
      await wait(60)
      const moved = read()
      const last = added[added.length - 1]
      if (moved[moved.length - 2] !== last) return 'the key moved a row and the value did not follow'
      // Put back what this flow added, so the screen is left as it was found.
      for (let i = 0; i < 2; i++) {
        const keys = document.querySelectorAll('[data-featured-remove]')
        keys[keys.length - 1].click()
        await wait(50)
      }
      return 'ok (' + added.length + ' featured, ends pinned, one moved, value followed)'
    })()`, 4000))

  /**
   * ⚠️ THE BROWSER WILL NOT SAY THIS. Native constraint validation fires on a form submit, and
   * this screen has no `<form>` — so between ADR 0054 and 2026-09-15 a number outside its range
   * was accepted in silence, `clampNumber` rewrote it on save, and the screen said "Settings
   * saved". Six translated sentences sat in `locales/` with nothing left that read them.
   */
  flow('admin: a number below its floor says so, in the admin\'s own words', () => expect('/admin/settings', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const box = document.querySelector('[data-k="excerptLength"]')
      if (!box) return 'the excerpt length field is not on the screen'
      if (!box.min) return 'the field carries no floor, so this proves nothing'
      const slot = document.querySelector('[data-field-check="excerptLength"]')
      if (!slot) return 'no line was drawn to say why a value was refused'
      if (!slot.hidden) return 'the refusal line arrived already showing'
      const was = box.value
      box.value = String(Number(box.min) - 1)
      box.dispatchEvent(new Event('blur', { bubbles: false }))
      await wait(80)
      if (slot.hidden) return 'a value under the floor was accepted without a word'
      if (slot.textContent.indexOf(box.min) < 0) return 'the line does not say what the floor is'
      if (box.getAttribute('aria-invalid') !== 'true') return 'a screen reader was not told'
      // And it stops complaining once the value is back inside the range.
      box.value = was
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(80)
      if (!slot.hidden) return 'the line stayed up over a value that is fine'
      if (box.hasAttribute('aria-invalid')) return 'aria-invalid outlived the problem'
      return 'ok (refused below ' + box.min + ', named the floor, cleared on repair)'
    })()`, 3000))

  /**
   * The font block: four slots, and the value they all write into. Nothing is uploaded — the
   * Remove key is the half that needs no file, and it is the half that has to reach the value.
   */
  flow('admin: removing a font weight reaches the value the Save key would send', () => expect('/admin/settings?tab=appearance', `
    (async () => {
      const wait = (ms) => new Promise((go) => setTimeout(go, ms))
      const held = document.querySelector('[data-k="customFont"]')
      const box = document.querySelector('[data-font-upload]')
      if (!held || !box) return 'the font block did not arrive drawn'
      const slots = box.querySelectorAll('[data-font-slot]')
      if (slots.length !== 4) return slots.length + ' weight slot(s), expected four'
      // Plant a face in the field the way a finished upload would, then take it away again.
      held.value = JSON.stringify({ family: 'Tour Face', faces: [{ weight: 400, url: '/files/tour.woff2' }] })
      held.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      const remove = box.querySelector('[data-font-remove="400"]')
      if (!remove) return 'the 400 slot has no remove key'
      remove.click()
      await wait(60)
      const after = JSON.parse(held.value)
      if (after.faces.length !== 0) return 'Remove left ' + after.faces.length + ' face(s) in the value'
      // A family with no faces is no font at all, so the name goes with the last weight.
      if (after.family !== '') return 'the last face went and the family stayed: ' + after.family
      const name = box.querySelector('[data-font-family]').textContent.trim()
      if (!name) return 'the family line went blank instead of saying which font is in use'
      return 'ok (four slots, one planted, removed, family cleared with it)'
    })()`, 3000))
}
