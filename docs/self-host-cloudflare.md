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

## Installing from the source (works today)

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

## Upgrading

Check out the newer release and run `bun run deploy` again. The database migrates when the blog
next starts, after Cloudflare has bookmarked the moment before (a bookmark restores the whole blog
to that point, for 30 days, from the dashboard or the API).

## Coming before this leaves beta

- The **Deploy to Cloudflare** button, so none of the above needs a terminal.
- **Move to Cloudflare** from a running Quire Ink on a VPS, Docker or a NAS, with its posts.
- A **one-click upgrade** in the admin.
- The full tour of the product, run against this runtime on every change, and a crawl that serves
  the same backup from Bun and from Cloudflare and compares every page.
