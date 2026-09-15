// The library's own flows.
//
// ⚠️ THREE CONTROLS ON THIS SCREEN ARE NEVER PRESSED HERE. "Describe all with AI" posts to
// `/api/media/describe-missing`, which answers 200 at once and then loops a paid vision model
// over every undescribed picture in the background — the tour's instance has no key, so the
// route refuses, but a flow that presses it would fire for real on any instance that has one.
// "Delete all unused" and the per-tile delete take rows out of the seeded fixture, which the
// flows after them are counting. What IS driven: the tabs, the search, the sort, the ticks and
// the shift-range, and the picker's own shape.
import type { Tour } from './tour'
import { OPEN_DIALOG, SCREEN_FORMS } from './tour-ask'

export function registerMediaFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  // The whole library in the first response, and the two kinds that used to be a spinner.
  flow('admin: the library arrives finished, all three kinds of it', () => expect('/admin/media', `
    (() => {
      const screen = document.querySelector('[data-screen="media"]')
      if (!screen) return 'the library did not come from the server'
      if (document.documentElement.dataset.adminScreen !== 'media') return 'the page is not stamped'
      const tiles = document.querySelectorAll('[data-media]').length
      if (tiles < 10) return 'only ' + tiles + ' picture(s) in the first response'
      // The other two kinds are HIDDEN, not absent: switching to them fetches nothing.
      const panels = [...document.querySelectorAll('[data-media-panel]')]
      if (panels.length !== 3) return panels.length + ' panel(s), expected three'
      const shut = panels.filter((p) => p.hidden).length
      if (shut !== 2) return shut + ' of three panels are hidden, expected two'
      if (!document.querySelector('[data-media-panel="files"] [data-file]')) return 'the files tab arrived empty'
      return 'ok (' + tiles + ' picture(s), three kinds, one response)'
    })()`, 1200))

  // The same safety shape the newsletter and the assistant are held to: this screen deletes in
  // batches and spends money, and `ui/Button` emits a button with no type.
  flow('admin: nothing in the library is a form', () => expect('/admin/media', `
    (() => {
      ${SCREEN_FORMS}
      const forms = screenForms().length
      if (forms) return forms + ' form(s) on a screen that deletes in batches'
      const buttons = [...document.querySelectorAll('main button')]
      const untyped = buttons.filter((b) => b.getAttribute('type') !== 'button')
      if (untyped.length) return untyped.length + ' button(s) with no type: ' + untyped.map((b) => b.textContent.trim()).join(' | ')
      if (!buttons.length) return 'no buttons at all, so this flow proves nothing'
      for (const el of document.querySelectorAll('input[type=file]')) {
        if (el.closest('form')) return 'a file input sits inside a form'
      }
      return 'ok (' + buttons.length + ' buttons, 0 forms)'
    })()`, 1200))

  flow('admin: the library swaps kinds in a frame, and the address remembers which', () => expect('/admin/media', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const tab = (key) => document.querySelector('[data-media-tabs] [data-tab="' + key + '"]')
      const panel = (key) => document.querySelector('[data-media-panel="' + key + '"]')
      const tools = document.querySelector('[data-media-tools]')
      if (!tab('videos')) return 'no kind strip'
      if (tools.hidden) return 'the pictures tools are not on the sheet row to begin with'
      tab('videos').click(); await sleep(250)
      if (panel('videos').hidden) return 'the videos did not come forward'
      if (!panel('images').hidden) return 'the pictures stayed on screen'
      // A kind that is not on screen must not leave its tools in the visible row.
      if (!tools.hidden) return 'the pictures tools stayed on the row under another kind'
      if (new URL(location.href).searchParams.get('tab') !== 'videos') return 'the address forgot the kind'
      // The fixture seeds pictures and attachments but no video, so this asserts the SHAPE:
      // a player for each one there is, and the empty state when there are none. A flow that
      // demanded a player would be asserting the seed script rather than the screen.
      const players = document.querySelectorAll('[data-media-panel="videos"] video').length
      const rows = document.querySelectorAll('[data-media-panel="videos"] [data-file]').length
      if (players !== rows) return rows + ' video row(s) but ' + players + ' player(s)'
      const blank = document.querySelector('[data-video-empty]')
      if (rows === 0 && blank.hidden) return 'no videos and nothing saying so'
      if (rows > 0 && !blank.hidden) return 'videos on screen and the empty state showing too'
      tab('images').click(); await sleep(250)
      if (new URL(location.href).searchParams.get('tab')) return 'going back to pictures left the address dirty'
      if (tools.hidden) return 'the tools did not come back with the pictures'
      return 'ok (one kind on screen, the address and the server agree on which, ' + players + ' player(s))'
    })()`, 1500))

  flow('admin: the library narrows by name and sorts without asking the server', () => expect('/admin/media', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const seen = () => [...document.querySelectorAll('[data-media]')].filter((el) => !el.hidden)
      const all = seen().length
      if (all < 10) return 'only ' + all + ' picture(s) to work with'
      const first = seen()[0].dataset.name
      const stem = first.split(/[-.]/)[0]
      const find = document.querySelector('[data-media-find]')
      find.value = stem
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(250)
      const narrowed = seen().length
      if (narrowed === 0) return 'searching its own first name matched nothing'
      if (narrowed >= all) return 'the search narrowed nothing (' + narrowed + ' of ' + all + ')'
      // HIDDEN, not removed: the whole library is still in the page, which is the point.
      if (document.querySelectorAll('[data-media]').length !== all) return 'narrowing removed tiles from the page'
      find.value = ''
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(250)
      if (seen().length !== all) return 'clearing the search did not bring them all back'
      const sort = document.querySelector('[data-media-sort]')
      sort.value = 'name'
      sort.dispatchEvent(new Event('change', { bubbles: true })); await sleep(250)
      const names = seen().map((el) => el.dataset.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b))
      if (names.join('|') !== sorted.join('|')) return 'sorting by name did not order them by name'
      if (seen().length !== all) return 'sorting lost ' + (all - seen().length) + ' tile(s)'
      return 'ok (' + narrowed + ' of ' + all + ' matched, then ordered by name)'
    })()`, 1500))

  // Shift-click takes a RUN, and a run only ever turns boxes ON: a modifier that sometimes
  // clears is a modifier nobody trusts. Nothing is deleted — the bar is raised and dropped.
  flow('admin: ticking a picture raises the delete keys, and shift takes a run', () => expect('/admin/media', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const boxes = [...document.querySelectorAll('[data-media] input[data-pick]')]
      if (boxes.length < 5) return 'only ' + boxes.length + ' picture(s) to tick'
      const count = document.querySelector('[data-media-picked]')
      const del = document.querySelector('[data-media-del-picked]')
      const clear = document.querySelector('[data-media-clear]')
      if (!del.hidden === false && !clear.hidden === false) { /* both start hidden */ }
      if (!del.hidden || !clear.hidden) return 'the delete keys are up before anything is ticked'
      boxes[0].click(); await sleep(150)
      if (del.hidden) return 'ticking one picture did not raise the delete key'
      if (count.textContent !== '1') return 'the key counts ' + count.textContent + ' after one tick'
      const tile = boxes[0].closest('[data-media]')
      if (tile.dataset.on === undefined) return 'the ticked picture is not marked as chosen'
      // Shift to the fifth: the run is inclusive at both ends.
      boxes[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
      await sleep(200)
      if (count.textContent !== '5') return 'a shift-run of five counted ' + count.textContent
      clear.click(); await sleep(150)
      if (!del.hidden) return 'Clear left the delete key up'
      if (boxes.filter((b) => b.checked).length) return 'Clear left a box ticked'
      return 'ok (one, then a run of five, then none)'
    })()`, 1500))

  /**
   * The picker, which is not on this screen at all.
   *
   * It is an overlay island lent to whoever asks through `quire:pick-media` (ADR 0054), so the
   * flow asks the way the editor asks and reads what comes back. It also asserts the three
   * things the React picker never had: a dialog role, Escape, and focus put back.
   */
  flow('admin: asking for a picture opens a real dialog, and Escape answers nothing', () => expect('/admin/media', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const mark = document.querySelector('[data-media-find]') || document.querySelector('main button')
      mark.focus()
      let answered = 'never'
      const heard = !window.dispatchEvent(new CustomEvent('quire:pick-media', {
        cancelable: true,
        detail: {
          multi: false,
          words: { title: 'Pick', titleMulti: 'Pick many', hintMulti: 'hint', add: 'Add',
                   close: 'Close', loadFailed: 'failed', copyUrl: 'Copy', download: 'Download',
                   delete: 'Delete', unusedBadge: 'Unused' },
          respond: (a) => { answered = a === null ? 'closed' : JSON.stringify(a) },
        },
      }))
      if (!heard) return 'nobody is listening for quire:pick-media'
      ${OPEN_DIALOG}
      for (let i = 0; i < 40 && !openDialog(); i++) await sleep(100)
      const dialog = openDialog()
      if (!dialog) return 'the ask was heard and no picker opened'
      if (dialog.getAttribute('aria-modal') !== 'true') return 'the picker is not a modal'
      for (let i = 0; i < 40 && !dialog.querySelector('[data-media]'); i++) await sleep(100)
      const tiles = dialog.querySelectorAll('[data-media]').length
      if (tiles < 10) return 'the picker drew ' + tiles + ' picture(s)'
      // Single-select has no ticks: the picture IS the control.
      if (dialog.querySelector('input[data-pick]')) return 'a single-pick picker drew ticks'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(300)
      if (openDialog()) return 'Escape did not close the picker'
      if (answered !== 'closed') return 'Escape answered ' + answered + ' instead of nothing'
      if (document.activeElement !== mark) return 'the picker did not put the focus back'
      return 'ok (' + tiles + ' picture(s), modal, Escape, focus restored)'
    })()`, 2500))

  flow('admin: choosing a picture hands back its address and its description', () => expect('/admin/media', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      let got = null
      window.dispatchEvent(new CustomEvent('quire:pick-media', {
        cancelable: true,
        detail: {
          multi: false,
          words: { title: 'Pick', titleMulti: 'Pick many', hintMulti: 'hint', add: 'Add',
                   close: 'Close', loadFailed: 'failed', copyUrl: 'Copy', download: 'Download',
                   delete: 'Delete', unusedBadge: 'Unused' },
          respond: (a) => { got = a },
        },
      }))
      ${OPEN_DIALOG}
      const dialog = await (async () => {
        for (let i = 0; i < 40; i++) {
          const d = openDialog()
          if (d && d.querySelector('[data-media]')) return d
          await sleep(100)
        }
        return null
      })()
      if (!dialog) return 'the picker never drew anything'
      const tile = dialog.querySelector('[data-media]')
      const url = tile.dataset.media
      tile.querySelector('[data-open]').click()
      await sleep(300)
      if (openDialog()) return 'choosing a picture left the picker open'
      if (!got || got.url !== url) return 'the picker answered ' + JSON.stringify(got)
      return 'ok (' + got.url + (got.alt ? ', described' : ', no description') + ')'
    })()`, 2500))
}
