# Quire Ink

**A blog you host yourself, and an AI agent can run for you.** One process, two SQLite files,
no cloud account anywhere in the path. No algorithm deciding who sees your writing, no ads
across it, and no company that can change the rules.

* 📖 **[Source and full documentation](https://github.com/joiha-steven/quireink)**
* 🌐 **[Try the live demo](https://demo.quireink.com)** — no sign-up, nothing to fill in
* 🏠 **[quireink.com](https://quireink.com)**

---

## Start it

```bash
docker run -d --name quire \
  -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data \
  -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:2.1
```

Then create your owner account:

```bash
docker exec quire bun run user create --username you --email you@example.com
```

Put a reverse proxy in front of it for TLS — the port is bound to `127.0.0.1` on purpose, and
[the setup guide](https://github.com/joiha-steven/quireink/blob/main/docs/self-host.md) has an
nginx block you can copy.

## On a NAS — Synology, QNAP, Unraid

Their container UIs mount real folders rather than named volumes, because that is what their
own backup jobs can see. Point both mounts at a folder you created and set `PUID` / `PGID` to
whoever owns it — the container adopts the folders on first boot and never runs the app as
root:

```yaml
services:
  quire:
    image: quireink/quireink:2.1
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      SITE_URL: https://example.com
      PUID: 1026     # Synology: Control Panel → User & Group
      PGID: 100
    volumes:
      - /volume1/docker/quireink/data:/var/lib/quire/data
      - /volume1/docker/quireink/uploads:/var/lib/quire/uploads
```

## Tags

| Tag | What it means |
|---|---|
| `2.1.3` | One exact release. Nothing moves, ever. |
| `2.1` | Fixes within the 2.1 line, no feature surprises. **The one to pin.** |
| `latest` | The newest release. Fine for trying it, not for a blog you care about. |

`linux/amd64` and `linux/arm64`, each built on its own native runner. The same image is on
GHCR as `ghcr.io/joiha-steven/quireink`, pushed by the same run with the same digest.

## Configuration

Almost nothing lives here. SMTP, the site's name and language, colours, fonts, the newsletter
and the analytics settings are all entered in the admin and stored in the database.

| Variable | Default | What it does |
|---|---|---|
| `SITE_URL` | — | Your public URL, no trailing slash. Feeds, share images and preview links are built from it. |
| `PUID` / `PGID` | `1000` | Who owns the data. Only matters with bind mounts — see the NAS section. |
| `PORT` | `3000` | Inside the container. |
| `DATA_DIR` | `/var/lib/quire/data` | Both SQLite files. Mount it or lose your blog. |
| `STORAGE_LOCAL_DIR` | `/var/lib/quire/uploads` | Images and files. Mount it too. |
| `CRON_SECRET` | — | Protects `/api/cron`, the scheduled-publishing sweep. |
| `ANALYTICS_TZ` | `UTC` | The zone the analytics day boundary uses. |

The [environment table](https://github.com/joiha-steven/quireink/blob/main/docs/self-host.md)
has the rest.

## What is in it

A real editor over Markdown — tables, footnotes, callouts, mathematics, video — that saves as
you type and can hold a post until Tuesday. Six palettes in light and dark, four reading
fonts, a book mode set in two columns like paper, and a five-ink highlighter whose strokes are
grown rather than drawn, so no two on a page share a shape. Search that answers as you type,
comments, a newsletter, and analytics without cookies. An article page costs about 114 KB.

An AI agent can write and publish for you over MCP, through exactly the rules the admin
follows, and you can take its access away at any moment.

## Backups

There is a button in the admin that hands you the whole blog — both databases and every
upload — as one archive. Nobody backs it up for you; pressing it is your job.

## Licence

[PolyForm Noncommercial](https://github.com/joiha-steven/quireink/blob/main/LICENSE), plus
[one additional permission](https://github.com/joiha-steven/quireink/blob/main/LICENSE-EXCEPTION.md)
that lets you run **this published image** commercially — paid hosting included. Only a
*modified* version used commercially needs to ask first.
