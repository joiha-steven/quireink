// Cloudflare: the files that ship with the code are Static Assets, deployed beside the Worker and
// fetched through the `ASSETS` binding by the path `with { type: 'file' }` gave them at build time.
// The admin's built bundle is compiled INTO the Worker by `scripts/build-worker.ts` (a virtual
// module), because the shell needs every chunk's name synchronously, before any request.
import adminFiles from 'quire:admin-dist'
import type { AssetsPort } from '@/runtime/ports'
import { bound } from './bindings'

const fetchAsset = async (ref: string): Promise<Response> => {
  const res = await bound().env.ASSETS.fetch(new Request(new URL(ref, 'https://assets.invalid')))
  if (!res.ok || !res.body) throw new Error(`asset ${ref} answered ${res.status}`)
  return res
}

export const readAsset: AssetsPort['readAsset'] = async (ref) => (await fetchAsset(ref)).arrayBuffer()

export const assetBody: AssetsPort['assetBody'] = async (ref) => (await fetchAsset(ref)).body!

const dist = new Map(adminFiles.map((f) => [f.name, { body: f.body, type: f.type }]))
export const adminDist: AssetsPort['adminDist'] = () => dist
