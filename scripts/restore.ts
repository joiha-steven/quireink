// Restore a backup archive, with Quire Ink stopped (ADR 0067; the procedure is `docs/backups.md`).
//
//   bun scripts/restore.ts quire-<stamp>.tar.gz --data-dir /var/lib/quire/data
//   bun scripts/restore.ts quire-<stamp>.tar.gz.enc --data-dir … --identity key.txt
//   bun scripts/restore.ts quire-<stamp>.tar.gz.enc --data-dir … --passphrase
//   … [--uploads-dir /var/lib/quire/uploads]
//
// One command where `tar` and `cp` used to be. It reads either format — rows (every archive
// from 2.3) or the database files every earlier archive held — decrypts on the way when the
// archive is sealed, and builds `quire.db` and `analytics.db` in a data directory that must not
// already hold them. Nothing is overwritten: move the old files aside first, which is also the
// copy to go back to if the restore turns out to be the wrong one.
//
// Offline on purpose (ADR 0035): restoring replaces what a running process holds open.
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { ArchiveFault } from '@/server/archive-open'
import { restoreArchive } from './restore-lib'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const die = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** Read a passphrase without echoing it, the way `backup-decrypt.ts` does. */
async function askPassphrase(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true })
  ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {}
  process.stderr.write('Passphrase: ')
  const answer = await new Promise<string>((done) => rl.question('', done))
  rl.close()
  process.stderr.write('\n')
  return answer
}

/** What a fault means to the person at the terminal. */
const MEANING: Record<string, string> = {
  'needs-key': 'the archive is sealed: pass --identity <file> or --passphrase',
  'no-matching-key': 'that key does not open this archive. A different identity, or a different passphrase.',
  'bad-identity': 'that file does not hold a Quire Ink backup identity (it starts quire-backup-key-1)',
  'header-tampered': 'the archive header does not match its contents',
  'not-an-archive': 'this is not a Quire Ink backup archive',
  'damaged': 'the archive is damaged or cut short: a part of it fails its authentication',
  'unknown-format': 'this archive was written in a format this version does not know; restore it with the version that wrote it',
}

if (import.meta.main) {
  const archive = argv.find((a, i) => !a.startsWith('-') && !['--data-dir', '--uploads-dir', '--identity'].includes(argv[i - 1] ?? ''))
  if (!archive || argv.includes('--help')) {
    console.log(`Restore a Quire Ink backup, with the service stopped.

  bun scripts/restore.ts <archive> --data-dir <dir> [--uploads-dir <dir>] [--identity <file> | --passphrase]

The data directory must not already hold quire.db or analytics.db (nor their -wal and -shm files).
The uploads directory defaults to "uploads" beside the data directory; a file already there with the
same bytes is left alone, one with different bytes stops the restore. docs/backups.md has the whole
procedure.`)
    // Asked for, the help is an answer and exits 0; printed because no archive was named, it is
    // a mistake and exits 1. `--help` alone used to exit 1, which read as a broken install.
    process.exit(argv.includes('--help') ? 0 : 1)
  }
  const dataDir = flag('--data-dir') ?? die('name the data directory: --data-dir <dir>')
  const uploadsDir = flag('--uploads-dir') ?? join(dataDir, '..', 'uploads')
  const identityFile = flag('--identity')
  const keys = identityFile
    ? { identity: await Bun.file(identityFile).text().catch(() => die(`cannot read ${identityFile}`)) }
    : argv.includes('--passphrase') ? { passphrase: await askPassphrase() } : {}
  try {
    const report = await restoreArchive({ archive, dataDir, uploadsDir, keys, say: (line) => console.log(line) })
    const rows = report.tables.reduce((n, t) => n + t.rows, 0)
    console.log(report.format === 'rows'
      ? `\nRestored ${rows} rows in ${report.tables.length} tables and ${report.uploads} upload(s). Start the service: it migrates on boot as on any upgrade.`
      : `\nRestored the database files and ${report.uploads} upload(s). Start the service: it migrates on boot as on any upgrade.`)
  } catch (error) {
    const why = (error as Error).message
    die(error instanceof ArchiveFault ? (MEANING[why] ?? why) : why)
  }
}
