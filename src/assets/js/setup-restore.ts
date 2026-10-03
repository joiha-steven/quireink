// The bundle `/setup/restore` loads, and nothing else does (`web/setup-restore.ts`). The form's
// script lives in `restore-form.ts`, where a test can import it without it running.
import { setupRestore } from './restore-form'

setupRestore()
