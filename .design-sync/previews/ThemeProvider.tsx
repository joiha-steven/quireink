import { ThemeProvider, ThemeToggle, Card, Button } from 'quireink'

// A provider has no look of its own — it supplies context. The honest card is therefore what
// it ENABLES: ThemeToggle only works inside it, and the light/dark class it writes on <html>
// is what every `dark:` utility in the system keys off.
export function WrappingItsConsumer() {
  return (
    <ThemeProvider>
      <Card title="Appearance">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-600">
            Light, dark, follow the system, or switch by the clock.
          </p>
          <ThemeToggle />
        </div>
      </Card>
    </ThemeProvider>
  )
}

export function AroundAScreen() {
  return (
    <ThemeProvider>
      <div className="flex items-center gap-3 p-4">
        <Button variant="primary">Save</Button>
        <Button variant="secondary">Preview</Button>
        <ThemeToggle />
      </div>
    </ThemeProvider>
  )
}
