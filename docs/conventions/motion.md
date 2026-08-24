# Motion — one engine, token-gated (HARD RULES)

- **`--dur-fast` .15s · `--dur-base` .2s · `--dur-slow` .5s**, in `public.css.ts` `BASE_CSS`
  (2026-08-11; promised here since the frozen tree, absent for all of 2.0). **No `--ease` token:
  its value would be the keyword `ease`, and the scroll-driven animations must stay `linear`.**
  The reasoning, and the count that settled it, is at the definition.
- ⚠️ **The sign-in page has no `--dur-*`** — it is served `pageStyles + LOGIN_CSS`, not the public
  sheet, so a `var()` there silently drops the transition. `login.css.ts` keeps literals, and says
  so at the line.
- **ONE switch gates ALL visual motion.** `<html data-motion>` is server-rendered from `settings.motion.enabled`
  (no flash, no client JS); `html[data-motion='off']` AND `@media (prefers-reduced-motion: reduce)`
  each set `animation:none!important;transition:none!important` on `*` — instant, no branching.
  ⚠️ They do NOT zero `--dur-*` (measured: still `.2s` with the switch off), so never read a token
  in script to decide whether to animate; read the media query and the attribute. Toggle in
  Admin → Appearance → Rendering. Don't add a second motion gate.
- `settings.motion.keys` is a scoped editor preference, not another global motion engine. It
  enables the custom caret/line response and synthesized key sound; its visual parts must still obey
  the master motion gate and reduced-motion preference. Audio is generated locally, at the level
  `settings.motion.keyVolume` names, and must ignore IME composition, modifiers/navigation, paste
  and held-key repeats. ⚠️ Sound is NOT gated by the motion engine or by reduced-motion: a person
  who asked for less movement did not ask for silence, and the two settings are not the same
  request. Nothing in that path may animate the text.
- **Cheap properties only** (`opacity`/`transform`/colour) so motion never causes CLS or jank; entrance
  effects must default to fully-visible (e.g. `.reveal` is gated behind `@supports (animation-timeline)`
  + `data-motion='on'`) so unsupported browsers / motion-off never hide content. There is no page-nav
  cross-fade in 2.0: cross-document View Transitions were considered and not shipped
  ([`spec/04-frontend.md`](../spec/04-frontend.md)).
