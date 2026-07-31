# 0015 — Relicense from MIT to PolyForm Noncommercial 1.0.0

Date: 2026-07-31
Status: accepted

## Context

Quire shipped under MIT from the start. MIT grants everything: use, modify, redistribute,
sublicense and **sell**, with no obligation even to credit. The owner's stated intent is
narrower than that. What was actually wanted was: anyone may read, run, change and share
this freely, and nobody may make money from it.

Three families of licence were compared against that sentence.

**A "no modification" licence.** The first phrasing of the intent was "free to use, no
commercial use, no changes to the code". By name that is CC BY-NC-ND 4.0, and for software
specifically it is PolyForm Strict 1.0.0, which removes distribution and modification and
leaves only noncommercial use. Both were rejected on the same ground: Quire is a self-hosted
blog engine with a `docs/self-host.md`. Under those terms an operator could not patch a
security hole, could not build a container image, could not publish a fork, and arguably
could not edit a value that lives in code. "Self-hosted" and "you may not change it" do not
belong in the same product. Creative Commons additionally advises against CC for software:
no source-code terms, no patent grant, incompatible with the major software licences.

**AGPL-3.0.** Considered seriously and rejected on a factual reading, not a preference.
AGPL is a genuine open-source licence, keeps the GitHub badge, lets operators patch, and its
§13 network clause blocks the specific move of forking Quire into a closed SaaS. But **AGPL
does not restrict commercial use at all.** A company may sell Quire hosting, may run it for
a commercial site, and may charge for a modified version; the only obligation is to offer
their Corresponding Source to users of the service. AGPL substitutes "nobody may close it"
for "nobody may profit from it". That is a different goal from the one being pursued.

The dependency tree was checked before AGPL was set aside, so the result is recorded here
rather than lost: **every one of the 331 packages under `node_modules` is compatible with
copyleft.** 294 MIT, 20 ISC, 7 BSD-2/3-Clause, 4 Apache-2.0 (`sharp`, `typescript`), 3
MPL-2.0 (`satori`, `lightningcss`, which carry the Secondary License clause), 1
`Apache-2.0 AND LGPL-3.0-or-later` (`@img/sharp-win32-x64`), 1 MIT-0 (`nodemailer`), 1
Python-2.0, 1 0BSD. No GPL-only package, nothing proprietary, nothing unlicensed. If the
licence is ever revisited, AGPL remains available with no dependency work.

**PolyForm Noncommercial 1.0.0.** Grants use, modification, distribution and a patent
licence for any noncommercial purpose, and defines that purpose broadly: personal use,
research, study, hobby and amateur work, plus charities, educational institutions, public
research organisations, health and safety bodies, environmental organisations and
government, regardless of how they are funded. Commercial use is simply outside the grant.

## Decision

The code in this repository is licensed under **PolyForm Noncommercial 1.0.0**. Commercial
use requires a separate licence from the owner, which the README says to ask for.

Consequences accepted deliberately:

- **Quire is no longer open source.** It is source-available. The OSI definition forbids
  discrimination against fields of endeavour, and a noncommercial clause is exactly that.
  Every place the repository claimed "open source" has been corrected rather than softened,
  including the admin UI string in all six languages. Calling it open source anyway would
  be the kind of small lie that costs trust later.
- **GitHub will show "Other".** PolyForm is in the SPDX list but not in GitHub's own licence
  set, so no badge. `package.json` carries the SPDX id `PolyForm-Noncommercial-1.0.0` so
  machine-readable tooling still resolves it.
- **Corporate users will stay away.** Many companies ban noncommercial licences outright.
  That is the intended effect, not a side effect.
- **The change is not retroactive, and cannot be.** Everything published up to and including
  v2.0.0 was released under MIT, and every copy taken under MIT keeps MIT rights to that
  code permanently, including the right to fork and sell it. At the time of writing the
  repository has 0 forks and 2 stars, so the practical exposure is small, but the legal
  position is fixed: this changes the terms going forward only.

The relicense is clean because **the repository has exactly one contributor** (544 of 544
commits), so no third party's permission was needed. Keeping that property is now load
bearing: `CONTRIBUTING.md` states that opening a pull request grants the owner the right to
relicense the contribution, including commercially. Merging one outside pull request without
that grant would permanently remove the ability to sell a commercial licence.

## Notes

The blog **content** licence is unchanged and unrelated: articles and images published with
Quire on an operator's site are the author's, all rights reserved, and were never covered by
the code licence. The scope note that used to sit appended to the MIT text has moved into
`README.md`, so `LICENSE` holds the licence text and nothing else and SPDX matchers can
identify it.

None of this is legal advice, and it was not reviewed by a lawyer.
