// Reusable button with a few visual variants.
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'armed'

/**
 * Two sizes, and only two.
 *
 * `md` is the page's own action: the thing the screen exists to do. `sm` is an action inside
 * a strip of text — the restore/discard pair in the editor's unsaved-draft notice, which at
 * full size would be taller than the two lines it interrupts. A third size is a request to
 * make one screen special, and that is how there came to be four.
 */
type Size = 'md' | 'sm'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const STYLES: Record<Variant, string> = {
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

const SIZES: Record<Size, string> = {
  md: 'min-h-10 px-4 py-2 text-sm',
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
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className = ''): string =>
  `${SHAPE} ${SIZES[size]} ${STYLES[variant]} ${className}`

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}
