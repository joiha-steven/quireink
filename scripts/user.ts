// `quire user` — the only way an account comes into existence.
//
// There is no sign-up page. On a single-owner blog a sign-up form is a permanently open
// door guarding one account, and the account is created once, by the person standing at
// the machine.
//
//   bun run user create --username hung --email hung@example.com
//   bun run user set-password --username hung
//   bun run user list
//
// The password is read from STDIN, never from an argument: an argument lands in shell
// history, in `ps` output, and in any process listing on the box.

import { openDatabases, closeDatabases } from '@/store/db'
import { readEnv } from '@/env'
import { checkPassword, MIN_LENGTH } from '@/auth/password'
import { createUser, getUserByUsername, noUsersYet, setPassword } from '@/auth/users'
import { all } from '@/store/query'

const args = process.argv.slice(2)
const command = args[0] ?? ''

function flag(name: string): string | undefined {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? undefined : args[at + 1]
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
      console.log('usage: bun run user <create|set-password|list> [--username <name>] [--email <address>]')
      process.exit(command === '' ? 0 : 1)
  }
} finally {
  closeDatabases()
}
