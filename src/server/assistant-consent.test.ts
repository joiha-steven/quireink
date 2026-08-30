// Which actions stop and wait, and what happens either way.
//
// The gate is the difference between an assistant an owner leaves running and one they
// watch. Two ways to get it wrong and both are quiet: too wide and every ordinary edit
// needs a click, so the owner learns to press Allow without reading; too narrow and the
// first thing they hear about a deletion is that it happened.

import { describe, it, expect } from 'bun:test'
import { collectTools } from '@/mcp/registry'
import { needsConsent } from './assistant-consent'

describe('the list', () => {
  // Pinned, so widening it is a visible act rather than a side effect of naming a tool.
  it('is exactly these, and every one of them is a real tool', async () => {
    const names = (await collectTools()).map((t) => t.name)
    const gated = names.filter(needsConsent).sort()
    expect(gated).toEqual([
      'add_media_from_url',
      'compose_homepage',
      'delete_comment',
      'delete_file',
      'delete_media',
      'delete_page',
      'delete_post',
      'import_images',
      'send_test_newsletter',
      'update_appearance',
      'update_settings',
    ])
  })

  // The failure mode of a too-wide gate: the owner presses Allow without reading, because
  // they have pressed it eleven times today for things that did not need it.
  it('lets ordinary work through, including writes', async () => {
    for (const name of ['create_post', 'update_post', 'patch_post', 'create_page', 'update_page']) {
      expect(`${name}: ${needsConsent(name) ? 'STOPS' : 'runs'}`).toBe(`${name}: runs`)
    }
  })

  it('never stops a read', async () => {
    const readers = (await collectTools()).filter((t) => t.meta.readOnly).map((t) => t.name)
    expect(readers.length).toBeGreaterThan(10)
    expect(readers.filter(needsConsent)).toEqual([])
  })

  // Restoring is the opposite of destroying, and a Trash you need permission to empty
  // backwards is a Trash nobody uses.
  it('never stops an undo', async () => {
    for (const name of ['restore_post', 'restore_page', 'restore_media', 'restore_file']) {
      expect(`${name}: ${needsConsent(name) ? 'STOPS' : 'runs'}`).toBe(`${name}: runs`)
    }
  })
})
