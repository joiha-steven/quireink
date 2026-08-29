# 0037 — An MCP token carries a scope, and a read token cannot reach a write tool

Date: 2026-08-29
Status: accepted

> Also written after the fact, in the same audit that produced
> [0036](0036-the-blog-asks-for-updates-and-is-counted-by-asking.md). The change shipped in
> `ea5c5b8` with schema step 008; a permission model with a migration behind it is what this
> directory is for, and it had no file.

## Context

The MCP server ([`src/mcp/`](../../src/mcp/)) hands an assistant the blog: it can read the
archive, and it can write, publish, trash, moderate comments, change settings and mint
backups. A token was a single kind of thing — hold one, hold all of it.

That is the wrong shape for what the tools are actually used for. "Report on last month's
traffic", "check the archive for broken links", "tell me which posts have no alt text" are
read jobs, and they are the ones most likely to be handed to a client the owner does not
control or has not audited. Handing a token that can also empty the trash, in order to run a
report, is a permission the task never needed.

There was a second door open beside it: the MCP OAuth loopback flow auto-approved on `GET`,
so any web page could walk a signed-in owner into handing an authorization code to whatever
happened to be listening on a local port.

## Decision

**A token is minted with a scope: `full` or `read`.** Column on `mcp_tokens`, `check`
constrained, schema step 008, chosen at mint time in the admin, in all eleven languages.

**A read token does not see write tools — it does not merely refuse them.** The scope is
applied where the tool list is *registered*, not inside each handler: the read door registers
only the tools whose `ToolMeta` carries `readOnly: true`. An assistant holding a read token is
told the blog has nineteen tools, and the twentieth is not something it can try and be
rejected for. A filter that runs per call is a filter somebody forgets to write on the tool
they add next week; a door that never mounts the tool cannot forget.

**`readOnly` is opt-in, so an unmarked tool is a WRITE tool.** The dangerous default is the
one that fails safe: a new tool added without thinking about scope is absent from the read
door rather than silently present in it. `src/mcp/scope.test.ts` pins the nineteen names, so
adding a tool to the read set is a deliberate edit to a test rather than a side effect.

**`full` stays the default**, so every connector already in use keeps working and nobody is
locked out of their own blog by an upgrade.

**And the loopback flow goes through the consent page.** `GET` auto-approve is removed; the
owner sees what is asking and approves it.

## Consequences

- **Invariant 1 is enforced at this door too.** Write tools are wrapped so the cache is
  flushed in a `finally`, the same structural guarantee the owner router gained in the same
  change — a write through MCP cannot leave a stale public page behind because a handler
  forgot a call.
- **`read` is a floor, not a sandbox.** It bounds what an assistant can *do*; it does not
  make what it can *read* less sensitive. Draft posts and traffic figures are still the
  owner's. A token handed to a third party is still a decision.
- **The scope is fixed at mint.** Changing a token's power means minting a new one and
  revoking the old, which is the behaviour that keeps the column honest.
- **Existing tokens are `full`** by the migration's default. This grants nothing new; it
  names what they already were.
- Nothing about the owner's own sign-in changes ([0007](0007-self-hosted-password-totp-auth.md),
  [0030](0030-two-factor-can-wait-until-there-is-an-address.md)). Different client, different
  mechanism — as 0007 already said.
