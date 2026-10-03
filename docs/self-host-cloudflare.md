# Quire Ink on Cloudflare (beta)

> A blog with no machine to keep: a Worker and one Durable Object in your own Cloudflare account
> ([ADR 0066](decisions/0066-cloudflare-is-a-second-runtime.md)). How it differs from a Bun install:
> [runtimes.md](runtimes.md). Every way to install: [install.md](install.md).

## What you need, and why it is not the Free plan

**Workers Paid, $5 a month per account** — not "Pro", which is a website plan this does not use. One
plan covers every blog in the account. The Free plan is not supported, for reasons a blog owner
feels on a bad day rather than on a good one:

1. **It stops the blog at 100,000 requests a day.** A view is two requests (the page and its
   counter), so at about 50,000 views the blog answers with errors until 00:00 UTC — on exactly the
   day a post is shared widely. Paid has no daily cap; past what is included it bills, and keeps
   serving.
2. **It cannot send mail**: the newsletter, comment notices and sign-in recovery would all need an
   outside mail service. Paid includes 3,000 messages a month.
3. **It refuses writes past 100,000 rows a day**, autosave included.
4. **It cuts long jobs at 50 outgoing requests**: fediverse delivery, link cards, importing pictures.
5. **It saves no step**: R2, where pictures live, asks for a card on file on either plan.

What a typical blog costs on Paid, from the included amounts (10 million requests, 1 million
Durable Object requests, 50 million rows written, 5 GB of SQLite, 3,000 emails, 10 GB of R2, 5,000
image transformations a month): **$5.00** for 100,000 views a month; about **$5.50** for a million.

## With the Deploy to Cloudflare button (the easy way)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/joiha-steven/quireink/tree/release)

No terminal and nothing to install. Cloudflare copies this repository into your GitHub or GitLab
account, builds it on its own machines and deploys it into your account
([how the button works](https://developers.cloudflare.com/workers/platform/deploy-buttons/)).

1. **Move the account to Workers Paid first** (Workers & Pages → Plans). The button does not look at
   the plan: on Free it deploys a blog that works until the first busy day, for the reasons above.
2. **Click the button**, sign in to Cloudflare and connect GitHub or GitLab. The copy it makes is a
   new repository of yours, not a fork; from now on it is the source your blog is built from.
3. **On the setup page:**
   - the **Worker's name** is also the blog's first address, `https://<name>.<your subdomain>.workers.dev`;
   - keep the bucket name **`quireink-blobs`** unless the account already has one by that name
     ([why it matters later](#upgrading));
   - **`SETUP_CODE`**: twelve characters or more that you make up and keep to yourself. It is how you
     claim the blog, and whoever types it first owns it;
   - leave the build and deploy commands as they are filled in. The deploy command runs the
     `deploy` script of `package.json` ([`scripts/deploy-cloudflare.ts`](../scripts/deploy-cloudflare.ts)),
     which builds with the exact Bun every release is tested with — Cloudflare's build machine has an
     older one — and then deploys.
4. **Deploy.** The first build takes a few minutes. It creates the Worker, the Durable Object that
   holds the blog's database, the R2 bucket, and a link between the Worker and your copy: every push
   to the copy's `main` branch builds and deploys again.
5. Open the address, add **`/setup`**, and type the code. A short setup — account, authenticator,
   the look — ends in the editor.

Missed the code, or typed fewer than twelve characters? In the dashboard, the Worker → Settings →
Variables and Secrets → add a **Secret** named `SETUP_CODE`. Saving it deploys again, and `/setup`
asks for it. The same page takes `SITE_URL` once the blog has its own domain, and `UPDATE_CHECK`
([all the settings](environment.md)); later deploys keep what you set there (`keep_vars` in
[`wrangler.jsonc`](../wrangler.jsonc)).

## From the command line

With [Bun](https://bun.sh) 1.3+ and a Cloudflare account on Workers Paid:

```bash
git clone --depth 1 --branch v<newest release> https://github.com/joiha-steven/quireink.git && cd quireink
bun install --frozen-lockfile
bunx wrangler login
bunx wrangler secret put SETUP_CODE        # twelve characters or more; how you claim the blog
bun run deploy
```

`bun run deploy` builds the islands, the admin and the Worker, and `wrangler deploy` creates what
[`wrangler.jsonc`](../wrangler.jsonc) names: the Durable Object, the `quireink-blobs` bucket (rename
it there if your account already has one), the Images binding and the static assets. Open the
`workers.dev` address it prints, add `/setup`, and type the code.

## Moving a blog here

Install as above, open `/setup`, choose **Start from a backup** and give it an archive from the old
blog, written by the same version, with the `SETUP_CODE`. An archive of any size goes in: past 48 MB
the page sends it in parts of 16 MB, under the 100 MB Cloudflare allows one request, and the blog
loads them from the bucket as one stream. A program can do the same through the HTTP API in
[backup-load-api.md](backup-load-api.md). Backups taken here stream out of the bucket
to a download or to an off-site copy (a multipart upload), so their size is not bounded by the
Worker's 128 MB either.

## Upgrading

The database migrates when the blog next starts, after Cloudflare has bookmarked the moment before
(a bookmark restores the whole blog to that point, for 30 days, from the dashboard or the API).

**Installed with the button:** Cloudflare deploys whatever reaches your copy's `main` branch, so an
upgrade is bringing the newer release into the copy — and the copy carries the workflow that does it.
On GitHub, open your copy → **Actions → Update Quire Ink → Run workflow** (leave the version blank
for the newest). It brings the release in file for file, keeps the Worker and bucket names the button
chose, commits and pushes; a few minutes later the blog's `/api/health` names the new version. It
leaves `.github/workflows` alone, because the token a workflow gets may not change workflow files;
the release notes say when one of those changed.

Without the workflow, the same by hand, with git:

```bash
git clone https://github.com/<you>/<your copy>.git blog && cd blog
git fetch --depth 1 https://github.com/joiha-steven/quireink.git refs/tags/v<newest release>
git rm -rq . && git checkout FETCH_HEAD -- .      # the release, file for file
git diff --cached -- wrangler.jsonc               # see below
git commit -m "Quire Ink v<newest release>" && git push
```

The release's `wrangler.jsonc` carries the default names. If the button wrote a different Worker
`name` or `bucket_name` into your copy, the diff shows those lines going back to `quireink` and
`quireink-blobs`: put your values back and `git add wrangler.jsonc` before committing. Every other
line in that diff is the release's and stays: a bucket name left at the default would point the blog
at another bucket, without its uploads and backups.

**Moved from a server, or installed by the installer:** Settings → Server → Cloudflare shows the
newest release and a key to update to it. The Worker uploads the new version, keeps your variables
and secrets, waits for the blog to answer as the new version — and puts the version before back if
it does not. It uses the token kept in the Worker when you allowed self-updates during the move, or
asks for one. Measured on 2026-10-03 against a real account: 14 seconds, variables and secrets kept,
and going back restored the old version.

**Installed from the command line:** check out the newer release and run `bun run deploy` again.

## Moving a blog you already run

A Quire Ink on a server, in Docker or on a NAS moves from its own admin: **Settings → Server → Run on
Cloudflare**. Paste your account ID and an API token (the card lists the permissions), type your
password again, and press *Move to Cloudflare*. It checks the token and the plan, fetches this
version's Cloudflare package from its GitHub Release, creates the Worker, its storage and its
`workers.dev` address in your account, and loads a backup of the blog into it — posts, pictures,
accounts, settings. Measured on 2026-10-03: a blog with a 3.7 MB backup moved in 45 seconds.

The blog you moved from keeps serving until you point your domain at the Worker: the card does it
when the token may edit your domain, or you delete the domain's DNS record and add it as a Custom
Domain of the Worker in the dashboard. Then stop the old server. Your password is asked again
because the move copies every account, and because it re-hashes the password at today's strength,
which a Worker can verify within its memory.

## Leaving Cloudflare

Settings → Server → Cloudflare → *Leaving Cloudflare*. Download a backup first: it is the only way
back, and it loads into a new Quire Ink on a server, in Docker or on a NAS through *Start from a
backup* on its first screen. Then type your password and the blog's address, and the Worker deletes
the blog's pictures, files and backups, its bucket, and itself with its Durable Object and database.
There is no Trash behind it. A blog made with the Deploy button is deleted in the dashboard instead
(the card says how), together with its copy on GitHub.

## Coming before this leaves beta

- A run on Cloudflare itself before every release, not only under `wrangler dev`. (Every release
  already moves a Bun blog onto this build through `/setup/restore`, compares every page with Bun's,
  runs the whole tour of the product — 286 flows — and checks that a backup taken there restores to
  what Bun had.)
