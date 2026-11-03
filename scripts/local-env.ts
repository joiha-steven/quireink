// The environment of every blog a script starts on this machine — a tour, a screenshot run, a
// matrix cell, the Cloudflare smoke — and the one thing none of them may do: report.
//
// A server started the real way asks check.quireink.com once a day and is counted by asking
// (`src/server/update-check.ts`). These are not installs, and `check:local-instances` fails a spawn
// under `scripts/` that does not take its environment from here. A caller who set UPDATE_CHECK
// keeps it: that is how the check itself is tested on purpose.

/** `UPDATE_CHECK` as the caller set it, else `0`. */
export const updateCheck = (): string => process.env.UPDATE_CHECK ?? '0'

/** The caller's environment with the update check off unless asked for. */
export function localEnv(): Record<string, string | undefined> {
  return { ...process.env, UPDATE_CHECK: updateCheck() }
}
