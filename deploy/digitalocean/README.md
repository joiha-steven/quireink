# Quire Ink on a DigitalOcean droplet, in one paste

[`user-data.sh`](./user-data.sh) turns a fresh droplet into a running blog with nothing
typed into a terminal:

1. Create a droplet: **Ubuntu 24.04**, the cheapest plan is enough.
2. Under **Advanced Options → Add Initialization scripts**, paste the whole of
   `user-data.sh`. The box is free-form, because it is [cloud-init user
   data](https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/), and
   any provider whose Ubuntu images run cloud-init takes the same file.
3. Create it. About three minutes after boot the blog answers on `http://<droplet-ip>`, or
   on `https://<DOMAIN>` if you filled in `DOMAIN` and its DNS already points at the droplet.
4. **Claim it without a terminal:** put twelve characters or more in `SETUP_CODE` at the top
   of the file before pasting, then open `/setup` in a browser and type them. Without one, the
   one-time link is in `/root/quire-setup.txt` on the droplet. The generator at
   [quireink.com/start](https://quireink.com/start) writes the file with both lines filled in.

The file is a thin shell around [`server.sh`](../../server.sh), the one script that sets up a
blank Ubuntu or Debian server ([ADR 0065](../../docs/decisions/0065-every-install-runs-a-release.md)):
Docker, the published image of the newest release, Caddy with a Let's Encrypt certificate when
there is a domain, data in `/var/lib/quireink`. Pointing a domain at it later is
`sudo bash /opt/quireink/server.sh --domain your.domain`; fixes are
`cd /opt/quireink && docker compose pull && docker compose up -d`.

**Why a droplet and not App Platform.** App Platform's filesystem is ephemeral and it
mounts no volumes, so every redeploy would erase the databases and the uploads. A "Deploy
to DO" button there would be a data-loss machine with good buttons. This blog is two SQLite
files and an uploads directory; it wants a disk that stays.

**What has been proven, and what has not.** `server.sh` runs on every release, before
anything is published, on a blank Ubuntu 24.04 runner (the `server-http` cell of
`release-matrix.yml`): install, claim with a setup code, smoke-test, run again as an update
with `.env` untouched, and refuse a machine that already serves port 80. The one seam this
repository cannot exercise for you is DigitalOcean accepting the paste, which is their
standard, documented droplet feature, and the certificate, which needs a real domain.
