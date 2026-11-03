// Who gets a reply email, and who does not.
//
// Every branch here is a decision NOT to send, and a wrong one is invisible from the outside:
// too loose and the site emails somebody who deleted their comment, or emails a person their
// own reply; too tight and the feature quietly stops working and nobody reports a missing
// email they did not know to expect.
//
// Nothing is mocked. `sendMail` never throws and records every attempt in `newsletter_sends`,
// so the presence of a row is the honest answer to "did it try to send". SMTP points at a
// closed port, so the attempt fails immediately and the row carries `ok = 0`.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { all, run } from '@/store/query'
import { saveSmtpConfig } from '@/news/mail'
import { savePost } from '@/content/posts'
import { notifyReply } from '@/comments/comment-notify'
import { muteFromToken, muteLink } from '@/comments/reply-mute'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-comment-notify'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PARENT = 'reader@example.com'

/** The parent comment being replied to. */
function parentComment(email: string, deletedAt: number | null = null): number {
  run(
    `insert into comments (post_slug, author_name, author_email, content, created_at, deleted_at)
     values ('a-post', 'Reader', ?, 'Nice piece', 1700000000000, ?)`,
    email, deletedAt,
  )
  return all<{ id: number }>(`select id from comments order by id desc limit 1`)[0]!.id
}

const attempts = () =>
  all<{ email: string; kind: string }>(`select email, kind from newsletter_sends`)

const reply = (parentId: number, replierEmail = 'someone@example.com') =>
  notifyReply({
    parentId,
    postSlug: 'a-post',
    replierName: 'Someone',
    replierEmail,
    contentHtml: '<p>Agreed.</p>',
  })

beforeEach(async () => {
  run(`delete from comments`)
  run(`delete from reply_mutes`)
  run(`delete from newsletter_sends`)
  run(`delete from posts`)
  await savePost({
    title: 'A Post', slug: 'a-post', content: 'Body.', status: 'published',
    date: '2020-01-01T00:00:00.000Z',
  })
  // A closed port: configured enough to pass the gate, and the connection fails at once.
  await saveSmtpConfig({ host: '127.0.0.1', port: 1, from: 'blog@example.com' })
})

describe('notifyReply', () => {
  it('emails the parent commenter', async () => {
    await reply(parentComment(PARENT))
    expect(attempts()).toEqual([{ email: PARENT, kind: 'reply' }])
  })

  it('says nothing when the parent left no address', async () => {
    await reply(parentComment(''))
    expect(attempts()).toEqual([])
  })

  it('says nothing when the parent comment has been deleted', async () => {
    await reply(parentComment(PARENT, 1700000001000))
    expect(attempts()).toEqual([])
  })

  // Replying to yourself is the common case on a small blog, and an email about it is noise.
  it('does not email somebody their own reply', async () => {
    await reply(parentComment(PARENT), PARENT)
    expect(attempts()).toEqual([])
  })

  it('matches the replier against the parent ignoring case and spacing', async () => {
    await reply(parentComment(PARENT), `  ${PARENT.toUpperCase()} `)
    expect(attempts()).toEqual([])
  })

  it('says nothing when the parent does not exist at all', async () => {
    await reply(999_999)
    expect(attempts()).toEqual([])
  })

  it('sends nothing while SMTP is unconfigured, and records no attempt either', async () => {
    await saveSmtpConfig({ host: '', from: '' })
    await reply(parentComment(PARENT))
    expect(attempts()).toEqual([])
  })

  // The address on a manual comment is whatever was typed, so a reply notice could be aimed at
  // anybody, carrying words a stranger chose, with no way to make it stop (2026-11-03). It now
  // waits for the spam filter and carries a link that ends it.
  it('says nothing when the reply itself was held as spam', async () => {
    const parent = parentComment(PARENT)
    run(`insert into comments (post_slug, parent_id, author_name, author_email, content, created_at, deleted_at)
         values ('a-post', ?, 'Spam', 'x@example.com', 'buy', 1700000000001, 1700000000002)`, parent)
    const held = all<{ id: number }>(`select id from comments order by id desc limit 1`)[0]!.id
    await notifyReply({ parentId: parent, replyId: held, postSlug: 'a-post', replierName: 'Spam', replierEmail: 'x@example.com', contentHtml: '<p>buy</p>' })
    expect(attempts()).toEqual([])
  })

  it('stops for good once the address asks it to, through the link the notice carries', async () => {
    const parent = parentComment(PARENT)
    const link = muteLink('https://blog.example', parent, PARENT)
    const token = new URL(link).searchParams.get('t')!
    expect(muteFromToken('1.forged')).toBe(false)
    expect(muteFromToken(token)).toBe(true)
    await reply(parent)
    await reply(parentComment(` ${PARENT.toUpperCase()}`))
    expect(attempts()).toEqual([])
  })

  it('asks on GET and acts on POST, so a link scanner cannot mute anybody', async () => {
    const parent = parentComment(PARENT)
    const path = new URL(muteLink('https://blog.example', parent, PARENT)).pathname + new URL(muteLink('https://blog.example', parent, PARENT)).search
    const app = createApp()
    const asked = await app.request(path)
    expect(asked.status).toBe(200)
    expect(await asked.text()).toContain('<form method="post"')
    await reply(parent)
    expect(attempts()).toHaveLength(1)
    expect((await app.request(path, { method: 'POST' })).status).toBe(200)
    await reply(parent)
    expect(attempts()).toHaveLength(1)
  })

  // Best-effort by contract: the comment POST route awaits this, so a throw here would fail
  // a comment that was already saved.
  it('never throws, whatever the mail server does', async () => {
    await expect(reply(parentComment(PARENT))).resolves.toBeUndefined()
  })
})
