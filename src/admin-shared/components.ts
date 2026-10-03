// EVERY MODULE THAT REGISTERS A COMPONENT, imported for that and nothing else.
//
// `component()` records a name when the module calling it is evaluated, so the build can only
// give the stylesheet the names of modules it has loaded. This is the one list of them, read by
// `scripts/build-admin.ts` and `scripts/checks/admin-css.ts`. A module that registers a
// component and is missing here has its names left without a rule — and `check:admin-css` says
// so, because it also finds every `component('kit-…'` written in the source and asks the built
// sheet for each.
import '@/admin-shared/kit'
import '@/admin-shared/controls'
import '@/admin-shared/tabs'
import '@/admin-shared/scale'
import '@/admin-shared/rail'

export { registeredComponents } from '@/admin-shared/component'
