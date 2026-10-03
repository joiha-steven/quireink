// The Cloudflare package of a release, fetched where it is published (ADR 0065 package C): the
// GitHub Release of that version carries `quireink-cf-<v>.tar` and its `.sha256` beside it,
// written by `publish.yml`. "Move to Cloudflare" fetches the one matching THIS blog's version,
// because a backup only loads into a blog of the same version (ADR 0067 rule 4); the one-click
// upgrade on Cloudflare fetches the newer one.
//
// Plain `fetch`, so it runs on both runtimes. No machine of this project is in the path.
import { readTar } from './tar'
import type { Manifest } from './install'

/** Where releases are published. One constant, so a fork changes one line. */
export const RELEASES = 'https://github.com/joiha-steven/quireink/releases/download'

export type Package = { manifest: Manifest; files: Map<string, Uint8Array> }

export class PackageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageError'
  }
}

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * The address of a version's package. `QUIREINK_CF_PACKAGE_URL` points somewhere else entirely —
 * a package built from a working tree and served locally, for trying the move before a release
 * exists. The `.sha256` is looked for beside it either way.
 */
export function packageUrl(version: string): string {
  return process.env.QUIREINK_CF_PACKAGE_URL || `${RELEASES}/v${version}/quireink-cf-${version}.tar`
}

/**
 * Download, check and open a version's package.
 *
 * Checked twice: the whole archive against the `.sha256` published beside it, which catches a
 * truncated download, and then — by the installer — every file against the manifest inside. The
 * manifest must name the version asked for, or the blog would move into a Worker of a different
 * version and the backup would be refused at the far end with a reason nobody could act on.
 */
export async function fetchPackage(version: string, using: typeof fetch = fetch): Promise<Package> {
  const url = packageUrl(version)
  const [tarRes, sumRes] = await Promise.all([
    using(url, { redirect: 'follow' }),
    using(`${url}.sha256`, { redirect: 'follow' }),
  ])
  if (tarRes.status === 404) throw new PackageError(`version ${version} has no Cloudflare package (${url})`)
  if (!tarRes.ok) throw new PackageError(`the package answered ${tarRes.status} (${url})`)
  const bytes = new Uint8Array(await tarRes.arrayBuffer())
  if (sumRes.ok) {
    const want = (await sumRes.text()).trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    const got = hex(await crypto.subtle.digest('SHA-256', bytes))
    if (want && want !== got) throw new PackageError(`the package does not match its published checksum (${url}.sha256)`)
  } else if (!process.env.QUIREINK_CF_PACKAGE_URL) {
    throw new PackageError(`the package's checksum is missing (${url}.sha256 answered ${sumRes.status})`)
  }
  const files = await readTar(bytes)
  const raw = files.get('manifest.json')
  if (!raw) throw new PackageError('the package has no manifest.json')
  const manifest = JSON.parse(new TextDecoder().decode(raw)) as Manifest
  if (manifest.format !== 'quireink-cf/1') throw new PackageError(`unknown package format ${manifest.format}`)
  if (manifest.version !== version) throw new PackageError(`the package is version ${manifest.version}, not ${version}`)
  return { manifest, files }
}
