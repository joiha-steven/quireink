// SNIPPETS EVERY FLOW CAN PASTE INTO ITS OWN BODY.
//
// A flow body is a template literal evaluated in the page, so anything shared between flows has
// to be a STRING interpolated into them rather than a function they call. These are the ones
// more than one file needs.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS in here, for the same reason as in the flow files: this
// is interpolated into a template literal, a backtick closes it and a backslash is eaten before
// the browser sees it.

/**
 * THE DIALOG THAT IS ACTUALLY ON SCREEN — and the reason this file exists.
 *
 * ⚠️ EVERY OVERLAY IS IN EVERY ADMIN PAGE NOW, DRAWN AND HIDDEN (ADR 0054 step 6,
 * `docs/admin-one-dom.md`). The confirm box, the shortcut sheet, the palette and the what's-new
 * panel used to be mounted by React the moment something opened them, so
 * `document.querySelector('[role=dialog]')` could only ever find the one that was open. The
 * server draws all four on every page now, so that same line finds the FIRST one in the
 * document — the confirm box — whatever is on screen.
 *
 * Ten flows went red on the same day for this one reason, and one went WORSE than red: "staying
 * keeps an unsaved settings change" kept passing while reaching into the hidden confirm box,
 * because clicking a hidden button does nothing and the page it then failed to leave is the page
 * the flow wanted to still be on. A guard that passes by not working is the kind this repo has
 * paid for before.
 *
 * `checkVisibility()` and not `:not([hidden])`: only the confirm box carries `hidden` itself, and
 * the other three are hidden by the SCRIM around them. Not `offsetParent` either — these are all
 * `position: fixed`, so it is null whether they are shown or not.
 */
export const OPEN_DIALOG = `
      const openDialogs = () => [...document.querySelectorAll('[role=dialog]')]
        .filter((d) => d.checkVisibility())
      const openDialog = () => openDialogs()[0] || null
`

/**
 * EVERY `<form>` ON THE PAGE THAT IS THE SCREEN'S OWN.
 *
 * The rule these flows hold is that a screen which deletes in batches, spends money or changes a
 * password may not put its controls in a form, because a stray Return then submits it. The
 * confirm dialog's typed-name box IS a form, deliberately — Return submitting is the one thing
 * `window.prompt` did right — and it is on every admin page, hidden, behind a question that has
 * to be asked first. Named here with its reason rather than scoped away with `main`, so a form
 * arriving anywhere else still turns the flow red.
 */
export const SCREEN_FORMS = `
      const screenForms = () => document.querySelectorAll('form:not([data-confirm-form])')
`
