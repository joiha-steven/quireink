# 0023 — Commercial use of an unmodified release is allowed. A modified copy sold is not

Date: 2026-08-16
Status: accepted
Amends [0015](0015-relicense-polyform-noncommercial.md), which stays in force for everything else.

## Context

0015 relicensed the project from MIT onto PolyForm Noncommercial 1.0.0, on this sentence:
"anyone may read, run, change and share this freely, and **nobody may make money from it**."

Two weeks of living with that sentence showed the second half was one clause too wide. What
the owner objects to is not money changing hands near the software. It is someone taking the
code, changing it, and presenting the result as their own product. PolyForm Noncommercial
blocks both, and only the second one was ever the point.

The two cases are not alike. A hosting company that installs published releases and sells the
operation of them takes nothing away from the author: it runs his code, under his name, with
his notices intact, and every improvement it wants has to come back upstream, because a fork
is the one thing it may not sell. That is a distribution channel. A company that forks the
code, renames it and sells the fork is the case worth blocking, and it stays blocked.

Two alternatives were weighed and set aside.

**Keep 0015 and grant individual commercial licences on request.** It already works this way
and the README already says to ask. But it makes every operator write an email first, and
most will pick something with a licence file that answers on its own.

**PolyForm Strict 1.0.0.** It removes the distribution and modification grants, which is the
right half of the shape. It does not help with the other half: its permitted purposes are the
same noncommercial list, so it does not open commercial use either. CC BY-ND was reconsidered
for the same reason it lost in 0015 — Creative Commons advises against CC for software — with
one more against it: "no derivatives" reaches distribution, and a modified copy that is only
ever run as a service is never distributed. That case is exactly the one being guarded, so a
licence that misses it is not a licence for this product.

## Decision

The licence stays **PolyForm Noncommercial 1.0.0**, unchanged, in `LICENSE`.
[`LICENSE-EXCEPTION.md`](../../LICENSE-EXCEPTION.md) grants one additional permission on top
of it: **use and run the software for any purpose including a commercial one, and charge for
it — paid hosting included — provided what you run is a published release with its source
unchanged**, the notices stay, the service says it runs Quire Ink and links back, and what is
sold is the service rather than the software. Fixing a defect or a security hole in your own
deployment is carved out, reportable within 30 days. Commercial use of a modified version
still needs a separate licence from the owner.

Consequences accepted deliberately:

- **Still not open source.** The restriction moved from "no commercial use" to "no commercial
  use of a modified copy", which is still discrimination against a field of endeavour. Nothing
  in the repository may start calling this open source.
- **`package.json` loses the SPDX id**, moving to `SEE LICENSE IN LICENSE`. Keeping
  `PolyForm-Noncommercial-1.0.0` would now understate the grant, and a scanner reading it
  would turn away precisely the operator this decision admits. `LICENSE` still holds the
  PolyForm text and nothing else, so text matchers identify the base licence as before.
- **"Unmodified" is load bearing and unenforceable by machine.** A host that quietly patches
  a feature in is in breach, and nothing in the software will ever notice. Detection is not
  the point; having the boundary written down before it matters is.
- **The hosted product from [0021](0021-hosted-quire-ink-one-process-per-blog.md) is no longer
  the only one allowed to exist.** Someone else may now run that same shape commercially. The
  owner's advantage becomes being upstream rather than being the only permitted operator,
  which is the trade this decision buys adoption with.
- **Permission only adds.** Copies taken before this release keep the terms they were given;
  they are not retroactively narrowed, and they simply do not carry the new permission.

The single-contributor property from 0015 still holds and is still load bearing:
`CONTRIBUTING.md` continues to require that a pull request grant the owner relicensing rights,
now naming the exception alongside the licence.

## Notes

The permission ships in both project languages, as `LICENSE-EXCEPTION.md` and
`LICENSE-EXCEPTION.vi.md`, the same pairing the README uses. **English governs**, and the
Vietnamese file says so in its own first lines — a translated licence that does not name which
version wins is a second licence, not a translation.

The blog **content** licence is unchanged and unrelated: what an operator publishes is the
author's, and was never covered by the code licence.

None of this is legal advice, and it was not reviewed by a lawyer.
