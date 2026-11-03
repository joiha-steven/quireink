// A post back from the Trash reaches the fediverse again under an id of its own (ADR 0059), inside
// a Durable Object, for `bun run test:cf`.
//
// The object first gets the `ap_sent` shape from before `029-ap-sent-withdrawn` (the column dropped,
// the step forgotten), and opening it again has to run that step here, where `ALTER TABLE` goes
// through the object's own SQLite. Then the round a reader makes: publish, trash, restore, each
// swept, with one follower to say it to. `bun test` holds the same in `src/ap/announce-restore.test.ts`.
import { openDatabases } from '@/store/db'
import { all, one, run } from '@/store/query'
import { getSettings, saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { deletePost, restorePost } from '@/content/posts-trash'
import { addFollower } from '@/ap/store'
import { sweepAnnounce } from '@/ap/announce'

export async function apRestoreTakesANewId(): Promise<void> {
  openDatabases('./data')
  run(`alter table ap_sent drop column withdrawn_at`)
  run(`delete from schema_migrations where name = '029-ap-sent-withdrawn'`)
  openDatabases('./data')
  const cols = all<{ name: string }>(`select name from pragma_table_info('ap_sent')`).map((c) => c.name)
  if (!cols.includes('withdrawn_at')) throw new Error(`029 did not run in the object: ap_sent has ${cols.join(', ')}`)
  if (!one(`select 1 as x from schema_migrations where name = '029-ap-sent-withdrawn'`)) throw new Error('029 ran but was not recorded')

  const site = 'https://blog.test'
  await saveSettings({ siteUrl: site, title: 'A Blog', activitypub: { enabled: true, handle: 'quire' } })
  addFollower({ actor: 'https://m.test/u/1', inbox: 'https://m.test/u/1/inbox', sharedInbox: 'https://m.test/inbox' })
  await savePost({
    title: 'Comes back', slug: 'comes-back', content: 'Body.', status: 'published',
    date: new Date(Date.now() - 3600_000).toISOString(), categories: [], tags: [],
  } as Parameters<typeof savePost>[0])
  const sweep = async () => sweepAnnounce({ settings: await getSettings(), site, since: 0 })
  await sweep()
  await deletePost('comes-back')
  await sweep()
  await restorePost('comes-back')
  await sweep()

  const url = `${site}/comes-back`
  const said = all<{ body: string }>(`select body from ap_queue order by id`)
    .map((r) => JSON.parse(r.body) as { type: string; object: { id: string; url?: string } })
    .map((a) => `${a.type} ${a.object.id}${a.object.url && a.object.url !== a.object.id ? ` (url ${a.object.url})` : ''}`)
  const want = [`Create ${url}`, `Delete ${url}`, `Create ${url}?r=1 (url ${url})`]
  if (JSON.stringify(said) !== JSON.stringify(want)) throw new Error(`said ${JSON.stringify(said)}`)
  const rows = all<{ object_id: string; withdrawn_at: number | null }>(`select object_id, withdrawn_at from ap_sent`)
  if (rows.length !== 1 || rows[0]!.object_id !== `${url}?r=1` || rows[0]!.withdrawn_at !== null) throw new Error(`the ledger holds ${JSON.stringify(rows)}`)
  if ((await sweep()).length !== 0) throw new Error('a pass after the return said something again')
}
