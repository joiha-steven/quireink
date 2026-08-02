// Reusable button with a few visual variants.
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

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
  primary:
    'bg-neutral-900 text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
  secondary:
    'border border-neutral-200 bg-white text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  // OUTLINED, where primary is solid. It was byte-identical to primary, which made "Delete
  // forever" the loudest control on its screen and the only thing between it and a deleted
  // post a native confirm(). Monochrome can still rank three weights: a solid fill for the
  // action you came to do, a strong outline for one that destroys something, and secondary's
  // faint border for everything else. It inverts on hover, so it does not read as disabled.
  danger:
    'border border-neutral-900 bg-transparent text-neutral-900 hover:bg-neutral-900 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-neutral-900',
}

// `whitespace-nowrap` and `shrink-0` are load-bearing, not tidying. In a flex row beside
// anything long, a button with neither gets squeezed until its own LABEL wraps: the MCP card
// shipped "Tạo token" broken across two lines and twice as tall as the row it sat in. A
// button is a fixed object; it is the text beside it that gives way.
const SHAPE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

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
