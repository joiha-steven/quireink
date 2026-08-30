// The environment a test is entitled to assume.
//
// `getIntegrationKeys()` falls back to same-named env vars when the database holds no key,
// which is the right behaviour for a container and a trap for a test: every assertion of
// the form "does nothing without a key" quietly depends on the machine not having one.
//
// It is not hypothetical. A `.env` holding `AI_PROVIDER` and `AI_API_KEY` — the obvious
// thing to write while testing the assistant against a real provider — turned seven green
// tests red at once, in four files, none of which mentions an environment variable. The
// failures read as a broken comment guard and a broken excerpt job.
//
// So the tests that assume nothing is configured now SAY so.

const PROVIDER_ENV = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL'] as const

/** Forget any AI provider the machine has configured, for the length of this test file. */
export function withoutProviderEnv(): void {
  for (const name of PROVIDER_ENV) delete process.env[name]
}
