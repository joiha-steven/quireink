// Settings → Comments & mail: how readers answer back, and how mail leaves this machine.
//
// ADR 0041, and this tab is the clearest case that ADR makes. "How do readers sign in to
// comment?" used to be answered in two places three tabs apart: the switch that enables comments
// was on Reading, and the Google and Turnstile keys that decide how a commenter proves they are
// a person were on Connections. That is how `googleAuth` ran switched on for weeks with no
// credentials behind it and nothing on either screen saying so.
//
// ADR 0054: the server draws it. All three cards REACH something the sheet's one Save key cannot
// — a provider that can be asked whether a key is good, a mail host that can be asked whether
// mail leaves — so all three are `connectionCard`s and each keeps a key of its own. The ordinary
// settings keys on them (`comments.*`) still ride the sheet's Save as well, which is ADR 0041 as
// revised on 2026-09-07.
//
// ⚠️ NO SECRET IS WRITTEN HERE, AND EVERY CREDENTIAL FIELD IS WRITE-TO-SET. A stored credential
// never comes back from the server — `getIntegrationStatus()` turns each one into a boolean — so
// the field ships EMPTY with a placeholder saying one is stored, and only a field somebody has
// typed into is sent. Blank means KEEP: anything else silently wipes a working key the first
// time the panel is saved to change something else (`useSecretKeys.ts` carries the same rule for
// the three React panels that are still to be converted).
//
// ⚠️ NO `data-k` ON A CREDENTIAL OR ON THE SMTP FORM. `data-k` is what puts a control into the
// sheet's diff and into the payload its Save sends, and neither of these is in the site record:
// the keys go to `/api/comments/keys` and the mail host to `/api/mail`. They carry
// `data-card-field` instead — the name the card's own save reads — which `settings-form.ts` does
// not look at.
//
// ⚠️ THE MAIL CARD SHIPS EMPTY AND THE ISLAND FILLS IT. `settingsView()` does not read the SMTP
// configuration — the React card fetched `/api/mail` on mount and this conversion does not
// change where the fact comes from — so both faces are in the markup, the waiting line showing
// and the form hidden, the way the security card's device list is drawn on the Account tab.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { CommentEnv } from '@/comments/comment-env'
import type { CommentSettings, SiteSettings } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { NOTE, NOTE_TEXT } from '@/admin-shared/scale'
import { settingRow, switchList, switchRow, textControl } from '@/web/admin/fields'
import { INSET, connectionCard } from '@/web/admin/fields-box'
import { checkField } from '@/web/admin/fields-pick'
import { gate } from '@/web/admin/fields-pic'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/** What this tab needs that is not a setting. */
export type PeopleTabView = {
  /**
   * WHICH COMMENT CREDENTIALS ARE STORED, as booleans — the same object the React tab was
   * handed, straight off `settingsView()`. `turnstileSiteKey` is a PUBLIC value (it renders in
   * the widget) and even that is only ever read here as "is there one", because a field that
   * arrives holding a value is a field a save can wipe.
   */
  commentEnv: CommentEnv
}

/** Where the owner gets each integration's keys. */
const LINKS = {
  turnstile: 'https://dash.cloudflare.com/?to=/:account/turnstile',
  google: 'https://console.cloud.google.com/apis/credentials',
}

/** One integration's name, its help line, and the key that opens its setup page. */
function help(title: string, text: string, href: string, open: string): string {
  return `<div><p class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(title)}</p><p class="${NOTE}">${escapeHtml(text)} `
    + `<a href="${escapeAttr(href)}" target="_blank" rel="noopener"`
    + ` class="font-medium underline hover:text-neutral-900 dark:hover:text-white">`
    + `${escapeHtml(open)}</a></p></div>`
}

/**
 * A CREDENTIAL FIELD: a real label, an EMPTY box, and a placeholder that says whether one is
 * already stored.
 *
 * `textControl` and not `textField`, and the difference is the whole point of the field: every
 * field `textField` draws carries `data-k`, which is exactly what a secret must not have. What
 * it stores goes to the card's own endpoint, so it carries `data-card-field` — the name it takes in
 * that POST body — and the island sends it only when it is not empty.
 *
 * The placeholder says "saved" rather than standing in for the label. Nine credential fields
 * used the placeholder AS their label until 2026-09-07, which is the one thing a placeholder
 * cannot be: it disappears the moment somebody types, so the field they are typing into stops
 * saying what it is, and a screen reader never had the name at all.
 */
function secret(f: {
  name: string; label: string; stored: boolean; kept: string; password?: boolean
}): string {
  const id = `f-key-${f.name}`
  return settingRow({
    label: f.label,
    forId: id,
    control: textControl({
      value: '',
      type: f.password ? 'password' : 'text',
      placeholder: f.stored ? f.kept : '',
      attrs: `id="${escapeAttr(id)}" data-card-field="${escapeAttr(f.name)}"`,
    }),
  })
}

/**
 * Cloudflare's two keys. The SITE key is public; the SECRET is what verification runs on.
 *
 * The block's own `space-y-2` rides on the GATE around it rather than on a box inside it: a
 * wrapper whose only job is to be hidden is a node React did not draw.
 */
const turnstileKeys = (t: AdminStrings, env: CommentEnv): string =>
  help(t.commentsTurnstile, t.commentsTurnstileHelp, LINKS.turnstile, t.commentsHelpOpen)
  + secret({
    name: 'turnstileSiteKey', label: t.commentsKeySite, kept: t.commentsKeySet,
    stored: Boolean(env.turnstileSiteKey),
  })
  + secret({
    name: 'turnstileSecretKey', label: t.commentsKeySecret, kept: t.commentsKeySet,
    stored: env.turnstileConfigured, password: true,
  })

/**
 * Google's pair, and the exact string Google demands above them.
 *
 * ⚠️ THE ORIGIN IS THE BROWSER'S, NOT A SETTING, and that is deliberate: a typo here fails the
 * flow AFTER the reader has left, on an error page on Google's side that names no cause. React
 * read `location.origin`; the server has no origin to read, so the PATH ships and the island
 * writes the whole address into `data-origin-path`.
 */
const googleKeys = (t: AdminStrings, env: CommentEnv): string =>
  help(t.commentsGoogleAuth, t.commentsGoogleHelp, LINKS.google, t.commentsHelpOpen)
  + `<p class="${NOTE_TEXT}">${escapeHtml(t.commentsGoogleRedirect)}`
  + `<code class="ml-2 select-all rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-700`
  + ` dark:bg-neutral-800 dark:text-neutral-200" data-origin-path>`
  + `/comment-auth/google/callback</code></p>`
  + secret({
    name: 'googleClientId', label: t.commentsKeyGoogleId, kept: t.commentsKeySet,
    stored: env.googleConfigured,
  })
  + secret({
    name: 'googleClientSecret', label: t.commentsKeyGoogleSecret, kept: t.commentsKeySet,
    stored: env.googleConfigured, password: true,
  })

/**
 * THE CARD THAT MIXES TWO STORES, and the reason ADR 0041 says a mixed card rather than a mixed
 * tab.
 *
 * Two of these controls are ordinary settings keys (`comments.turnstile`, `comments.googleAuth`,
 * in the site record) and four are secrets that never come back from the server. They are ONE
 * question — how a commenter proves they are a person — so they are one card, and its single
 * Save writes both: the two flags through `PUT /api/settings`, then the typed keys through
 * `/api/comments/keys`. THE FLAGS FIRST. A key stored against a switch that did not save leaves
 * the owner looking at a configured service that is off, with nothing saying which half failed.
 *
 * ⚠️ `flex flex-col gap-4` AND NOT `space-y-4`. The inset is the last child and it is gated, and
 * Tailwind v4 writes `space-y` as `& > :not(:last-child)` — which counts the hidden node, so the
 * list of switches would keep a 16px margin under it whenever both toggles are off
 * (`docs/admin-one-dom.md`, trap 5). A `display:none` child is not a flex item at all, so a gap
 * closes where a margin would not.
 */
function commentKeys(t: AdminStrings, c: CommentSettings, env: CommentEnv): string {
  // Which gate is actually standing, said plainly. The owner's rule, 2026-08-27: whoever enters
  // a Turnstile key gets Turnstile, everybody else gets the blog's own gate — and this line is
  // where they find out which one that is.
  //
  // BOTH SENTENCES SHIP, in ONE wrapper, and one of them is hidden (trap 5). The island has only
  // the switch to read, so it can pick between them only while a Turnstile secret is STORED;
  // with none stored the stamp is the answer whatever the switch says, and the pair ships static
  // rather than wearing a hook that would light the wrong sentence on the first click.
  const standing = c.turnstile && env.turnstileConfigured
  const hook = env.turnstileConfigured
  const gateLine = `<div>`
    + gate(standing, escapeHtml(t.commentsGateTurnstile),
      `class="${NOTE}"${hook ? ' data-gate="comments.turnstile"' : ''}`)
    + gate(!standing, escapeHtml(t.commentsGateStamp),
      `class="${NOTE}"${hook ? ' data-gate-not="comments.turnstile=1"' : ''}`)
    + `</div>`

  /**
   * A toggle that is on with no key behind it does nothing, and says so beside its name.
   *
   * ⚠️ IT SHIPS IN THE STATE THE SERVER COULD SEE AND NOTHING MOVES IT. `settingRow` takes the
   * badge as a STRING, so there is no node for the island to unhide — flipping the switch cannot
   * raise or drop the badge until `head()` in `fields.ts` grows an attribute hook for it. The
   * badge is therefore right about what was SAVED, which is what this page was drawn from.
   */
  const needsKey = (on: boolean, configured: boolean): string | undefined =>
    on && !configured ? t.commentsNeedsKey : undefined

  return `<div class="flex flex-col gap-4">`
    + gateLine
    + switchList([
      switchRow({
        k: 'comments.turnstile', label: t.commentsTurnstile, note: t.commentsTurnstileDesc,
        on: c.turnstile, badge: needsKey(c.turnstile, env.turnstileConfigured),
      }),
      switchRow({
        k: 'comments.googleAuth', label: t.commentsGoogleAuth, note: t.commentsAuthDesc,
        on: c.googleAuth, badge: needsKey(c.googleAuth, env.googleConfigured),
      }),
    ])
    // Shown whatever the MASTER switch says. This tab is where the site's credentials live, and
    // hiding them behind a toggle two tabs away is how they get lost.
    //
    // ⚠️ `data-gate-any` IS NOT IN THE VOCABULARY YET. `applyGates` can ask whether one key is
    // on (`data-gate`), whether it holds a value (`data-gate-when`) or whether it does not
    // (`data-gate-not`); it has no "either of these", which is the question this box asks — an
    // inset with both blocks hidden inside it is an empty bordered box. Until
    // `settings-controls.ts` learns it, the box is right about what was saved and the two blocks
    // inside it move on their own.
    + gate(c.turnstile || c.googleAuth,
      gate(c.turnstile, turnstileKeys(t, env),
        'class="space-y-2" data-gate="comments.turnstile"')
      + gate(c.googleAuth, googleKeys(t, env),
        'class="space-y-2" data-gate="comments.googleAuth"'),
      `class="${INSET} flex flex-col gap-3"`
      + ` data-gate-any="comments.turnstile comments.googleAuth"`)
    + `</div>`
}

/**
 * ONE SMTP FIELD. Keyless, like the credentials above: a mail host is not a settings key, it is
 * a field of `POST /api/mail`, so it carries `data-card-field` and stays out of the sheet's diff.
 *
 * Every one of them ships EMPTY. The server has not asked `/api/mail` what is stored, and the
 * password could not be shown even if it had: `GET /api/mail` answers `hasPass`, never `pass`.
 * The island fills the four it is told about — host, port, user, from — and the tick, and leaves
 * the password blank behind a placeholder: blank means KEEP there too, because `POST /api/mail`
 * patches field by field and an absent key leaves the stored one alone.
 */
function mailField(f: {
  name: string; label: string; type?: 'text' | 'number' | 'password'
  placeholder?: string; extra?: string
}): string {
  const id = `f-mail-${f.name}`
  const number = f.type === 'number'
  return settingRow({
    label: f.label,
    forId: id,
    inline: number,
    control: textControl({
      value: '',
      type: f.type ?? 'text',
      width: number ? 'short' : 'full',
      placeholder: f.placeholder ?? '',
      attrs: `id="${escapeAttr(id)}" data-card-field="${escapeAttr(f.name)}"`
        + `${f.extra ? ` ${f.extra}` : ''}`,
    }),
  })
}

/**
 * SMTP: the credentials only. The subscriber list, the manual send and the test sends live on
 * Admin → Newsletter — this card is the plumbing, that page is the work.
 *
 * It saves and then actually SENDS (ADR 0041): storing a host proves nothing about whether mail
 * leaves the machine, and "why did my newsletter not send" was the question this card could not
 * answer — it had a Save key, a success toast, and no way to find out that port 587 was blocked
 * or the password was stale. `POST /api/mail/test` with `{ kind: 'smtp' }` sends one real
 * message to the owner's own address, so the answer arrives in their inbox and the provider's
 * refusal arrives under the card.
 */
function smtp(t: AdminStrings): string {
  const form = `<p class="${NOTE_TEXT}">${escapeHtml(t.nlSmtpHint)}</p>`
    + `<div class="grid gap-3 sm:grid-cols-2">`
    + mailField({ name: 'host', label: t.nlSmtpHost, placeholder: 'smtp.example.com' })
    // `data-card-field-number` because the ROUTE narrows with `typeof input.port === 'number'`
    // and `type="number"` still hands back a string: without it the port is dropped in silence,
    // the card goes green, and the stored port is whatever it was before.
    + mailField({ name: 'port', label: t.nlSmtpPort, type: 'number', extra: 'data-card-field-number' })
    + mailField({ name: 'user', label: t.nlSmtpUser, extra: 'autocomplete="off"' })
    + mailField({
      name: 'pass', label: t.nlSmtpPass, type: 'password', extra: 'autocomplete="new-password"',
    })
    + mailField({ name: 'from', label: t.nlSmtpFrom, placeholder: 'Blog <hi@example.com>' })
    + `</div>`
    // A tick and not a switch: it is one of the two booleans that sit inside a tight grid where
    // a 44px switch would not fit. It was a browser-default checkbox until 2026-09-07, which
    // read as a different application from the switches on every other card.
    //
    // ⚠️ THE PORT DRIVES IT, and the island keeps that true: implicit TLS is a port-465 thing,
    // while 587 and 25 speak STARTTLS and must be sent in the clear first. Getting the pair
    // wrong fails with an opaque OpenSSL "wrong version number".
    + checkField({ label: t.nlSmtpSecure, on: false, attrs: 'data-card-field="secure"' })
    // The unusual pair, said rather than prevented. Ships hidden: the server knows neither the
    // port nor the tick, so there is nothing yet to disagree with.
    + gate(false, escapeHtml(t.nlSmtpTlsMismatch), `class="${NOTE_TEXT}" data-mail-tls`)
    + `<a href="/admin/newsletter" class="text-sm font-medium text-neutral-500`
    + ` hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">`
    + `${escapeHtml(t.nlManageLink)} →</a>`
  // BOTH FACES, in ONE wrapper (trap 5), because they are mutually exclusive and the second is
  // the taller: the waiting line is what React drew instead of the card until `/api/mail`
  // answered, and the form is what it drew afterwards.
  return `<div>`
    + `<p class="text-sm text-neutral-500 dark:text-neutral-400" data-mail-loading>`
    + `${escapeHtml(t.loading)}</p>`
    + gate(false, form, 'class="space-y-5" data-mail-form')
    + `</div>`
}

/**
 * The tab.
 *
 * ⚠️ EVERY LAMP SHIPS IN THE STATE THE SERVER CAN SEE, and `connectionCard`'s own rule — AMBER
 * BEATS GREEN the moment there are unsaved edits — is the island's to apply from there. Nothing
 * is dirty in a document that has just been written, and nothing has been tried, so what is left
 * to say is whether the thing is switched on and whether its far end has credentials.
 *
 * THE TWO COMMENT CARDS NAME THE SAME KEY. `comments` is one object in the site record and both
 * cards write part of it, which is the granularity `changedIn('comments')` asked about in React:
 * edit either card and both go amber, because either card's Save sends the whole object.
 */
export function peopleTab(t: AdminStrings, s: SiteSettings, view: PeopleTabView): string {
  const c = s.comments
  const env = view.commentEnv
  // Turnstile is the only half that can be KNOWN to be incomplete here: with it off, there is
  // nothing to verify against and the blog's own gate is standing, which is not a fault.
  const ready = c.turnstile ? env.turnstileConfigured : true
  return `<div class="${GRID}">`
    + `<div class="${COL}">`
    // The switch itself, which also appears at the foot of the Posts tab — one key, two places,
    // because "should there be comments" is both the last thing on a post and the first thing on
    // this tab. Whichever is changed, the other reads it: they are the same `data-k`, and the
    // sheet's Save sends one value for it.
    + connectionCard({
      title: t.cardComments,
      keys: ['comments'],
      state: c.enabled ? 'good' : 'off',
      lampTitle: c.enabled ? t.connectionOk : t.connectionOff,
      saveLabel: t.save,
      body: switchList([switchRow({
        k: 'comments.enabled', label: t.commentsEnable, note: t.commentsEnableDesc,
        on: c.enabled,
      })]),
    })
    // `data-card-route` is the endpoint this card's `[data-card-field]` boxes POST to once the
    // flags have saved. It rides on the card rather than in the island because two more panels
    // still to be converted — the Cloudflare purge and the off-site copy — are the same card
    // with a different endpoint, and a list of them in the island would be a second place to
    // forget one.
    + connectionCard({
      title: t.cardCommentIntegrations,
      keys: ['comments'],
      state: !c.enabled ? 'off' : ready ? 'good' : 'attention',
      lampTitle: !c.enabled ? t.connectionOff : ready ? t.connectionOk : t.connectionUntested,
      saveLabel: t.save,
      body: commentKeys(t, c, env),
      attrs: 'data-card-route="/api/comments/keys"',
    })
    + `</div><div class="${COL}">`
    // NO SETTINGS KEY AT ALL, and the empty list says so out loud: the SMTP configuration is its
    // own table behind its own route, so the sheet's Save has nothing to store for this card and
    // must never turn amber for it.
    //
    // `data-card-tests` is the fact only the server knows — this card's far end can be tried, so
    // its key reads "Save and test" — and the label ships as plain Save because whether there IS
    // a host to try is something the island learns from `/api/mail`. An install with no mail is
    // not broken; it is a blog with no newsletter, and lighting the lamp for it would be a lie.
    + connectionCard({
      title: t.cardNewsletter,
      keys: [],
      state: 'off',
      lampTitle: t.connectionOff,
      saveLabel: t.save,
      body: smtp(t),
      // STORING IS NOT SENDING (ADR 0041). The save posts the credentials, and then the card
      // sends ONE REAL MESSAGE to the owner's own address, so "why did my newsletter not send"
      // is answered by their inbox and by the provider's own refusal under the card. Only with
      // a host to try: an install with no mail is not broken, it is a blog with no newsletter.
      attrs: 'data-mail-card data-card-tests data-card-route="/api/mail"'
        + ' data-card-test="/api/mail/test" data-card-test-body=\'{"kind":"smtp"}\''
        + ' data-card-test-when="host"',
    })
    + `</div></div>`
}
