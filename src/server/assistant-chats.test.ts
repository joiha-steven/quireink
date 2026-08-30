// Conversations that outlive the tab (ADR 0040).
//
// Two things here are easy to get backwards and expensive to notice: what a title is taken
// from once a chat has one, and which of the two counters adds while the other replaces.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import type { Turn } from '@/server/assistant-dialects'
import {
  createChat, deleteChat, getChat, listChats, renameChat, saveChat, titleFrom,
} from './assistant-chats'

const DIR = './.tmp/test-assistant-chats'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => db().run(`delete from assistant_chats`))

const asked = (text: string): Turn[] => [{ kind: 'user', text }]
const answered = (q: string, a: string): Turn[] => [{ kind: 'user', text: q }, { kind: 'assistant', text: a }]

describe('a new conversation', () => {
  it('starts empty, listed, and with nothing spent', () => {
    const id = createChat()
    expect(id).toBeGreaterThan(0)
    const chat = getChat(id)!
    expect(chat.turns).toEqual([])
    expect(chat.usage).toEqual({ input: 0, output: 0 })
    expect(listChats().map((c) => c.id)).toEqual([id])
  })

  it('is gone when deleted, and says so when it was not there', () => {
    const id = createChat()
    expect(deleteChat(id)).toBe(true)
    expect(getChat(id)).toBeNull()
    expect(deleteChat(id)).toBe(false)
  })
})

describe('the title', () => {
  it('is the first question, and stops being taken once there is one', () => {
    const id = createChat()
    saveChat(id, answered('How many drafts?', 'Three.'), { input: 10, output: 5 }, 10)
    expect(getChat(id)!.title).toBe('How many drafts?')

    // A second exchange must NOT retitle the chat to the newest question: the list would
    // reshuffle its own labels while the owner was reading it.
    saveChat(id, [...answered('How many drafts?', 'Three.'), ...asked('And pages?')], { input: 20, output: 5 }, 20)
    expect(getChat(id)!.title).toBe('How many drafts?')
  })

  it('yields to a name the owner gave it', () => {
    const id = createChat()
    saveChat(id, answered('How many drafts?', 'Three.'), { input: 1, output: 1 }, 1)
    renameChat(id, 'Tidy-up, week 34')
    saveChat(id, answered('How many drafts?', 'Three.'), { input: 1, output: 1 }, 1)
    expect(getChat(id)!.title).toBe('Tidy-up, week 34')
  })

  it('shortens a question too long for a column, and survives one with no words', () => {
    expect(titleFrom(asked('x'.repeat(200)))).toHaveLength(70)
    expect(titleFrom(asked('  many   spaces  '))).toBe('many spaces')
    expect(titleFrom([])).toBe('')
  })
})

describe('the two counters, which behave differently on purpose', () => {
  // Spend ADDS: what the conversation has cost is everything it ever cost.
  // Context REPLACES: it is how big the conversation is NOW, and every round re-sends the
  // whole thing, so adding those numbers would report four times the truth.
  it('adds what was spent and replaces what the next question will cost', () => {
    const id = createChat()
    saveChat(id, answered('a', 'b'), { input: 100, output: 20 }, 100)
    saveChat(id, answered('a', 'b'), { input: 260, output: 30 }, 260)

    const chat = getChat(id)!
    expect(chat.usage).toEqual({ input: 360, output: 50 })
    expect(chat.context).toBe(260)
  })
})

describe('the list', () => {
  it('puts the most recently touched first, not the most recently made', () => {
    const first = createChat()
    const second = createChat()
    saveChat(first, answered('older chat, newer answer', 'x'), { input: 1, output: 1 }, 1)
    expect(listChats().map((c) => c.id)).toEqual([first, second])
  })

  it('carries no turns at all, because a column of forty chats would carry forty transcripts', () => {
    const id = createChat()
    saveChat(id, answered('question', 'a long answer'.repeat(500)), { input: 1, output: 1 }, 1)
    expect(JSON.stringify(listChats())).not.toContain('a long answer')
  })
})

describe('a row that will not parse', () => {
  // Written by another version, or by a disk that lied. It must cost that one conversation
  // and not the screen: the list is how the owner reaches every other one.
  it('reads as empty rather than throwing', () => {
    const id = createChat()
    db().run(`update assistant_chats set turns = '{ not json' where id = ?`, [id])
    expect(getChat(id)!.turns).toEqual([])
    expect(listChats()).toHaveLength(1)
  })
})
