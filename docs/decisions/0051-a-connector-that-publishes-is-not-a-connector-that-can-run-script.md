# 0051 — A connector that publishes is not a connector that can run script

Date: 2026-09-13
Status: accepted · narrows the `full` scope from [0037](0037-an-mcp-token-carries-a-scope.md); existing tokens keep their scope and lose four settings
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

MCP tokens carried two scopes. `read` sees only the tools marked `readOnly`; `full` sees
every tool. `full` was the default, and it is what every token minted before scopes existed
became.

`update_settings` takes a dotted path and a value and can reach any of the 170 settings in
`SETTING_PATHS`. The
argument for letting it is that the value goes through `saveSettings` — the same sanitiser,
clamp and refusal the owner's own Save button uses — so nothing reachable over MCP is
anything the owner's screens could not already do.

That argument holds for 166 of them. It does not hold for four, because for those the
sanitiser's job is to keep the text intact:

- `customHead` and `customBodyEnd` are written verbatim into the `<head>` and before
  `</body>` of every public page (`web/layout.ts`). A `<script>` there runs on the site's own
  origin. The admin is on that origin, the session cookie is scoped to it, and the owner
  visits their own site. So a token that can write those two can act as the owner.
- `customCss` can take the reading page off the air.
- `siteUrl` decides what every canonical link, feed entry, OG tag and newsletter link points
  at.

So the grant an owner thinks they are making when they connect an assistant that writes for
them — draft, tag, schedule, publish — was the same grant as "may put code on my readers'
screens and on mine". Nothing on the mint screen said so, and nothing had to be done wrong
for it to be true: it was the default.

The nearest thing to a defence was elsewhere and did not cover this. The in-admin assistant
asks the owner before `update_settings` (`server/assistant-consent.ts`), but that is the
assistant's own gate; an external connector holding a token talks to `/api/mcp` and meets no
such thing. That is correct — the owner minted the token — which is exactly why the token
needed to be able to mean less than it did.

## Decision

A third scope, `admin`, sitting above `full`. It is `full` plus the four settings above.

`full` is refused those four paths at the door: the transport checks the arguments before
calling the handler (`mcp/guarded-paths.ts`, applied in `web/admin/mcp-transport.ts`), the
same shape as the read gate and as Invariant 4 — a rule about which door a call came through
cannot be forgotten by a handler that does not know there are doors. The refusal names the
paths, says the owner can make the change in Settings, and tells the model not to retry.

**Existing `full` tokens narrow.** They keep their scope and lose the four paths on upgrade.
A change that left old grants at their old width would protect nobody already holding one,
which is the population the problem is about.

**The OAuth flow never mints `admin`.** A connector negotiating a scope string is not the
owner ticking a box, and the consent page has no wording for "may put script on every page".
The grant is mintable only by hand, from the token card in Settings, with its own checkbox
and its own sentence saying what it allows.

## Consequences

- A connector that legitimately edits custom code needs a token minted for it. That is rare,
  and being rare is the point: nobody should hold the grant by default.
- The line is drawn by ARGUMENTS rather than by tool, because it runs through one tool:
  `update_settings` is ordinary for every other path. `update_appearance` needs nothing here
  — every one of its inputs is an enum of the owner's own menu options.
- Three scopes is one more thing to understand at mint time. The screen carries two
  checkboxes rather than a three-way control, and the second is disabled while the first is
  ticked, because "reads nothing but may set custom head HTML" is not a thing anybody means.
- `mcp_tokens` was rebuilt to widen its CHECK constraint (migration `015-mcp-admin-scope`);
  SQLite cannot alter one in place. Every row keeps the scope it had.
