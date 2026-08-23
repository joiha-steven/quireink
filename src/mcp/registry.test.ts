// The registry is the promise that every door sees the same tools. These tests pin the
// promise, not the tool count fashion of the week.

import { describe, it, expect } from 'bun:test'
import { collectTools } from './registry'

describe('collectTools', () => {
  it('collects every tool with a unique name and a real description', async () => {
    const tools = await collectTools()
    expect(tools.length).toBeGreaterThanOrEqual(35)
    const names = tools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of tools) {
      expect(t.meta.description.length).toBeGreaterThan(10)
      expect(typeof t.handler).toBe('function')
    }
  })

  it('holds the line: what is forbidden over MCP is forbidden through every door', async () => {
    const names = (await collectTools()).map((t) => t.name)
    // The broadcast cannot be unsent; tokens minting an agent's own credentials is
    // self-escalation. Neither exists on ANY door, which is the registry's whole point.
    expect(names.some((n) => /broadcast|send_newsletter$/.test(n))).toBe(false)
    expect(names.some((n) => /token/.test(n))).toBe(false)
    expect(names).toContain('send_test_newsletter') // the test send is the allowed shape
  })
})
