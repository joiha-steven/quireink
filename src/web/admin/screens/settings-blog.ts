// Settings → Blog: WHAT THIS BLOG IS. Its name, its language, its marks, and whose it is.
//
// ADR 0041. It is the old Site tab plus the one key from Search & URLs that answers the same
// question — the canonical address. A blog's own address is part of what the blog is, and filing
// it under "how machines see the site" put the answer to "what is my domain" behind a tab named
// after search engines.
//
// Save-all: every key here goes through the sheet's one Save key.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { SITE_LANGS } from '@/locales/langs'
import { escapeAttr, escapeHtml } from '@/utils'
import { NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { panelCard, settingRow, switchRow, textArea, textField } from '@/web/admin/fields'
import { pick, pickControl } from '@/web/admin/fields-pick'
import { gate, iconUpload, pickedImage } from '@/web/admin/fields-pic'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/**
 * Every zone the RUNTIME knows — asked for rather than listed.
 *
 * A list written here would be a second copy of the IANA database, staler than the one the
 * browser already ships and wrong the first time a country changes its rules, which they do
 * several times a decade. The fallback is not a shorter list but the ONE zone that is always
 * right, because a half-list would quietly hide somebody's own country from them.
 *
 * ⚠️ WITHOUT `Etc/GMT±N`, AND THE SIGN IS WHY. In those 26 names the sign is INVERTED against
 * every other way a person writes an offset: `Etc/GMT+1` is UTC MINUS one hour. They are in the
 * database for POSIX compatibility, and a blog's owner scrolling a list of 445 zones for
 * somewhere to put their publishing clock is not the audience for that trap. The browser
 * agrees — Chrome leaves them out of `supportedValuesOf` and this list was the browser's until
 * ADR 0054 moved it to the server, where the engine hands back all 26 (measured 2026-09-15:
 * Bun 445, Chrome 419). Filtering them keeps the answer the same on both sides of that move.
 */
const zones = (): [string, string][] => {
  try {
    return Intl.supportedValuesOf('timeZone').filter((z) => !z.startsWith('Etc/GMT')).map((z) => [z, z])
  } catch {
    return [['UTC', 'UTC']]
  }
}

/**
 * The zone list, with whatever this blog ALREADY has in it, even when the runtime never offers
 * that name.
 *
 * A `<select>` whose value matches no option shows its FIRST option instead — here, "the
 * server's own clock" — so a stored zone this engine does not list would be a screen telling
 * the owner something untrue about their own blog, on a control where the only way to find out
 * is to publish something at the wrong hour. Filtering above makes that reachable on purpose;
 * an engine built against an older database, or a value written by an import, makes it
 * reachable by accident.
 */
const zoneOptions = (t: AdminStrings, current: string): [string, string][] => {
  const known = zones()
  const missing = current !== '' && !known.some(([z]) => z === current)
  return [['', t.siteTimezoneServer], ...(missing ? [[current, current] as [string, string]] : []), ...known]
}

function general(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${SETTING_GAP}">`
    // A SELECT, not a segmented strip. Ten languages in a wrapping track was a grey slab two
    // rows tall holding one sunken key — a segmented control is for THREE or four answers read
    // at a glance, and past that it is the worst of both worlds.
    //
    // ⚠️ IT DOES NOT APPLY UNTIL IT IS SAVED. Choosing a language used to re-letter the whole
    // admin on the change event, before anything was stored — so somebody looking at what
    // Vietnamese would be like got a Vietnamese admin, an unsaved form, and a Save key they now
    // had to find in a language they were only trying on. The note says the state out loud while
    // the form and the server disagree; both sentences ship and the island picks.
    + settingRow({
      label: t.siteLanguage,
      noteHtml: `<span data-lang-note-same>${escapeHtml(t.siteLanguageHint)}</span>`
        + `<span data-lang-note-moved hidden>${escapeHtml(t.siteLanguageOnSave)}</span>`,
      inline: true,
      control: pickControl({
        k: 'language', value: s.language, width: 'medium',
        options: SITE_LANGS.map((l) => [l.value, l.label] as [string, string]),
        attrs: `aria-label="${escapeAttr(t.siteLanguage)}" data-lang-field data-saved="${escapeAttr(s.language)}"`,
      }),
    })
    // Beside its label, and no longer the width of the card: a zone is a short answer, so it
    // takes a short field and the row it was spending on its own.
    + pick({
      k: 'timezone', label: t.siteTimezone, note: t.siteTimezoneHint, inline: true, width: 'medium',
      value: s.timezone, options: zoneOptions(t, s.timezone),
    })
    + textField({ k: 'title', label: t.siteTitle, value: s.title, placeholder: 'Quire Ink' })
    + textArea({
      k: 'description', label: t.siteDescription, value: s.description, rows: 2,
      placeholder: t.siteDescriptionPlaceholder,
    })
    + switchRow({ k: 'showDescription', label: t.showDescription, on: s.showDescription })
    + textField({
      k: 'excerptLength', label: t.excerptLength, note: t.excerptLengthHint,
      type: 'number', value: s.excerptLength, attrs: 'min="10" max="100"',
    })
    + `</div>`
}

function branding(t: AdminStrings, s: SiteSettings): string {
  const logo = pickedImage({
    k: 'logoUrl', value: s.logoUrl, chooseLabel: t.chooseLogo, removeLabel: t.removeLogo,
    emptyLabel: t.noLogo, alt: 'Logo', previewClass: 'h-12 w-auto rounded-md bg-neutral-100 p-1',
  })
  // The dark twin. Optional: with none set, the light mark is used in both modes, which is what
  // every install did before this existed. The preview sits on a dark tile because that is the
  // only background it will ever be seen on.
  const dark = `<div class="border-t border-neutral-200 pt-5 dark:border-neutral-800">`
    + settingRow({
      label: t.chooseLogoDark, note: t.logoDarkHint,
      control: pickedImage({
        k: 'logoDarkUrl', value: s.logoDarkUrl, chooseLabel: t.chooseLogoDark,
        removeLabel: t.removeLogo, emptyLabel: t.noLogoDark, alt: 'Logo (dark)',
        previewClass: 'h-12 w-auto rounded-md bg-neutral-900 p-1',
      }),
    }) + `</div>`

  return `<div class="${SETTING_GAP}">`
    + switchRow({ k: 'showLogo', label: t.showLogo, on: s.showLogo })
    + gate(s.showLogo, `<div class="${SETTING_GAP}">${logo}${dark}`
      + textField({
        k: 'logoWidth', label: t.logoWidth, note: t.logoWidthHint, type: 'number',
        value: s.logoWidth, attrs: 'min="24" max="600"',
      })
      + `</div>`, 'data-gate="showLogo"')
    + settingRow({
      label: t.favicon, note: t.faviconHint,
      control: iconUpload({
        k: 'faviconUrl', kind: 'favicon', value: s.faviconUrl, previewClass: 'h-8 w-8 rounded',
        chooseLabel: t.chooseImage, removeLabel: t.removeSelection, emptyLabel: t.noImageSelected,
      }),
    })
    + settingRow({
      label: t.appIcon, note: t.appIconHint,
      control: iconUpload({
        k: 'appIconUrl', kind: 'app-icon', value: s.appIconUrl, previewClass: 'h-12 w-12 rounded-lg',
        chooseLabel: t.chooseImage, removeLabel: t.removeSelection, emptyLabel: t.noImageSelected,
      }),
    })
    + `</div>`
}

function author(t: AdminStrings, s: SiteSettings): string {
  const a = s.author
  // SLOT · WORDS · BUTTON, on one line — the shape every picture in the admin is picked with.
  // This one put its keys on a line of their own, which was a fourth arrangement of the same
  // three pieces on a screen that already had three.
  // SLOT · WORDS · KEYS, on one line — the shape every picture in the admin is picked with.
  // This one put its keys on a line of their own, which was a fourth arrangement of the same
  // three pieces on a screen that already had three.
  const avatar = pickedImage({
    k: 'author.avatarUrl', value: a.avatarUrl, row: true,
    chooseLabel: t.chooseImage, removeLabel: t.removeSelection, emptyLabel: t.authorNoAvatar,
    alt: '', previewClass: 'h-16 w-16 shrink-0 rounded-lg object-cover',
    slotClass: 'h-16 w-16 shrink-0 rounded-lg',
  })

  return `<div class="${SETTING_GAP}">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.authorHint)}</p>`
    + textField({ k: 'author.name', label: t.authorName, note: t.authorNameHint, value: a.name, attrs: 'maxlength="80"' })
    + textArea({ k: 'author.bio', label: t.authorBio, note: t.authorBioHint, value: a.bio, rows: 3 })
    + settingRow({ label: t.authorAvatar, note: t.authorAvatarHint, control: avatar })
    + textField({ k: 'author.url', label: t.authorLink, note: t.authorLinkHint, type: 'url', value: a.url, placeholder: 'https://' })
    + `</div>`
}

export function blogTab(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${GRID}">`
    + `<div class="${COL}">`
    + panelCard({ title: t.cardGeneral, body: general(t, s) })
    // The address the blog calls its own. One field, so it rides under the identity it belongs
    // to rather than opening a card of its own.
    + panelCard({
      title: t.cardAddress,
      body: textField({
        k: 'siteUrl', label: t.seoCanonical, note: t.seoCanonicalHint,
        value: s.siteUrl, placeholder: 'https://example.com',
      }),
    })
    + `</div><div class="${COL}">`
    + panelCard({ title: t.cardBranding, body: branding(t, s) })
    // Whose blog this is — filed with the marks, because both answer "who is this", and the
    // words above answer "what is this".
    + panelCard({ title: t.cardAuthor, body: author(t, s) })
    + `</div></div>`
}
