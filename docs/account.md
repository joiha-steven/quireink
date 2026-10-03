# Your account

How the one owner of a Quire Ink blog comes into existence, how they sign in with a passkey, and
how they get back in when something is lost. Part of the [self-host guide](self-host.md) (§6).

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

## Signing in with a passkey

A passkey signs you in with your fingerprint, your face or your device's PIN, in one step, in
place of the password and the six-digit code ([ADR 0071](decisions/0071-a-passkey-is-a-second-door-not-the-only-one.md)).
It is a second door, never the only one: the password, the code and the recovery codes keep
working whether you have one passkey, ten or none.

**Adding one.** *Settings → Account → Security*: type your current password in the box at the
top, give the passkey a name you will recognise (*Laptop*, *Phone*), and press *Add a passkey*.
Your browser or password manager asks for the fingerprint, face or PIN and keeps the key. The list
under it shows each passkey with when it was added and when it last signed you in; *Remove* takes
one away (it asks for the password too). Twenty at most.

**Using one.** On the sign-in page, either pick the passkey from the username box's autofill, or
press *Sign in with a passkey* under the form. Either way you land in the admin with no code
screen: a passkey that checked your fingerprint, face or PIN already counts as both factors.

⚠ **A passkey belongs to one address.** It is bound to the blog's host, the one in `SITE_URL` or
in *Settings*, and the card says which. **If the blog moves to another domain, its passkeys stop
working there**: no setting can carry them across, because the binding lives in your device, not
on the server. Sign in with the password and the code on the new address, remove the old passkeys,
and add new ones. For the same reason passkeys do not work when the admin is opened by another
name than the blog's address, and they cannot be made at all on a blog reached by an IP address,
which browsers refuse; open it by a name (even `localhost`) instead.

A backup carries the passkeys with everything else, so a blog restored onto the same address
signs in with the same passkeys.

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
