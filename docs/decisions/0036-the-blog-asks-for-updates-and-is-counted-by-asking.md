# 0036 — The blog asks for updates, is counted by asking, and does it by default

Date: 2026-08-29 (recording a decision taken 2026-08-21)
Status: accepted

> Written after the fact. The decision was made on 2026-08-21, built in `f1b365e`, widened in
> `ea1432d`, and documented three times over — [`update-check.md`](../update-check.md), the
> header of [`src/server/update-check.ts`](../../src/server/update-check.ts), and eleven
> translations of the sentence Settings shows the owner. All three say WHAT is sent. None of
> them is an ADR, so the *argument* for the default lived only in a commit message. An audit
> of this index on 2026-08-29 found the gap; this file closes it. Nothing here is new — every
> line is taken from the record cited above.

## Context

The question, on 2026-08-21: is there any way to know how many people actually use Quire Ink?

The honest answer was no, and the reason is worth keeping: **you cannot count people, only
machines, and only machines that agree to say something.** The proxies available all lie in
the same direction. Docker Hub showed 168 pulls against 0 stars; GitHub showed 1,268 clones
from 286 sources against 35 humans who opened the repository page in fourteen days. The gap
between clones and page views is the signature of robots, and it is what every public counter
was actually measuring.

Meanwhile the project was making build decisions blind. Eleven translations were being
maintained with no way to know whether any of them had a single user, and
[0002](0002-no-saas-single-instance.md)'s premise — *"nobody depends on it"* — had quietly
stopped being true without anyone being able to say by how much.

## Decision

**One request a day, to `check.quireink.com`, doing two jobs: it tells the blog a newer
release exists, and by arriving it counts the blog as one in use. It is ON by default.**

There is no second call and no telemetry service — the answer is a static `releases.json`,
the same bytes for everybody.

**On by default, and that is the decision this file exists to record.** From `f1b365e`:
*"Off by default would have made the number meaningless, which the owner knew when choosing
it."* An opt-in counter counts the people who opt in, which is a self-selected sample of
unknown size — it would have cost the same code and answered nothing. The default is paid
for by the four limits below, not by asking quietly.

**What makes the default defensible, and each of these is load-bearing:**

1. **Two off switches, and off means silent.** `UPDATE_CHECK=0` for an operator running blogs
   for other people, and the owner's own switch in Settings → System. Off means the blog makes
   no outbound request of any kind.
2. **Nothing that survives the day.** The identifier is `sha256(this blog's own secret +
   today's UTC date)`, first 12 hex characters, rebuilt at every midnight. Today's count is
   exact; yesterday's cannot be linked to it.
3. **Steps, never values.** Age, size, install kind and admin language are coarse buckets. A
   field precise enough to be a fingerprint would hand back what the daily token just took
   away: with a dozen blogs checking in on one day, an exact post count beside a country names
   an install as surely as its domain would.
4. **Never the address, the title, the writing, the readers, or any exact count.** The
   sentence the owner reads before deciding says so in eleven languages, and it moved with the
   protocol when the coarse post count was added — *"leaving that text alone would have made
   the software lie to the person holding the switch."*

**Rejected, and why:**

- **Counting by IP address.** Easy, and wrong for the shape this product is licensed for: one
  process per blog ([0021](0021-hosted-quire-ink-one-process-per-blog.md)) means a hundred
  blogs behind one address would count as one.
- **Collecting each blog's domain.** It would have made the count identifiable rather than
  accurate. The receiving log keeps a coarse **network** instead (`/24` for IPv4, `/32` for
  IPv6), rolled up hourly into an integer, with the network discarded and that log rotated at
  two days — it exists only to tell one person recreating a container four times from four
  people, which the daily token deliberately cannot do.
- **A separate telemetry endpoint.** One request that already had a reason to exist is
  cheaper to run, cheaper to explain, and impossible to forget to switch off.

## Consequences

- **A developer's afternoon is not an install.** The check stays quiet under `bun --watch`
  (which is `bun run dev`) and under `bun test`. The software works this out rather than
  asking anyone to declare it.
- **The trigger changed once, and the first reasoning was wrong.** It began as middleware on
  the public request path, on the argument that *"a cron says this process was running at
  midnight, which a forgotten container on a shelf also says; the first public request of the
  day says somebody used this blog"* — and *"a blog nobody reads is never counted, on
  purpose."* That undercounted by an amount nobody could measure: a healthy blog with a quiet
  day was invisible, and on a personal blog most days are quiet. Since `ea1432d` the hourly
  tick fires it too, and the question "is this a container on a shelf" is answered by the
  coarse **age** bucket instead. Age is the field that earns its place; the daily token can
  never answer it.
- **The receiving end is not in this repository.** It is a static file and an nginx log on
  sv3, in the private sibling, per [0017](0017-move-state-and-instance-config-private.md).
- **Three copies of the protocol move together or not at all** — this file's citations. A
  field added without touching the owner-facing sentence fails a test, on purpose.
- **The count is a STATE, not a total.** "Alive" is how many blogs checked in on a given day;
  adding days together counts the same blog repeatedly.
- Knowing a release exists and installing it stay separate acts. Nothing updates itself.
