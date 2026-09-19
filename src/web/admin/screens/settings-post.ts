// Settings → Posts: WHAT SURROUNDS THE WORDS ON A POST.
//
// ADR 0041, and the grouping is the point of the tab. Its switches used to be two lists — "the
// reader's apparatus" and "what the page puts in front of them" — a distinction that reads well
// written down and answers no question anybody arrives with. What somebody actually holds is
// "the date is in the wrong place" or "I want the table of contents gone", and both of those are
// answered by knowing WHERE on the page the thing appears. So the switches are grouped by
// position, in reading order, in one card: above the first sentence, in the body, after the last
// word.
//
// The tables and the pen came from the old Appearance tab, which held 137 controls over 2,825px
// measured on 2026-09-07. Both draw INSIDE a post's body and neither is a palette decision, so
// they belong to the question this tab asks.
//
// Save-all: every key here goes through the sheet's one Save key.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { FeatureSettings, SiteSettings } from '@/types'
import { contrastRatio } from '@/pen/derive'
import { PEN_AUX_LIGHT, PEN_LIGHT } from '@/pen/pigments'
import { escapeHtml } from '@/utils'
import { SHEET_TOOL } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { group, panelCard, settingRow, switchRow, textField } from '@/web/admin/fields'
import { panelList, reveal } from '@/web/admin/fields-box'
import { choice, colourGrid, colourRow } from '@/web/admin/fields-pick'
import { gate } from '@/web/admin/fields-pic'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/** One reader feature: the key it stores, its name, and the sentence under it. */
type Feat = { k: keyof FeatureSettings; label: string; note: string }

/**
 * A GROUP OF SWITCHES AS A RULED LIST: rows with a line between them and no edge of their own.
 *
 * `switch-row p-4` on every row, and neither class is decoration. `admin.css` recognises a
 * BOOLEAN by `.switch-row` — a boolean is the one setting that keeps its control at the row's far
 * end when the explanations are hidden — and `.panel-list .switch-row.p-4` is what gives the row
 * back the horizontal padding the list's own `-mx-4` took off it.
 */
const switches = (f: FeatureSettings, items: Feat[]): string =>
  panelList(items.map((i) => switchRow({
    k: `features.${i.k}`, label: i.label, note: i.note, on: f[i.k],
  })).join(''))

/** THE HEAD OF A POST: what stands above the first sentence. */
const head = (t: AdminStrings, f: FeatureSettings): string => switches(f, [
  { k: 'deck', label: t.featDeck, note: t.featDeckDesc },
  { k: 'categoryLabel', label: t.featCategoryLabel, note: t.featCategoryLabelDesc },
  { k: 'readingTime', label: t.featReadingTime, note: t.featReadingTimeDesc },
])

/** THE BODY: what happens between the first sentence and the last. */
const body = (t: AdminStrings, f: FeatureSettings): string => switches(f, [
  { k: 'toc', label: t.featToc, note: t.featTocDesc },
  { k: 'progressBar', label: t.featProgress, note: t.featProgressDesc },
  { k: 'resume', label: t.featResume, note: t.featResumeDesc },
  { k: 'readerPen', label: t.featReaderPen, note: t.featReaderPenDesc },
  { k: 'penUnderline', label: t.featPenUnderline, note: t.featPenUnderlineDesc },
  { k: 'penRing', label: t.featPenRing, note: t.featPenRingDesc },
  { k: 'penLists', label: t.featPenLists, note: t.featPenListsDesc },
  { k: 'bookText', label: t.featBookText, note: t.featBookTextDesc },
  // ADR 0058. Both are ON for a new blog and OFF for one that already had a settings row, so an
  // upgrade never silently redraws somebody's writing — `NEW_SINCE_INSTALLS_EXISTED`.
  { k: 'bookmarkCards', label: t.featBookmarkCards, note: t.featBookmarkCardsDesc },
  { k: 'fileCards', label: t.featFileCards, note: t.featFileCardsDesc },
  { k: 'bookMode', label: t.featBookMode, note: t.featBookModeDesc },
])

/**
 * NEITHER HEAD NOR BODY NOR FOOT: how a post is FOUND, and whether it survives losing the
 * network. Both are about a post and neither appears anywhere on one, which is why they are
 * their own group rather than filed under a position they do not have.
 */
const reach = (t: AdminStrings, f: FeatureSettings): string => switches(f, [
  { k: 'search', label: t.featSearch, note: t.featSearchDesc },
  { k: 'offline', label: t.featOffline, note: t.featOfflineDesc },
])

/** THE FOOT: what a reader is offered once the words have run out. */
function end(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${SETTING_GAP}">`
    + `<div class="${SETTING_GAP}">`
    + switches(s.features, [
      { k: 'related', label: t.featRelated, note: t.featRelatedDesc },
      { k: 'readNext', label: t.featReadNext, note: t.featReadNextDesc },
    ])
    // A CURTAIN, not a `{on && …}`: the count GROWS out of the row rather than being inserted
    // into it. Inserting it pushed everything below down by however tall the control happened to
    // be, and the eye cannot follow that — it reports "the screen is different now" and leaves
    // working out what moved to a second look.
    + reveal(s.features.related, textField({
      k: 'relatedCount', label: t.relatedCount, note: t.relatedCountHint,
      type: 'number', value: s.relatedCount, attrs: 'min="0" max="12"',
    }), 'data-reveal="features.related"')
    + `</div>`
    + panelList(switchRow({
      k: 'comments.enabled', label: t.commentsEnable, note: t.commentsEnableDesc,
      on: s.comments.enabled,
    }))
    // The switch is here because comments are the last thing on a post; HOW a commenter proves
    // they are a person is a connection, and lives on the tab that holds the keys for it. One
    // click, rather than three tabs of hunting.
    //
    // `data-settings-goto` is honoured by `island/settings.ts`, beside the tab strip's own
    // handler. It was drawn and wired to nothing from the conversion until 2026-09-18.
    + `<button type="button" data-settings-goto="people" class="${SHEET_TOOL}">`
    + `${escapeHtml(t.linkCommentSignIn)} →</button>`
    + `</div>`
}

/** THE HERO — the picture at the top of the post itself. */
function hero(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${SETTING_GAP}">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.postImageHint)}</p>`
    // TWO values, not three. A `wide` hero existed for an afternoon and was measured out again:
    // at contentWidth 672 on a 1440 viewport it started at 264 while the left rail ran 126-376,
    // so it printed over the table of contents — and the band between the rails does not grow
    // with the viewport, because the rails are positioned against the column.
    // `types-settings.ts` carries the numbers.
    + choice({
      k: 'postImage.hero', label: t.postImageHero, note: t.postImageHeroHint,
      value: s.postImage.hero,
      options: [['none', t.piOff], ['inline', t.piHeroInline]],
    })
    + `</div>`
}

/** The site-wide default frame: what every picture wears unless it says otherwise. */
function figure(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${SETTING_GAP}">`
    + choice({
      k: 'figure.frame', label: t.figureFrame, note: t.figureFrameHint, value: s.figure.frame,
      options: [
        ['none', t.imgFrameNone], ['thin', t.imgFrameThin],
        ['medium', t.imgFrameMedium], ['thick', t.imgFrameThick],
      ],
    })
    // The mat's colour is only a question once there is a mat, so it appears with one — and
    // since 2026-09-07 it GROWS out of the row rather than being inserted into it.
    //
    // ⚠️ TWO THINGS HERE ARE NOT IN THE VOCABULARY YET, and this curtain does not work without
    // them. (1) `applyGates` splits `data-reveal` on `=` and compares for equality, so it cannot
    // express "any frame but `none`"; the `!=` below is the form it needs to learn. (2) `ink` is
    // stored as a BOOLEAN and `settings-form.ts` types a segmented choice as its string, which
    // `sanitizeFigure`'s `bool()` then discards — so this strip currently saves nothing at all.
    // The values are `1`/`0` so that a boolean-aware `choice` needs no change here.
    + reveal(s.figure.frame !== 'none', choice({
      k: 'figure.ink', label: t.figureFrameColour, note: t.figureFrameColourHint,
      value: s.figure.ink ? '1' : '0',
      options: [['0', t.imgFramePaper], ['1', t.imgFrameInk]],
      // ⚠️ `bool: true`, WHICH EMITS `data-k-bool`. It said `attrs: 'data-bool'` until
      // 2026-09-15 — an attribute nothing reads — so the form sent the STRING "1", `bool()` in
      // the sanitiser takes only a real boolean, and the frame colour fell back to what it was.
      // The card saved, the screen said so, and the setting never moved.
      bool: true,
    }), 'data-reveal="figure.frame!=none"')
    + `</div>`
}

/** The site-wide default for in-body galleries: the tiles' shape, and whether captions print. */
function gallery(t: AdminStrings, s: SiteSettings): string {
  return `<div class="${SETTING_GAP}">`
    // Ratios read the same in every language. Only "as shot" is a word.
    + choice({
      k: 'gallery.ratio', label: t.galleryRatio, note: t.galleryRatioHint, value: s.gallery.ratio,
      options: [['', t.imgRatioNatural], ['1x1', '1:1'], ['3x2', '3:2'], ['4x3', '4:3']],
    })
    // NO ruled list around this one, unlike the table's stripe and the comment master switch.
    // `.switch-row.p-4` alone is padded to zero at the sides; it is `.panel-list` above it that
    // puts the 16px back, so a lone row in a list would be the only inset row in the card.
    + switchRow({
      k: 'gallery.captions', label: t.galleryCaptions, note: t.galleryCaptionsHint,
      on: s.gallery.captions,
    })
    + `</div>`
}

/**
 * How tables are drawn.
 *
 * One set for the whole blog, and that is the design. GFM has no syntax for a tinted header or a
 * row rule, so the alternative is an attribute carried in the Markdown — which would make a
 * table stop being something anybody can paste in or out. Measured against a real article of six
 * tables (2026-08-29): one timeline of three short columns, five reference tables of two columns
 * with cells past 150 characters. They were all ONE KIND.
 */
function table(t: AdminStrings, s: SiteSettings): string {
  const a = s.table
  return `<div class="${SETTING_GAP}">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.tableHint)}</p>`
    + choice({
      k: 'table.head', label: t.tableHead, note: t.tableHeadHint, value: a.head,
      options: [
        ['plain', t.tableHeadPlain], ['tint', t.tableHeadTint],
        ['rule', t.tableHeadRule], ['ink', t.tableHeadInk],
      ],
    })
    + choice({
      k: 'table.grid', label: t.tableGrid, note: t.tableGridHint, value: a.grid,
      options: [['all', t.tableGridAll], ['rows', t.tableGridRows], ['none', t.tableGridNone]],
    })
    + choice({
      k: 'table.ruleWeight', label: t.tableRuleWeight, note: t.tableRuleWeightHint,
      value: a.ruleWeight,
      options: [['hairline', t.tableHairline], ['bold', t.tableThick]],
    })
    + choice({
      k: 'table.firstColumn', label: t.tableFirstCol, note: t.tableFirstColHint,
      value: a.firstColumn,
      options: [['normal', t.tableColNormal], ['strong', t.tableColStrong]],
    })
    // The air words are the SHAPE card's, deliberately: this is the same question that card asks
    // about the page, asked about a cell, and two vocabularies for one idea is how a settings
    // screen stops being readable.
    + choice({
      k: 'table.padding', label: t.tablePadding, note: t.tablePaddingHint, value: a.padding,
      options: [['tight', t.shapeCompact], ['normal', t.shapeNormal], ['roomy', t.shapeRelaxed]],
    })
    + choice({
      k: 'table.narrow', label: t.tableNarrow, note: t.tableNarrowHint, value: a.narrow,
      options: [['fit', t.tableNarrowFit], ['scroll', t.tableNarrowScroll]],
    })
    // A switch rather than a two-option choice: it is on or off, and the six above are all
    // "which one", so drawing it as a seventh track would say it is the same kind of question.
    // `panelList` because a switch row carries its own padding and expects the boxed row the
    // feature lists put it in.
    + panelList(switchRow({
      k: 'table.stripe', label: t.tableStripe, note: t.tableStripeHint,
      on: a.stripe,
    }))
    + `</div>`
}

/** The five, in the order the toolbar offers them. */
const PIGMENTS = ['yellow', 'green', 'pink', 'blue', 'orange'] as const

/** AA for body text, and the number ADR 0018 audited the five built-in inks against. */
const AA = 4.5

/**
 * The pen's colours.
 *
 * EMPTY IS THE DEFAULT, and the swatch shows the built-in while the value stays empty, so the
 * measured inks live in the code where they can still be corrected rather than being copied into
 * every install's database. What the server writes into the field is therefore the SHOWN colour
 * and not the stored one — which is exactly right for the form's diff, because the field is only
 * dirty once somebody has moved it.
 */
function inks(t: AdminStrings, s: SiteSettings): string {
  const v = s.inks
  const theme = s.themes[s.themePreset]
  const shown = (stored: string, fallback: string): string =>
    stored || `#${fallback.replace(/^#/, '')}`
  const label = {
    yellow: t.inkYellow, green: t.inkGreen, pink: t.inkPink, blue: t.inkBlue, orange: t.inkOrange,
  }
  // A pigment dark enough to swallow the words under it. The stroke multiplies onto the page, so
  // the WORST case is the densest part of it, which is the pigment itself. The default palette's
  // light body colour, so the warning is about THIS site.
  const bodyText = theme?.light.text ?? '#262626'
  const tooDark = PIGMENTS.filter((k) => v[k] && contrastRatio(bodyText, v[k]) < AA)

  return `<div class="${SETTING_GAP}">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.inkHelp)}</p>`
    + settingRow({
      label: t.inkHighlighter,
      control: colourGrid(PIGMENTS.map((k) =>
        colourRow({ k: `inks.${k}`, label: label[k], value: shown(v[k], PEN_LIGHT[k]) })).join('')),
    })
    // Said rather than prevented: it is the owner's pen. But a stroke this dark puts the words
    // under it below the contrast this repository has audited itself against, and a setting that
    // quietly discards that audit is worse than no setting.
    //
    // ⚠️ IT SHIPS IN THE STATE THE SERVER COULD SEE AND NOTHING MOVES IT. React recomputed the
    // ratio on every keystroke; the island has no contrast check, so until it grows one this
    // sentence is only right about what was SAVED.
    //
    // Neither `NOTE_TEXT` nor `NOTE_ALERT`: it carries the note's shape in full-strength ink,
    // upright rather than italic, and without `admin-note` — hiding the explanations must not
    // hide the one sentence saying the pen is about to swallow the words under it.
    + gate(tooDark.length > 0,
      `<p class="text-[0.8125rem] leading-[1.55] text-neutral-900 dark:text-neutral-100">`
      + `${escapeHtml(t.inkTooDark)}</p>`, 'data-ink-dark')
    + settingRow({
      label: t.inkLines, note: t.inkLinesHint,
      control: colourGrid(
        colourRow({ k: 'inks.ring', label: t.inkRing, value: shown(v.ring, PEN_AUX_LIGHT.red) })
        + colourRow({
          k: 'inks.underline', label: t.inkUnderline,
          value: shown(v.underline, PEN_AUX_LIGHT.graphite),
        })),
    })
    + settingRow({
      label: t.inkSelection, note: t.inkSelectionHint,
      // What the sheet's own rule paints when neither field is set: the heading colour on paper,
      // the mid grey on a dark page. Shown so the swatch tells the truth about what the reader
      // currently sees.
      control: colourGrid(
        colourRow({
          k: 'inks.selection', label: t.inkSelectionLight,
          value: shown(v.selection, theme?.light.heading ?? '#121212'),
        })
        + colourRow({
          k: 'inks.selectionDark', label: t.inkSelectionDark,
          value: shown(v.selectionDark, theme?.dark.meta ?? '#888888'),
        })),
    })
    + `</div>`
}

export function postTab(t: AdminStrings, s: SiteSettings): string {
  // ⚠️ `data-reset-inks` IS NOT WIRED YET, and it is the one key on this tab that has to WRITE
  // rather than read: it puts all nine ink fields back to their built-ins and the stored value
  // back to empty. `SHEET_TOOL` rather than the React face's own four-class copy of it, which
  // had drifted by a `transition`, a tap target and one shade of hover.
  const resetInks = `<button type="button" data-reset-inks class="${SHEET_TOOL} shrink-0">`
    + `${escapeHtml(t.resetDefault)}</button>`
  return `<div class="${GRID}">`
    + `<div class="${COL}">`
    + panelCard({
      title: t.cardPost,
      body: group({ title: t.groupPostHead, first: true, body: head(t, s.features) })
        + group({ title: t.groupPostBody, body: body(t, s.features) })
        + group({ title: t.groupPostEnd, body: end(t, s) })
        + group({ title: t.groupPostReach, body: reach(t, s.features) }),
    })
    + `</div><div class="${COL}">`
    + panelCard({
      title: t.cardPictures,
      body: `<div class="${SETTING_GAP}">${hero(t, s)}${figure(t, s)}${gallery(t, s)}</div>`,
    })
    + panelCard({ title: t.cardTable, body: table(t, s) })
    + panelCard({ title: t.cardInk, actions: resetInks, body: inks(t, s) })
    + `</div></div>`
}
