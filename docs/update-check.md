# What this blog tells us, and how to stop it

The same protocol is in the header of
[`src/server/update-check.ts`](../src/server/update-check.ts); a change to one is a change to
both, and to the eleven translations of the sentence the Settings screen shows.

Once a day, on the first visit your blog gets — or on its own hourly clock if nobody visits
that day — it asks `check.quireink.com` what the newest release is. That one request does two
jobs: you find out an update exists, and by asking, your blog is counted as one that is being
used. There is no second call and no separate telemetry service.

Since 2026-08-29 the hourly clock asks too, so a quiet day still counts.

## And the other direction: what you just installed

The check above tells you when something **newer** exists. It cannot tell you what the
release you are already running actually is — you updated by pulling an image, and nothing
in that act says what changed.

So the admin shows a panel, **once**, after an upgrade: the version you are now on and a link
to its release notes. It asks the server nothing; it compares two strings it already has.

One setting decides it. `seenRelease` is the release this blog has already been shown, and
the last step of setup stamps it, so a fresh install never meets the panel for the release it
was installed on.

| `seenRelease` | What happens |
|---|---|
| the release you are running | nothing |
| an older release | the news, once |
| **empty** | the news, **and** the question about how the site looks |

Empty means the settings row predates the field, which is the one thing the panel can tell:
a blog installed before the four dialects existed never saw the setup step that asks which
one it wants, so the panel asks there instead. Pressing one saves it straight away; pressing
Done records the release and the panel does not come back.

This is the whole request:

```
GET https://check.quireink.com/releases.json?v=2.2.2&t=8f2c91a04b7e&d=1&new=1&a=3&p=2&i=docker&l=vi
```

| | |
|---|---|
| `v` | the version you are running |
| `t` | `sha256(a secret only your blog has + today's date)`, first 12 characters |
| `d` | `1` if your site has a public address, `0` if it is still on a laptop |
| `new` | sent once ever, on the first check a new database makes |
| `a` | roughly how old the blog is: today · within a week · a month · a quarter · older |
| `p` | roughly how much is published: nothing · up to 5 · up to 25 · more |
| `i` | `docker`, `source`, or the name an install template gave itself (`unraid`, `synology`, …) |
| `l` | the language your admin screen is in |

**The last four are steps, never numbers**, and that is deliberate rather than shy. A blog
that says "between six and twenty-five posts" shares that answer with thousands of others; a
blog that said "seventeen" would be identifiable the next time it was seen. They exist so the
project can tell a blog somebody still runs from a container somebody made and deleted, and
so eleven translations are not maintained blind. Each is stored on its own at the other end
and never crossed with another.

**`t` is rebuilt from a new date every midnight**, so today's count is exact and nothing
links it to yesterday's. Counting by address would have been the easy way and it is wrong
here: one machine can run a hundred blogs, and then a hundred blogs count as one.

**Not sent, at all:** your address, your blog's name, your posts, your readers, your traffic
figures, your email. The answer is a static file naming the newest release, and it is the same
file for everybody.

**What the other end sees anyway, and what it does with it.** Every HTTP request carries a
source address; there is no version of this that does not. Until 2026-08-29 the receiving log
was written without one, and it now records a coarse **network** instead — `/24` for IPv4
(up to 254 hosts, and far more behind carrier-grade NAT), `/32` for IPv6. Never an address,
and never anything that names a machine.

It exists to answer one question the daily token cannot: a fresh database mints a fresh
token, so one person recreating a container four times is indistinguishable from four people.
Networks tell those apart. The hourly roll-up turns them into a single integer — "eleven
blogs, from nine networks" — and **the integer is kept while the network is not**: it reaches
no stored file, and that log alone is rotated at two days rather than fourteen. The
alternative on the table was collecting each blog's domain, which would have made the count
identifiable rather than accurate; this was chosen instead.

Turn it off with `UPDATE_CHECK=0` in the environment, or in Settings → Server & connections → This install.
Off means your blog makes no outbound request of any kind. Nothing updates itself either
way: knowing a release exists and installing it are separate acts, and the second one is
yours ([self-host.md, section 9](self-host.md#9-upgrading)).

**It also stays quiet on its own while somebody is working on the software** — under
`bun --watch` (which is what `bun run dev` is) and under `bun test`. An afternoon of
development is not an install, and the software works that out rather than asking you to
declare it. The dashboard shows a dot beside the version once it knows: amber when a newer
release is out, green when you are on it, and nothing at all when it has not been told
recently, because "up to date" is a claim and a stale answer cannot make it.

The code is [`src/server/update-check.ts`](../src/server/update-check.ts), which is short
and says the same thing this section does.

**One more outbound exists, and only if you build it yourself by pasting a key.** Give
Settings → Server & connections an AI key (Anthropic, OpenAI, Gemini or DeepSeek) and pick a model
that can see images, and each image you upload is sent to that provider once, to have its
alt text written. A text-only model leaves this job switched off and says so. Your key, your provider,
your bill; the site's language is the answer's language; and removing the key removes the
behaviour entirely. Without a key this path does not run — not quietly disabled, but
never entered ([`src/media/alt-text.ts`](../src/media/alt-text.ts) declines before any
network is touched).
