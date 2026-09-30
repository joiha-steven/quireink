// `quire user` — the only way an account comes into existence.
//
// There is no sign-up page. On a single-owner blog a sign-up form is a permanently open
// door guarding one account, and the account is created once, by the person standing at
// the machine.
//
//   bun run user create --username hung --email hung@example.com
//   bun run user set-password --username hung
//   bun run user reset-2fa --username hung
//   bun run user rename --username hung --to steven
//   bun run user list
//
// The password is read from STDIN, never from an argument: an argument lands in shell
// history, in `ps` output, and in any process listing on the box.

import { openDatabases, closeDatabases } from '@/store/db'
import { readEnv } from '@/env'
import { checkPassword, MIN_LENGTH } from '@/auth/password'
import { createUser, getUserByUsername, looksLikeEmail, noUsersYet, renameUser, setPassword, setTotpSecret } from '@/auth/users'
import { all, run } from '@/store/query'

const args = process.argv.slice(2)
const command = args[0] ?? ''

/**
 * A flag's value, as `--name value` or `--name=value`.
 *
 * ⚠️ NEVER ANOTHER FLAG. `create --username --email me@x` took `--email` as the name and made
 * the blog's one owner with it, which only deleting the database could undo (FIXLIST 9.4).
 */
function flag(name: string): string | undefined {
  const inline = args.find((a) => a.startsWith(`--${name}=`))
  if (inline !== undefined) return inline.slice(name.length + 3).trim() || undefined
  const at = args.indexOf(`--${name}`)
  const value = at === -1 ? undefined : args[at + 1]?.trim()
  return value === undefined || value === '' || value.startsWith('--') ? undefined : value
}

function die(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/**
 * Read a password without echoing it.
 *
 * Bun gives raw mode on the TTY, so this handles the keystrokes itself. When stdin is NOT
 * a TTY — a pipe, a CI step — it reads a line normally, which is what makes
 * `echo "..." | bun run user set-password` work for an automated first install.
 */
// Piped input is read ONCE and queued. Reading the stream again per prompt returns
// nothing — the first read drains it — so the confirmation always mismatched and every
// scripted install failed on "They did not match."
let pipedLines: string[] | null = null

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    if (pipedLines === null) {
      const text = await new Response(Bun.stdin.stream()).text()
      // The ONE trailing newline every shell adds is stripped first. Without this, a
      // single-line pipe splits into two entries — the password and an empty string — and
      // the confirmation prompt reads the empty one and reports a mismatch.
      pipedLines = text.replace(/\r?\n$/, '').split(/\r?\n/)
    }
    // A single-line pipe answers both the password and the confirmation prompt, which is
    // what `echo "..." | bun run user create` should reasonably do.
    return pipedLines.length > 1 ? pipedLines.shift() ?? '' : pipedLines[0] ?? ''
  }

  process.stdout.write(prompt)
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return new Promise((resolve) => {
    let value = ''
    const onData = (chunk: Buffer): void => {
      for (const byte of chunk) {
        // Enter, in both the LF and CR spellings a terminal might send.
        if (byte === 0x0a || byte === 0x0d) {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        // Ctrl-C has to be handled here: raw mode means the terminal is no longer turning
        // it into a signal, so without this the only way out is another terminal.
        if (byte === 0x03) {
          process.stdin.setRawMode(false)
          process.stdout.write('\n')
          process.exit(130)
        }
        if (byte === 0x7f || byte === 0x08) {
          value = value.slice(0, -1)
          continue
        }
        value += String.fromCharCode(byte)
      }
    }
    process.stdin.on('data', onData)
  })
}

async function promptNewPassword(names: string[]): Promise<string> {
  const password = await readSecret(`New password (min ${MIN_LENGTH} characters): `)
  const problem = checkPassword(password, names)
  if (problem === 'too-short') die(`Too short. Minimum ${MIN_LENGTH} characters.`)
  if (problem === 'too-common') die('That is one of the passwords everybody tries first.')
  if (problem === 'contains-name') die('It contains the site or account name, which is the first thing guessed.')

  const again = await readSecret('Again: ')
  if (again !== password) die('They did not match.')
  return password
}

openDatabases(readEnv().dataDir)

try {
  switch (command) {
    case 'create': {
      const username = flag('username') ?? die('create: --username is required')
      const email = flag('email') ?? die('create: --email is required')
      if (/\s/.test(username)) die('create: a username has no spaces')
      if (!looksLikeEmail(email)) die(`create: "${email}" is not an email address`)
      if (getUserByUsername(username) !== null) die(`create: "${username}" already exists`)
      // `createUser` refuses this too, and would throw a sentence written for a developer.
      // Checked here so the person at the console gets the two commands they actually want.
      if (!noUsersYet()) {
        die(
          'create: an account already exists, and Quire Ink has one owner by design.\n'
          + '  Forgotten password:  bun run user set-password --username <name>\n'
          + '  Lost the authenticator: sign in with one of the ten recovery codes.\n'
          + '  See it:              bun run user list',
        )
      }

      const password = await promptNewPassword([username, 'quire'])
      const user = await createUser({ username, email, password })
      console.log(`✓ created ${user.username} <${user.email}>`)
      console.log('')
      console.log('  Two-factor enrolment happens in the browser at first sign-in, and the')
      console.log('  admin is unreachable until it is done.')
      break
    }

    case 'set-password': {
      const username = flag('username') ?? die('set-password: --username is required')
      const user = getUserByUsername(username) ?? die(`set-password: no such user "${username}"`)
      const password = await promptNewPassword([username, 'quire'])
      await setPassword(user.id, password)
      // Not revoking sessions here. This command is run at the console by the owner, and
      // the web-facing password change (which DOES revoke) is a different path with a
      // different threat model: there, the old password was just used.
      console.log(`✓ password set for ${user.username}`)
      break
    }

    /**
     * BREAK GLASS: the second factor, cleared from the machine itself.
     *
     * The web screen can re-enrol 2FA and mint new recovery codes, but both ask for the
     * current password and the authenticator — which is no help at all in the one case that
     * actually strands somebody: the phone is gone AND the recovery codes are gone. Without
     * this, that account is finished, on a product whose whole premise is that the owner runs
     * the machine.
     *
     * Clearing the secret makes the next sign-in land on ENROLMENT (`login.ts` answers
     * `need-enrolment` when there is no secret), which issues a fresh authenticator and a
     * fresh set of codes. The old codes go with it: they were issued against an enrolment
     * that no longer exists, and leaving them live would be a second key to a lock that has
     * just been changed.
     *
     * ⚠️ It does NOT ask for the password, because the person running it is standing at the
     * server with a shell. That is the authorisation, and it is a stronger one than any
     * password — which is also why the console says out loud that the password is now the
     * only thing left guarding the account.
     *
     * Sessions are left alone, for the same reason `set-password` leaves them: a lost phone
     * is not a compromise, and signing the owner out of a browser that still works would be
     * unhelpful. If the password may also be known, change it — the console says so.
     */
    case 'reset-2fa': {
      const username = flag('username') ?? die('reset-2fa: --username is required')
      const user = getUserByUsername(username) ?? die(`reset-2fa: no such user "${username}"`)
      const enrolled = all<{ n: number }>(
        `select count(*) as n from users where id = ? and totp_secret is not null`, user.id,
      )[0]?.n ?? 0
      if (enrolled === 0) die(`reset-2fa: ${user.username} has no second factor to clear`)

      // The codes STILL GOOD, which is the number that means something: it said "10 destroyed"
      // when two of them had already been spent (FIXLIST 9.4).
      const unused = all<{ n: number }>(
        `select count(*) as n from recovery_codes where user_id = ? and used_at is null`, user.id,
      )[0]?.n ?? 0
      setTotpSecret(user.id, null)
      run(`delete from recovery_codes where user_id = ?`, user.id)
      console.log(`✓ second factor cleared for ${user.username}`)
      console.log(`  ${unused} unused recovery code${unused === 1 ? '' : 's'} destroyed with it — they belonged to that enrolment.`)
      console.log('  The next sign-in will enrol a new authenticator and print new codes.')
      console.log('  Until it does, the PASSWORD is the only thing guarding this account:')
      console.log(`  if it may be known to anyone else, run  bun run user set-password --username ${user.username}`)
      break
    }

    // `rename --username old --to new`: the one owner's sign-in name, changed at the console.
    case 'rename': {
      const username = flag('username') ?? die('rename: --username is required')
      const to = flag('to') ?? die('rename: --to is required')
      const user = getUserByUsername(username) ?? die(`rename: no such user "${username}"`)
      try { renameUser(user.id, to) } catch (error) { die((error as Error).message.replace(/^renameUser: /, 'rename: ')) }
      console.log(`✓ ${user.username} is now ${to.trim()}`)
      break
    }

    case 'list': {
      if (noUsersYet()) {
        console.log('No accounts yet. Run: bun run user create --username <name> --email <address>')
        break
      }
      const rows = all<{ username: string; email: string; totp_secret: string | null }>(
        `select username, email, totp_secret from users order by id`,
      )
      for (const row of rows) {
        console.log(`  ${row.username}  <${row.email}>  ${row.totp_secret ? '2FA enrolled' : '2FA NOT enrolled'}`)
      }
      break
    }

    default:
      console.log('usage: bun run user <create|set-password|reset-2fa|rename|list> [--username <name>] [--email <address>] [--to <new name>]')
      process.exit(command === '' ? 0 : 1)
  }
} finally {
  closeDatabases()
}
