# Your account

How the one owner of a Quire Ink blog comes into existence, and how they get back in when
something is lost. Part of the [self-host guide](self-host.md) (§6).

## Claiming the blog

**Read the log.** On a blog nobody owns yet, every start prints the link that claims it:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  This blog has no owner yet. Open the link below to claim it.           │
  └─────────────────────────────────────────────────────────────────────────┘

  https://example.com/setup?token=…
```

`journalctl -u quire | grep -A8 'no owner'`, or `docker logs quire` for a container. With no
`SITE_URL` the link names `127.0.0.1`, which your own browser cannot open on a server: the log
prints the `ssh -L` tunnel line under it, or set `SITE_URL` and restart. Open it
and the rest is a browser: the language first (so the screens after it are in it), then
username, email, password, then the QR code for an authenticator and the ten recovery codes,
once. **Store the recovery codes somewhere that is not the machine.** Four short questions
follow — what the site is called, where it lives and what clock it reads; the front page;
whether readers get a pen; and the look — and then you are in the editor.

The token lives in memory, so a restart mints a new one and the old line stops being a
secret. Reading it proves you have the machine, which is why setup is not simply a page
anyone could find. **No log to read?** Set `SETUP_CODE` (twelve characters or more) in the
environment and `/setup` asks for it instead; a cloud-init paste can carry it.

Prefer the terminal, or automating it? The CLI still does the same job:

```bash
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user create --username you --email you@example.com'
```

It asks for a password and prints nothing else — two-factor enrolment happens in the browser
at first sign-in either way, and the admin is unreachable until it is done.

**Trying it on your own machine?** While no site address is set, the enrolment screen offers
*"Set this up later"*. Before anyone has enrolled, two-factor protects nothing: whoever
reaches that screen with the password enrols their own authenticator, so skipping on a
laptop widens nothing. Set an address and the way out disappears at the next sign-in, which
asks for enrolment again.

**Locked out?** The same CLI is the way back in, run at the machine — being at the machine is
the authorisation:

```bash
# forgotten password
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user set-password --username you'
# phone AND recovery codes lost: clears the second factor; the next sign-in enrols a new one
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user reset-2fa --username you'
# the sign-in name itself, and what accounts exist
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user rename --username you --to new-name'
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user list'
```

In a container the same commands run through the image's entrypoint, which already knows the
data directory and drops to the user the blog runs as (`PUID`/`PGID`), so nothing it writes ends
up owned by root:

```bash
docker exec -it quire docker-entrypoint.sh bun run user reset-2fa --username you
```

Only the phone lost? Nothing to run: on the code screen, choose *Use a recovery code instead*.

⚠ Set `DATA_DIR` when running any CLI command. Without it the CLI opens `./data`, which is
a *different, empty* database, and it will cheerfully tell you there are no accounts.
