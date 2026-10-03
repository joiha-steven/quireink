// Cloudflare: the files that ship with the code are Static Assets, deployed beside the Worker and
// fetched through the `ASSETS` binding by the path `with { type: 'file' }` gave them at build time.
//
// The admin's built bundle is Static Assets too, since 2026-10-03. It used to be compiled INTO the
// Worker as base64 and decoded at module load, because the shell needs every chunk's name
// synchronously, before any request: 1.99 MB of the worker, and 50.7 ms of CPU in every isolate
// that started — the front Worker, which only forwards, included. The shell never needed the BYTES
// synchronously, only facts about them, so `scripts/build-worker.ts` now writes the facts into
// `quire:admin-dist` (`runtime/admin-dist.ts` says which) and the files into Static Assets, under
// the very URLs the shell links. The edge answers those before the Worker runs; `body` is for what
// still reaches the route — the bare `admin.css`, and a sheet an older shell asks for.
import adminFiles from 'quire:admin-dist'
import type { AdminFile, AssetsPort } from '@/runtime/ports'
import { bound } from './bindings'

const fetchAsset = async (ref: string): Promise<Response> => {
  const res = await bound().env.ASSETS.fetch(new Request(new URL(ref, 'https://assets.invalid')))
  if (!res.ok || !res.body) throw new Error(`asset ${ref} answered ${res.status}`)
  return res
}

export const readAsset: AssetsPort['readAsset'] = async (ref) => (await fetchAsset(ref)).arrayBuffer()

export const assetBody: AssetsPort['assetBody'] = async (ref) => (await fetchAsset(ref)).body!

const dist = new Map<string, AdminFile>(adminFiles.map((f) => [f.name, {
  type: f.type,
  hash: f.hash,
  imports: f.imports,
  body: async () => new Uint8Array(await readAsset(f.path)),
}]))
export const adminDist: AssetsPort['adminDist'] = () => dist
