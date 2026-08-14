// Theme button + dropdown: Light / Dark / System / By time.
import { useState, useSyncExternalStore } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/i18n/i18n'
import { ICON_BTN } from '@/admin/ui/iconButton'
import { useTheme, type ThemeMode } from '@/admin/ui/ThemeProvider'

// Reflect the actually-applied theme by reading the <html> `dark` class (set by
// the no-FOUC script + ThemeProvider). useSyncExternalStore gives a stable server
// snapshot (light) so hydration matches, then tracks the real class on the client
// — re-rendering whenever the class flips (mode change, OS change, clock).
function subscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}
function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

const ICON = 'h-5 w-5'
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} {...STROKE} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} {...STROKE} aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

// `variant` picks the trigger: 'icon' (public header — sun/moon) or 'text'
// (admin header — the applied theme as a word, styled like the nav links via
// `triggerClassName`). The dropdown is identical in both.
//
// TWO booleans rather than more variants, because the admin rail needs all four combinations
// and `variant` was being asked to carry three unrelated answers at once — the trigger's
// class, whether it draws a glyph, and which side the menu opens on. In a COLLAPSED rail this
// row is a glyph with no word, in an expanded one a word with no glyph, and in both it must be
// the same 47px row object as every other line in the rail. Measured collapsed on 2026-08-15:
// the sun sat at x-centre 32 against 36 for the two rows under it, because `variant='icon'`
// ignored `triggerClassName` and fell back to the PUBLIC header's `ICON_BTN`.
//
// `menuSide` stays tied to `variant`: an admin rail is against the left edge, so the menu opens
// beside it, not under it.
export function ThemeToggle({
  lang,
  variant = 'icon',
  showIcon = true,
  showLabel = true,
  triggerClassName = '',
}: {
  lang: SiteLang
  variant?: 'icon' | 'text'
  showIcon?: boolean
  showLabel?: boolean
  triggerClassName?: string
}) {
  const { mode, setMode } = useTheme()
  const [open, setOpen] = useState(false)
  const isDark = useIsDark()
  const s = t(lang)

  const items: { key: ThemeMode; label: string }[] = [
    { key: 'light', label: s.themeLight },
    { key: 'dark', label: s.themeDark },
    { key: 'system', label: s.themeSystem },
    { key: 'time', label: s.themeTime },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={s.theme}
        className={triggerClassName || (variant === 'text' ? '' : ICON_BTN)}
      >
        {variant === 'text' ? (
          <>
            {showIcon && (isDark ? <MoonIcon /> : <SunIcon />)}
            {showLabel && <span>{isDark ? s.themeDark : s.themeLight}</span>}
          </>
        ) : isDark ? <MoonIcon /> : <SunIcon />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className={`absolute z-50 w-44 overflow-hidden border py-1 shadow-lg ${variant === 'text' ? 'bottom-0 left-full ml-2 border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900' : 'right-0 mt-2 border-rule bg-bg'}`}>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => {
                  setMode(it.key)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left t-small ${variant === 'text' ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800' : 'hover:bg-rule'} ${
                  mode === it.key
                    ? variant === 'text' ? 'font-semibold text-neutral-900 dark:text-white' : 'font-semibold text-heading'
                    : variant === 'text' ? 'text-neutral-500 dark:text-neutral-400' : 'text-meta'
                }`}
              >
                {it.label}
                {mode === it.key && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
