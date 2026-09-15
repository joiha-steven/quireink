// HEARING THE KEY FEEDBACK WHILE CHOOSING IT.
//
// ⚠️ FOUR BEHAVIOURS WENT MISSING IN ADR 0054, NOT ONE. The Account tab's `data-sound-hear` key
// was the visible casualty — a button drawn with no reader — but the React card it replaced
// also played the instrument when you picked one, played a single key as you dragged the volume,
// and squeaked when the pen switch went on. None of the four survived, and the synthesiser they
// call is untouched: `components/key-sound.ts` still runs on every keystroke in the writing
// sheet. Only this screen went quiet.
//
// `keyVolumeDesc` says, in eleven languages, "Moving it plays a key, so you can hear where you
// are putting it." That sentence was false in the shipped build. Restoring the behaviour is what
// makes it true again; editing the sentence would have been the wrong repair.
//
// ⚠️ LOADED ON FIRST TOUCH, NOT WITH THE SCREEN. The engine is ~21 KB of source — the voice
// tables in `key-render.ts` are most of it — and the settings bundle is the heaviest markup page
// in the admin. Nobody who never opens the Account tab should pay for a sound they did not ask
// to hear, so it arrives on the first gesture that would make a noise.
//
// It says nothing when anything fails, which is the engine's own contract: no `AudioContext`, a
// volume of zero, a suspended context and a chunk that is no longer on the server are all
// answered the same way a silent instrument is — with silence. A preview has no result to report.
import type { KeyFeedback } from '@/types'

type Engine = {
  playPhrase: (sound: { mode: KeyFeedback; volume: number }) => void
  previewKey: (sound: { mode: KeyFeedback; volume: number }) => void
  playSqueak: (sound: { mode: KeyFeedback; volume: number; squeak?: boolean }, kind: 'hl') => void
}

/** One load, however many gestures follow. A rejected import is retried on the next one. */
let engine: Promise<Engine> | null = null
async function sound(): Promise<Engine | null> {
  engine ??= Promise.all([
    import('@/admin/components/key-sound'),
    import('@/admin/components/pen-sound'),
  ]).then(([keys, pen]) => ({
    playPhrase: keys.playPhrase, previewKey: keys.previewKey, playSqueak: pen.playSqueak,
  }))
  try {
    return await engine
  } catch {
    engine = null
    return null
  }
}

/** The two controls that decide what a preview sounds like, read at the moment of the gesture. */
function chosen(screen: HTMLElement): { mode: KeyFeedback; volume: number } {
  const mode = screen.querySelector<HTMLSelectElement>('[data-k="motion.keys"]')?.value ?? 'off'
  const volume = Number(screen.querySelector<HTMLInputElement>('[data-k="motion.keyVolume"]')?.value ?? 0)
  return { mode: mode as KeyFeedback, volume: Number.isFinite(volume) ? volume : 0 }
}

export function wireSound(screen: HTMLElement): void {
  const play = (pick: (e: Engine, at: { mode: KeyFeedback; volume: number }) => void): void => {
    void sound().then((e) => { if (e) pick(e, chosen(screen)) })
  }

  screen.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('[data-sound-hear]')) {
      play((e, at) => e.playPhrase(at))
    }
  })

  screen.addEventListener('change', (ev) => {
    const target = ev.target as HTMLElement
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return
    // Picking an instrument plays it. Without this the only way to compare three of them is to
    // save, open a post, and type.
    if (target.dataset.k === 'motion.keys') { play((e, at) => e.playPhrase(at)); return }
    // And the squeak, only on the way ON: turning a sound off should not make one.
    if (target.dataset.k === 'motion.penSqueak' && target instanceof HTMLInputElement && target.checked) {
      play((e, at) => e.playSqueak({ ...at, squeak: true }, 'hl'))
    }
  })

  // ⚠️ THROTTLED, BECAUSE A DRAG IS NOT A GESTURE — it is forty of them. A range input fires
  // `input` on every pixel, and forty overlapping key sounds is a noise nobody can judge a
  // volume by. 110ms is the floor the React card used and it is roughly one key at speed.
  let last = 0
  screen.addEventListener('input', (ev) => {
    const target = ev.target as HTMLElement
    if (!(target instanceof HTMLInputElement) || target.dataset.k !== 'motion.keyVolume') return
    const now = Date.now()
    if (now - last < 110) return
    last = now
    play((e, at) => e.previewKey(at))
  })
}
