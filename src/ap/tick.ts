// THE ONE THING THE CLOCK CALLS. ADR 0059.
//
// Three steps, in this order and for this reason: make sure this blog has an identity, work out
// what it still has to say, then hand over what it owes. The first is what makes `since` mean
// "when the owner switched this on", and it is why the key is minted by the TICK rather than by
// the settings save — a save that generated a keypair would be a save that could fail slowly,
// and the moment an identity begins is better tied to the clock than to a button.

import { getSettings, resolveSiteUrl } from '@/content/settings'
import { apReady, keyIdOf } from '@/ap/actor'
import { ensureKeys } from '@/ap/keys'
import { sweepAnnounce } from '@/ap/announce'
import { deliverDue } from '@/ap/deliver'

export type ApTick = { announced: number; sent: number; failed: number }

const IDLE: ApTick = { announced: 0, sent: 0, failed: 0 }

/**
 * The run in flight, if there is one.
 *
 * ⚠️ ONE AT A TIME. The minute clock does not wait for the last tick, `/api/cron` and the hourly
 * tick call this too, and a run can take minutes: twenty deliveries to inboxes that time out at
 * fifteen seconds each. `due()` only reads the queue, so a second run started meanwhile read the
 * same rows and posted the same activities again. A tick that finds one running leaves it to it.
 */
let running: Promise<ApTick> | null = null

export async function apTick(): Promise<ApTick> {
  if (running) return IDLE
  running = tick()
  try {
    return await running
  } finally {
    running = null
  }
}

async function tick(): Promise<ApTick> {
  const settings = await getSettings()
  // ⚠️ OFF MEANS NOTHING LEAVES. Not "nothing new is announced" — nothing at all, including a
  // queue left over from before the switch was turned off. An owner who switches this off has
  // said stop, and a delivery that goes out afterwards is this blog speaking without them.
  if (!apReady(settings)) return IDLE

  const { createdAt } = ensureKeys()
  const site = resolveSiteUrl(settings)
  const announcements = await sweepAnnounce({ settings, site, since: createdAt })
  const { sent, failed } = await deliverDue(keyIdOf(site))
  return { announced: announcements.length, sent, failed }
}
