// Quire Ink on Bun. The boot lives in `src/runtime/bun/main.ts`, beside everything else only Bun
// runs (ADR 0066, `src/runtime/ports.ts`); this file stays because `bun src/index.ts` is what every
// systemd unit, the image and install.sh were told to start, and that must keep working.
import './runtime/bun/main'
