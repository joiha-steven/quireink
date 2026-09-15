// Settings → Account: you, and this admin.
//
// ADR 0041 put two things here that had nowhere else to be: how the OWNER signs in, which used
// to sit under System beside the cache and the importer, and the handful of preferences that
// describe this TOOL rather than the blog — the dashboard's footer line, the activity log, the
// editor's chrome, motion, the key sounds, the autosave interval. Those last were on Appearance,
// a tab about what READERS see, so an owner turning off a sound they alone hear was changing a
// setting filed under their site's looks.
//
// ⚠️ THIS FILE DRAWS MARKUP AND NOTHING ELSE (ADR 0054). The security card's controls each
// commit something irreversible — a password changed, a set of recovery codes replaced, a
// second factor re-enrolled, a device signed out — and every one of them is INERT here: a
// `type="button"` with a hook on it and no behaviour behind it. There is no `<form>` on this
// screen, and on this card that is load-bearing rather than tidy: a form would let Return in
// the password box post a password change.
//
// ⚠️ NO SETTINGS KEY ON THE SECURITY CARD. `data-k` is what puts a control in the sheet's diff
// and in the payload its one Save sends; a password, a one-time code and a recovery list are
// none of the sheet's business. Those controls carry `data-sec-*` instead, which the form's
// reader does not look at.
//
// ⚠️ NO SECRET IS WRITTEN HERE. The recovery codes, the TOTP secret and the session list all
// come from `GET /api/security`, which the page has not called at render time — so the count
// ships at zero, the secret box and the device list ship EMPTY, and the island fills them.
// Nothing on this screen reads a secret out of the server view, and there is no server view
// that would hand one over.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL, buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { group, panelCard, settingRow, switchRow, textField } from '@/web/admin/fields'
import { PANEL, connectionCard, panelList } from '@/web/admin/fields-box'
import { pick, slider } from '@/web/admin/fields-pick'
import { gate } from '@/web/admin/fields-pic'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/** The row every toggle in this card's lists wears: `PANEL_LIST` draws the rule, the row the pad. */

/**
 * A PASSWORD BOX, WRITTEN OUT RATHER THAN ASKED FOR.
 *
 * `textField` is the primitive for a text input and it exists to carry a key: every field it
 * draws gets `data-k`, which is exactly what a password must not have. So this one is typed,
 * from `CONTROL` — the same chrome, so `check:admin-kit` still sees one answer to what a field
 * looks like — and the only thing it does differently is store nothing.
 *
 * `aria-label`, because the label above is a SIBLING and a sibling names nothing. On a password
 * box that matters more than most: nothing else on screen says which of the two it is.
 */
const passwordBox = (f: { label: string; hook: string; autocomplete: string }): string =>
  `<input type="password" autocomplete="${escapeAttr(f.autocomplete)}"`
  + ` aria-label="${escapeAttr(f.label)}" ${f.hook} class="${CONTROL} w-full max-w-sm">`

/**
 * ONE SIGNED-IN DEVICE, as a `<template>` the island clones.
 *
 * The list is empty at render — the server writing this page has not asked `/api/security` who
 * is signed in — and the alternative to a template is an island that builds a row out of a
 * string of HTML. `fields-pic.ts` states the rule this follows: nothing in the vocabulary
 * builds a row, because a row built in JavaScript is a second copy of the markup that drifts
 * from this one in silence. It also keeps every WORD on the server, where the locales are.
 *
 * Both faces of the two things that vary ship drawn, as everywhere else: the device's own name
 * is the box's text and "Unknown device" is what stands there until the island overwrites it,
 * and the sign-out key holds both its labels with one hidden.
 */
function sessionRow(t: AdminStrings): string {
  return `<template data-sec-session-row>`
    + `<li class="flex flex-wrap items-center justify-between gap-3 py-2" data-security-session>`
    + `<span class="min-w-0">`
    + `<span class="block text-sm text-neutral-700 dark:text-neutral-300">`
    + `<span data-sec-device>${escapeHtml(t.securityUnknownDevice)}</span>`
    + `<span class="ml-2 text-xs text-neutral-500 dark:text-neutral-400" data-sec-this hidden>`
    + `${escapeHtml(t.securityThisDevice)}</span></span>`
    + `<span class="block text-xs text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.securityLastSeen)} <span data-sec-seen></span></span></span>`
    + `<button type="button" data-sec-end class="${buttonClass('secondary')}">`
    + `<span data-sec-end-other>${escapeHtml(t.securitySignOut)}</span>`
    + `<span data-sec-end-this hidden>${escapeHtml(t.securitySignOutThis)}</span>`
    + `</button></li></template>`
}

/**
 * The account: the password, the second factor, the recovery codes, and every device signed in.
 *
 * The shape is one confirm field at the top and the actions under it, and that is the argument
 * the card makes rather than a layout: the threat these controls answer is somebody else
 * already holding a session, so one place to type the password says out loud that the session
 * alone is not enough. Ending a session asks for nothing, because it only ever removes access.
 *
 * EVERY ACTION SHIPS DISABLED, which is what React's first render also drew (`!current` is true
 * with the box empty) and is the right state for a page whose island has not started: a key
 * that is live before anything is wired is a key that does nothing when pressed.
 */
function security(t: AdminStrings): string {
  return `<div class="${SETTING_GAP}">`
    + settingRow({
      label: t.securityConfirm, note: t.securityConfirmHint,
      control: passwordBox({
        label: t.securityConfirm, hook: 'data-security-current', autocomplete: 'current-password',
      }),
    })
    + settingRow({
      label: t.securityNewPassword,
      control: `<div class="flex flex-wrap items-center gap-2">`
        + passwordBox({ label: t.securityNewPassword, hook: 'data-sec-new', autocomplete: 'new-password' })
        + `<button type="button" data-sec-change disabled class="${buttonClass('secondary')}">`
        + `${escapeHtml(t.securityChangePassword)}</button></div>`
        // Said BEFORE the key is pressed, because it is the surprising half and it is the half
        // somebody doing this actually wants.
        + `<p class="${NOTE_TEXT} mt-1.5">${escapeHtml(t.securityPasswordSignsOut)}</p>`,
    })
    // THE COUNT SHIPS AT ZERO and the sentence carries its own template. React rendered
    // `recoveryLeft ?? 0` on its first pass too; what is different here is that the island has
    // no locale dictionary to rebuild the sentence from, so the raw `{n}` string rides along in
    // `data-tpl` and the island substitutes into it.
    + settingRow({
      label: t.securityRecovery,
      noteHtml: `<span data-sec-recovery-note data-tpl="${escapeAttr(t.securityRecoveryHint)}">`
        + `${escapeHtml(t.securityRecoveryHint.replace('{n}', '0'))}</span>`,
      inline: true,
      control: `<button type="button" data-sec-recovery disabled class="${buttonClass('secondary')}">`
        + `${escapeHtml(t.securityNewCodes)}</button>`,
    })
    // Shown once and never again: minting replaces the old set, so the list the island writes
    // in here is the only copy that will ever exist. It ships EMPTY and hidden — a code in this
    // markup would be a code in the page source of every account screen ever opened.
    + gate(false,
      `<p class="${NOTE_TEXT}">${escapeHtml(t.securityCodesOnce)}</p>`
      + `<ul class="mt-2 grid gap-1 font-mono text-sm sm:grid-cols-2" data-security-codes></ul>`,
      `class="${PANEL}" data-sec-codes-panel`)
    // ON and OFF in ONE wrapper. Two sentences loose in the note would be two children of the
    // note's box, and a stack that hides one of a pair hands the other a margin it never had
    // (`docs/admin-one-dom.md` trap 4). OFF is what ships visible, because that is what React
    // drew before `/api/security` answered.
    + settingRow({
      label: t.securityTotp,
      noteHtml: `<span data-sec-totp-state>`
        + `<span data-sec-totp-on hidden>${escapeHtml(t.securityTotpOn)}</span>`
        + `<span data-sec-totp-off>${escapeHtml(t.securityTotpOff)}</span></span>`,
      inline: true,
      control: `<button type="button" data-sec-reenrol disabled class="${buttonClass('secondary')}">`
        + `${escapeHtml(t.securityReenrol)}</button>`,
    })
    // The enrolment panel, and the `<code>` in it is EMPTY on purpose: the secret arrives from
    // `/api/security/totp/start` and never from this render.
    + gate(false,
      `<p class="${NOTE_TEXT}">${escapeHtml(t.securityScanHint)}</p>`
      + `<code class="mt-2 block break-all font-mono text-xs" data-sec-secret></code>`
      + `<div class="mt-3 flex flex-wrap items-center gap-2">`
      + `<input inputmode="numeric" autocomplete="one-time-code" placeholder="000000" data-sec-otp`
      + ` class="${CONTROL} w-32 text-center font-mono tabular-nums">`
      + `<button type="button" data-sec-otp-confirm disabled class="${buttonClass()}">`
      + `${escapeHtml(t.securityConfirmCode)}</button>`
      + `<button type="button" data-sec-otp-close class="${buttonClass('secondary')}">`
      + `${escapeHtml(t.close)}</button></div>`,
      `class="${PANEL}" data-sec-enrol`)
    // EMPTY, with the row's shape beside it in a template. "Sign out everywhere else" appeared
    // at two sessions or more in React, so it ships hidden rather than absent — and hidden is
    // the honest state, because at render time the page knows of no sessions at all.
    + settingRow({
      label: t.securitySessions, note: t.securitySessionsHint,
      control: `<ul class="divide-y divide-neutral-100 dark:divide-neutral-800" data-sec-sessions></ul>`
        + sessionRow(t)
        + `<button type="button" data-sec-signout-others hidden`
        + ` class="${buttonClass('secondary', 'md', 'mt-3')}">`
        + `${escapeHtml(t.securitySignOutOthers)}</button>`,
    })
    + `</div>`
}

/**
 * Rendering and behaviour: font smoothing, the motion engine, the key sounds and the pen's
 * squeak, and how often the editor keeps a local copy of what you are typing.
 *
 * ⚠️ THE SOUND IS THE ISLAND'S. Picking an instrument plays it and dragging the volume plays a
 * key, because three names on a page mean nothing — the difference between these is a
 * difference you hear or it does not exist. None of that is drawn: this file writes the select
 * and the slider, and `data-k="motion.keys"` / `data-k="motion.keyVolume"` are the only handles
 * the island needs to find them.
 *
 * ⚠️ THE VOLUME AND THE SQUEAK STAY VISIBLE WITH THE INSTRUMENT OFF, and that was the decision
 * rather than an oversight: a row that vanishes takes the knowledge that it exists with it, and
 * somebody who turned the sound off last month would have no way left to learn there was ever a
 * volume. So they are DISABLED, not gated — which the vocabulary had no word for, since
 * `data-gate-when` hides. `data-disable-when` disables one control; `data-dim-when` on a row
 * dims the row and disables what is inside it, which is how a ToggleRow greys as ONE thing.
 */
function rendering(t: AdminStrings, s: SiteSettings): string {
  const m = s.motion
  const quiet = m.keys === 'off'
  const when = 'data-disable-when="motion.keys=off"'
  return panelList(
    switchRow({
      k: 'typography.smoothing', label: t.fontSmoothing, note: t.fontSmoothingDesc,
      on: s.typography.smoothing, 
    })
    + switchRow({
      k: 'motion.enabled', label: t.motionLabel, note: t.motionDesc,
      on: m.enabled, 
    })
    // A CHOICE, not a switch, since 2026-08-24: three instruments and silence. It sits in the
    // row's own padding for the same reason the autosave field below does — every other child
    // of this list is a switch row, which carries `p-4` on the row itself, and the divider is
    // drawn BETWEEN children, so the padding has to be on the child.
    + `<div class="p-4">`
    + pick({
      k: 'motion.keys', label: t.keyFeedbackLabel, note: t.keyFeedbackDesc, inline: true,
      width: 'medium', value: m.keys,
      options: [
        ['off', t.keyFeedbackOff], ['woody', t.keyFeedbackWoody],
        ['crisp', t.keyFeedbackCrisp], ['deep', t.keyFeedbackDeep],
      ],
      attrs: `aria-label="${escapeAttr(t.keyFeedbackLabel)}"`,
    })
    + `</div><div class="p-4">`
    + settingRow({
      label: t.keyVolumeLabel, note: t.keyVolumeDesc, inline: true,
      control: `<div class="flex flex-wrap items-center gap-x-4 gap-y-3">`
        + slider({
          k: 'motion.keyVolume', value: m.keyVolume, min: 0, max: 100, step: 5,
          readout: true, unit: '%', attrs: `${when}${quiet ? ' disabled' : ''}`,
        })
        // The key is not a convenience. The drag DOES play a key — measured at 0.61 of full
        // scale on the deployed build — and the owner still reported silence, because one 40ms
        // tick at most every 110ms is a sound you have to already be listening for. Six keys
        // and a space is a sound nobody can miss.
        + `<button type="button" data-sound-hear ${when}${quiet ? ' disabled' : ''}`
        + ` class="${buttonClass('secondary', 'sm')}">${escapeHtml(t.keyHear)}</button></div>`,
    })
    + `</div>`
    // The pen's squeak (ADR 0049) rides the instrument and the slider above rather than adding
    // a second volume: one answer about sound.
    + switchRow({
      k: 'motion.penSqueak', label: t.penSqueakLabel, note: t.penSqueakDesc,
      on: m.penSqueak, disabled: quiet,
      // Dimmed rather than hidden: a switch whose engine is off has to look unavailable rather
      // than off, or the owner flips it, sees it flip back, and concludes the admin is broken.
      attrs: 'data-dim-when="motion.keys=off"',
    })
    // The floor is 15s and the sanitiser enforces it too, not only this field: the editor also
    // flushes on hide, on leave and on unmount, and those are what make a long interval safe.
    + `<div class="p-4">`
    + textField({
      k: 'autosaveSeconds', label: t.autosaveLabel, note: t.autosaveHint, type: 'number',
      value: s.autosaveSeconds, attrs: 'min="15" max="600" step="15"',
    })
    + `</div>`,
  )
}

/** The preferences that describe this TOOL: the dashboard's foot, its record, and its chrome. */
function thisAdmin(t: AdminStrings, s: SiteSettings): string {
  return group({
    title: t.dashboardTitle, first: true,
    body: panelList(switchRow({
      k: 'dashboard.systemLine', label: t.dashboardSystemLine,
      note: t.dashboardSystemLineDesc.replace('{tab}', t.tabServer),
      on: s.dashboard.systemLine, 
    })),
  })
    // THE ADMIN'S OWN RECORD, filed under Reading and then System before this. It records what
    // the OWNER did — saves, uploads, deletes — which is neither a reader feature nor a fact
    // about the install: it is a fact about this person using this tool.
    + group({
      title: t.cardActivity,
      body: panelList(
        switchRow({
          k: 'features.activityLog', label: t.featActivityLog, note: t.featActivityLogDesc,
          on: s.features.activityLog, 
        })
        + switchRow({
          k: 'features.transferStats', label: t.featTransferStats, note: t.featTransferStatsDesc,
          on: s.features.transferStats, 
        }),
      ),
    })
    + group({ title: t.cardRendering, body: rendering(t, s) })
}

/**
 * The tab.
 *
 * The security card is FIRST, because it is the one card here somebody opens in a hurry — a
 * laptop is gone and they want the session ended now.
 *
 * It is a plain `panelCard` and not a `connectionCard`: it is made of ACTIONS that each commit
 * when pressed, so it has no key of its own and nothing for a Save to do. The preferences
 * beside it are ordinary settings keys, so that one is a `connectionCard` and names them.
 *
 * ⚠️ THE LAMP SHIPS GREEN. Nothing is dirty in a document that has just been written, the
 * thing this card configures is this admin and this admin is plainly on, so `good` is what the
 * server can see — and `connectionCard`'s own rule, that AMBER BEATS GREEN the moment there
 * are unsaved edits, is the island's to apply from there.
 */
export function accountTab(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${GRID}">`
    + `<div class="${COL}">`
    // ⚠️ THE SERVER'S REFUSALS, IN WORDS, RIDING ON THE CARD. The island has no dictionary —
    // every string in the admin lives in `locales/` — so it reads the sentence for a refusal
    // off the element it is standing on, by the code the route sent. Without these the card
    // still refuses correctly and says "Could not save" while doing it, which on this card is
    // the difference between "you typed the wrong password" and "something is broken". React
    // had the sentences inline; this is where they live now.
    //
    // ⚠️ SIX, NOT THREE. `auth/password.ts` refuses a weak new password with `too-short`,
    // `too-common` or `contains-name`, and until 2026-09-15 none of the three was carried here:
    // the strength rule still held, and the only thing the owner was told was "Save failed",
    // which reads as a broken server rather than as a password to change.
    + panelCard({
      title: t.securityTitle,
      body: security(t),
      attrs: `data-say-wrong-password="${escapeAttr(t.securityWrongPassword)}"`
        + ` data-say-too-many-attempts="${escapeAttr(t.securityTooMany)}"`
        + ` data-say-bad-code="${escapeAttr(t.securityBadCode)}"`
        + ` data-say-too-short="${escapeAttr(t.pwTooShort)}"`
        + ` data-say-too-common="${escapeAttr(t.pwTooCommon)}"`
        + ` data-say-contains-name="${escapeAttr(t.pwContainsName)}"`,
    })
    + `</div><div class="${COL}">`
    + connectionCard({
      title: t.cardThisAdmin,
      // The five TOP-LEVEL keys this card owns, which is the granularity `changedIn` asked
      // about in React: `PUT /api/settings` merges, so a card save sends these five objects
      // and leaves the other tabs' keys alone.
      keys: ['dashboard', 'features', 'motion', 'autosaveSeconds', 'typography'],
      state: 'good', lampTitle: t.connectionOk, saveLabel: t.save,
      body: thisAdmin(t, s),
    })
    + `</div></div>`
}
