import { ThemeToggle, ThemeProvider, Card } from 'quireink'

// A single icon button that opens a four-mode dropdown: light, dark, follow the system, or
// switch by the clock. Closed it is one small glyph, so the cells give it the chrome it sits
// in rather than stranding it on an empty card.
export function InTheRail() {
  return (
    <ThemeProvider>
      <div className="flex w-56 items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-700">
        <span className="text-sm font-medium">Appearance</span>
        <ThemeToggle />
      </div>
    </ThemeProvider>
  )
}

export function InACardHeader() {
  return (
    <ThemeProvider>
      <Card title="Appearance" actions={<ThemeToggle />}>
        <p className="text-sm text-neutral-600">
          The chosen mode is stored; the resolved light or dark is applied as a class on the
          document, which is what every `dark:` utility keys off.
        </p>
      </Card>
    </ThemeProvider>
  )
}
