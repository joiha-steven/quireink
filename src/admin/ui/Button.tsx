// Reusable button with a few visual variants.
//
// The class strings moved to `@/admin-kit` on 2026-09-14, where the server can read them too
// (ADR 0054). `buttonClass` is re-exported: the rule it was written for is unchanged — an `<a>`
// that wants to look like the primary action asks for the string rather than re-typing it.
import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from '@/admin-kit'

export { buttonClass }

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}
