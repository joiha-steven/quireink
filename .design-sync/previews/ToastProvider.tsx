import { ToastProvider, Card, Button } from 'quireink'

// ToastProvider renders its children plus a fixed bottom-right stack. Nothing is in that stack
// until `useToast().notify()` fires, which a static preview cannot do, so the card shows the
// wrapper doing its real job: hosting a screen that is allowed to confirm a save.
export function WrappingAScreen() {
  return (
    <ToastProvider>
      <Card title="Integrations" actions={<Button variant="primary">Save</Button>}>
        <p className="text-sm text-neutral-600">
          Saving here is confirmed by a toast, which is the only confirmation the admin gives.
          It is announced to screen readers: `status` for a success, `alert` for a failure.
        </p>
      </Card>
    </ToastProvider>
  )
}
