// THE ADMIN'S BUTTON, as class strings both faces can read.
//
// It sits in `src/admin-shared/` beside `rail.ts` for the same reason (ADR 0054): the server
// renders admin markup now, and `src/admin` is excluded from the root TypeScript project —
// a server module that reaches for `document` must fail to compile rather than fail on a
// request. `ui/Button.tsx` is the React component around this and re-exports `buttonClass`, so
// nothing that already imported it has to learn a second module.
//
// `check:admin-kit` guards the shape fragment against being re-typed anywhere; this file is its
// home now, and that guard is the reason the strings may live in exactly one place.
//
// EVERYTHING IN THIS DIRECTORY IS FRAMEWORK-FREE: no React, no hono, no DOM. That is not a
// style rule, it is the whole reason the directory exists — the moment one of these files
// imports from `src/admin`, the server can no longer read it.

import { TAP } from '@/admin-shared/scale'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'armed'

/**
 * Two sizes, and only two.
 *
 * `md` is the page's own action: the thing the screen exists to do. `sm` is an action inside
 * a strip of text — the restore/discard pair in the editor's unsaved-draft notice, which at
 * full size would be taller than the two lines it interrupts. A third size is a request to
 * make one screen special, and that is how there came to be four.
 */
export type ButtonSize = 'md' | 'sm'

const STYLES: Record<ButtonVariant, string> = {
  // Relief in 1–2px: a pressable thing stands PROUD of the sheet (a light lip above, 1px of
  // contact below) and pressing carves it in. Grey values, not a colour — this is shading.
  //
  // ON THE BLACK BUTTON THE SHADING HAS TO COME FROM LIGHT, NOT SHADOW. A dark inset inside
  // near-black is invisible — the same lesson the segmented strip learned — so this key is
  // lit instead: a bright lip along its TOP edge at rest, which is what a raised face catches;
  // hover lifts it (the lip brightens, the contact shadow deepens); the press moves the light
  // to the BOTTOM inside edge, which is what a sunken face catches, and drops the outside
  // shadow to nothing so the button sits flat on the sheet. Dark mode inverts the button, so
  // there the lip is a dark one and the same three states read the same way.
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 '
    + 'shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(0,0,0,.3)] '
    + 'hover:shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_4px_rgba(0,0,0,.32)] '
    + 'active:shadow-[inset_0_2px_4px_rgba(0,0,0,.55),inset_0_-1px_0_rgba(255,255,255,.22)] '
    + 'dark:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(0,0,0,.25)] '
    + 'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.3)] '
    + 'dark:active:shadow-[inset_0_2px_4px_rgba(0,0,0,.3),inset_0_-1px_0_rgba(255,255,255,.7)]',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 '
    + 'shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_1.5px_rgba(0,0,0,.12)] '
    // Hover LIFTS a raised key — 2px of contact instead of 1 — rather than only tinting it.
    + 'hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.14)] '
    + 'active:shadow-[inset_0_2px_3px_rgba(0,0,0,.22)] '
    + 'dark:shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_1px_1.5px_rgba(0,0,0,.5)] '
    + 'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_2px_4px_rgba(0,0,0,.55)] '
    + 'dark:active:shadow-[inset_0_2px_3px_rgba(0,0,0,.6)]',
  // Flat at rest — a ghost earns its relief only under the finger.
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 active:shadow-[inset_0_2px_3px_rgba(0,0,0,.15)] dark:active:shadow-[inset_0_2px_3px_rgba(0,0,0,.5)]',
  // THE RED BALLPOINT. It was byte-identical to primary once, which made "Delete forever" the
  // loudest control on its screen with only a native confirm() between it and a deleted post;
  // then it became an outline, which ranked it correctly and still asked the reader to notice
  // a border weight. Since 2026-08-29 it is the pen you would actually reach for, and that is
  // the whole argument for the colour: on paper, red ballpoint is what you strike OUT.
  //
  // OUTLINED, not filled. A solid red button is louder than the primary action beside it, and
  // the loudest thing on a screen should be the thing you came to do — not the thing that
  // destroys work. It fills on hover, when the pointer is already committed to it.
  danger:
    'border text-[var(--pen-red)] border-[var(--pen-red)] bg-transparent hover:bg-[var(--pen-red)] hover:text-white active:shadow-[inset_0_2px_3px_rgba(0,0,0,.3)]',
  // THE ARMED FACE of a two-stage latch: the first press turns the button this colour, the
  // second press fires. Amber is the admin's needs-you hue (the version dot, NOTE_ALERT) —
  // a control wearing it is half-way through something that cannot be undone, which is why
  // this is a variant and not a hover. `tabular-nums`, because the label counts down.
  armed:
    'border border-amber-500 bg-amber-50 text-neutral-900 tabular-nums hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-neutral-100 dark:hover:bg-amber-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_1px_1.5px_rgba(0,0,0,.12)] active:shadow-[inset_0_2px_3px_rgba(0,0,0,.25)]',
}

// `whitespace-nowrap` and `shrink-0` are load-bearing, not tidying. In a flex row beside
// anything long, a button with neither gets squeezed until its own LABEL wraps: the MCP card
// shipped "Tạo token" broken across two lines and twice as tall as the row it sat in. A
// button is a fixed object; it is the text beside it that gives way.
// THE CLICK. Pressing is instant — the 1px of travel and the carved-in shadow land with
// `duration-0` — and only the release is sprung, on the inherited transition. A control that
// eases both ways feels like a screen; a key that drops NOW and springs back is what a hand
// expects from a pressed thing. Reduced motion keeps the surface change and drops the travel.
const SHAPE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px active:duration-0 motion-reduce:active:translate-y-0'

// 36 and 32, down from 40 and 32 on 2026-09-01. Forty was never measured against anything —
// it is the default a dashboard arrives with — and next to this admin's type it read as
// furniture: a `Save settings` key 40px tall over a 33.5px tab strip, `Choose image` twice the
// height of the sentence explaining it. The small key keeps its 32 and is now one step below
// the ordinary one rather than two, which is what a second size is for.
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-9 px-3.5 py-1.5 text-sm',
  sm: 'min-h-8 px-3 py-1.5 text-xs',
}

/**
 * The same button, for something that is a LINK and not a button.
 *
 * Exported because the alternative is what was already happening: an `<a>` that wants to look
 * like the primary action copies the class list by hand and loses part of it. The Overview's
 * New post link had no `shrink-0`, no `whitespace-nowrap` and no dark hover; two integration
 * cards used `px-3 py-1.5` with no minimum height; and the two editors' restore-draft buttons
 * had square corners, in an admin whose stated rule is that square corners belong to the
 * public reading interface only. Four primary buttons, four sizes.
 */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = ''): string =>
  `${SHAPE} ${SIZES[size]} ${STYLES[variant]} ${className}`


/**
 * A sheet laid ON TOP of the page: the paper's own radius, its own edge, and the lift.
 *
 * Moved out of `admin/components/sheet.tsx` on 2026-09-14 with the button, and for the same
 * reason: the server draws one now. The phone's rail drawer is an overlay, and it was about to
 * be a hand-typed `rounded-xl border … shadow-xl` — a fifth radius and a shadow the admin does
 * not otherwise draw. `check:admin-css` caught it because the class had no rule behind it,
 * which is a thinner reason than the real one.
 */
export const OVERLAY_LIFT =
  'shadow-[0_16px_32px_-12px_rgba(0,0,0,.22),0_3px_8px_-4px_rgba(0,0,0,.12)] dark:shadow-[0_16px_32px_-12px_rgba(0,0,0,.7),0_3px_8px_-4px_rgba(0,0,0,.5)]'

export const OVERLAY =
  `rounded-[10px] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${OVERLAY_LIFT}`

// ═══ SURFACES AND FIELDS ═══════════════════════════════════════════════════════════════════
//
// Lifted out of `admin/components/{kit,sheet}.tsx` as ADR 0054's screens began converting: the
// server draws them now and may not import from `src/admin`. Both files re-export what moved,
// so nothing that already had them has to learn a second module, and `check:admin-kit` follows
// the strings rather than the filenames.

export const CARD =
  'rounded-[10px] border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none'

export const CONTROL_CHROME =
  // The inset is the relief grammar's other half: raised means pressable, CARVED means it
  // holds something — and a field holds the value. 1px of shading, not a style.
  'rounded-md border border-neutral-300 bg-white text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 placeholder:text-neutral-400 shadow-[inset_0_1px_1.5px_rgba(0,0,0,.06)] dark:shadow-[inset_0_1px_1.5px_rgba(0,0,0,.35)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800 dark:placeholder:text-neutral-500'

// The canonical control — chrome plus the size nearly every field wants. `ui/Input.tsx`
// IMPORTS this rather than keeping a matching copy. Callers add width (see FIELD_W).
// `min-h-9` is `ui/Button`'s height: an earlier padding measured 42 against the button's 40,
// and a field two pixels proud of the button that acts on it is one row broken.
export const CONTROL = `${CONTROL_CHROME} min-h-9 px-3 py-1.5 text-sm`
// The SECOND size, and there are only two. A sheet's tools row takes its height from the
// segmented strip that starts it — 32 — so a field standing on one is 32, not the 36 a field
// inside a form wears. `h-8` and not a minimum: a tools row does not grow.
export const CONTROL_SM = `${CONTROL_CHROME} h-8 px-3 text-sm`

export const SHEET = `${CARD} flex flex-col min-h-[60vh]`

/**
 * The sheet for a page that must fit the WINDOW instead of growing past it.
 *
 * `SHEET` sets a FLOOR, so a page taller than the fold simply scrolls — right for every
 * screen whose content is a list. It is wrong for a conversation: the composer belongs to
 * the sheet's bottom edge, and with a floor that edge walks off the screen the moment the
 * transcript is longer than the window. Here the sheet is exactly as tall as the room it
 * has and the TRANSCRIPT scrolls inside it.
 *
 * The 9rem is the chrome above and below, measured rather than guessed: the canvas pads
 * `lg:py-9` (36 top, 36 bottom) and `PageHeader` is a 22px title on `mb-10` (~68). 144px
 * covers it with a few pixels to spare, and being a few pixels out costs a few pixels of
 * scroll rather than a broken layout. Below `lg` the page scrolls as pages do.
 */
export const SHEET_FIXED = `${CARD} flex flex-col min-h-[70dvh] lg:h-[calc(100dvh-9rem)]`

/** The sheet's closing line of small print: counts, hints, what a click does. */
export const SHEET_FOOT =
  'mt-auto border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400'

/** A quiet tool on the sheet-top row — same voice as the write pane's sort cycle. */
export const SHEET_TOOL =
  `${TAP} text-xs text-neutral-500 transition hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200`

/**
 * The same tool, for a `PageHeader` action — which is NOT on a sheet.
 *
 * Everything else that wears `SHEET_TOOL` sits on a white card and measures 4.61:1. A page
 * header sits on the canvas, which is tinted, and the same ink there measures 4.39:1 — under
 * the 4.5:1 a 12px line has to clear. The call site that needs it is the newsletter's SMTP
 * link; Analytics used to be the other, and its CSV export was removed on 2026-08-30.
 *
 * DERIVED from `SHEET_TOOL` rather than typed out, because a hand-copy of this constant is a
 * thing that has already happened here more than once — and because the ONLY difference that
 * belongs between them is the one notch of ink.
 */
export const SHEET_TOOL_ON_CANVAS = SHEET_TOOL.replace('text-neutral-500', 'text-neutral-600')

/**
 * The same tool, in red ballpoint, for one that DESTROYS something.
 *
 * "Restore" and "Delete permanently" sat side by side in the Trash wearing the identical
 * class — the same size, the same weight, the same grey — with a native `confirm()` as the
 * only thing between a mis-tap and a post that is gone. Nothing on the row said which of the
 * two was the one you cannot undo.
 *
 * DERIVED, not re-typed, for the reason `SHEET_TOOL_ON_CANVAS` is: the two must differ by
 * exactly one thing — the ink — and a hand-written copy drifts on the other five within a
 * month. The ink is the product's own red ballpoint (`--pen-red`, PEN_AUX_LIGHT in
 * `pen/pigments.ts`), which is what you strike a line through something with on paper.
 */
export const SHEET_TOOL_DANGER = SHEET_TOOL
  .replace('text-neutral-500', 'text-[var(--pen-red)]')
  .replace('hover:text-neutral-900', 'hover:text-[var(--pen-red)] hover:underline')
  .replace('dark:text-neutral-400', 'dark:text-[var(--pen-red)]')
  .replace('dark:hover:text-neutral-200', 'dark:hover:text-[var(--pen-red)]')

/**
 * The sheet's FIRST ROW: the page's tools on one thin band over a hairline.
 *
 * A constant rather than a class list inside a component, because two faces draw it now.
 */
export const SHEET_TOP =
  'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800'
