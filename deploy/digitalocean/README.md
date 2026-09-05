# Quire Ink on a DigitalOcean droplet, in one paste

[`user-data.sh`](./user-data.sh) turns a fresh droplet into a running blog with nothing
typed into a terminal:

1. Create a droplet: **Ubuntu 24.04**, the cheapest plan is enough.
2. Under **Advanced Options → Add Initialization scripts**, paste the whole of
   `user-data.sh`. The box is free-form, because it is [cloud-init user
   data](https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/), and
   any provider whose Ubuntu images run cloud-init takes the same file.
3. Create it. About three minutes after boot the blog answers on `http://<droplet-ip>`.
4. The one-time link that claims it waits in `/root/quire-claim.txt` on the droplet, and in
   `docker logs quire`, where every restart prints a fresh one. **Or skip the terminal
   entirely:** put twelve characters or more in `SETUP_CODE` at the top of the file before
   pasting, and claim the blog by opening `/setup` in a browser and typing them. The
   generator at [quireink.com/start](https://quireink.com/start) writes the file with both
   `DOMAIN` and `SETUP_CODE` filled in.

It runs the published image against the droplet's bare IP over plain HTTP, which is the
most a machine with no domain can honestly do. When you point a domain at the droplet, the
reverse-proxy section of [`docs/self-host.md`](../../docs/self-host.md), or
[`docker-compose.caddy.yml`](../../docker-compose.caddy.yml), upgrades it to HTTPS, and
Settings → Site moves the address with you.

**Why a droplet and not App Platform.** App Platform's filesystem is ephemeral and it
mounts no volumes, so every redeploy would erase the databases and the uploads. A "Deploy
to DO" button there would be a data-loss machine with good buttons. This blog is two SQLite
files and an uploads directory; it wants a disk that stays.

**What has been proven, and what has not.** The payload is verified against
`quireink/quireink:latest`: pull the published image, boot it on root-owned bind mounts,
answer `/api/health`, print the claim link, keep its data across a restart, run as UID
1000. The address
detection is verified against Ubuntu 24.04's own `iproute2`, with `hostname -I` as the
fallback. The one seam this repository cannot exercise for you is DigitalOcean accepting
the paste, which is their standard, documented droplet feature.
