import { Trend } from 'quireink'

// Trend is a suffix, not a standalone: `ml-2 align-middle` means it is drawn to sit after a
// number. It also renders NOTHING when `prev` is missing or zero, or when the change rounds
// to 0% — so a "flat" cell on its own would be a deliberately blank card. Those cases appear
// here as the absence they are, beside the value they belong to.
export function Up() {
  return (
    <div className="p-3 text-[1.65rem] font-semibold tracking-tight tabular-nums">
      4,218<Trend cur={4218} prev={3106} />
    </div>
  )
}

export function Down() {
  return (
    <div className="p-3 text-[1.65rem] font-semibold tracking-tight tabular-nums">
      1,907<Trend cur={1907} prev={2544} />
    </div>
  )
}

export function RendersNothing() {
  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div>
        <span className="text-[1.65rem] font-semibold tabular-nums">880</span>
        <Trend cur={880} prev={880} />
        <span className="ml-3 text-neutral-500">no change — Trend renders nothing</span>
      </div>
      <div>
        <span className="text-[1.65rem] font-semibold tabular-nums">4,218</span>
        <Trend cur={4218} />
        <span className="ml-3 text-neutral-500">no baseline — Trend renders nothing</span>
      </div>
    </div>
  )
}

// How the analytics header actually reads.
export function InStatRow() {
  return (
    <div className="grid grid-cols-3 gap-6 p-3">
      <div>
        <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">
          4,218<Trend cur={4218} prev={3106} />
        </div>
        <div className="mt-1.5 text-sm text-neutral-500">Views</div>
      </div>
      <div>
        <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">
          1,902<Trend cur={1902} prev={1740} />
        </div>
        <div className="mt-1.5 text-sm text-neutral-500">Visitors</div>
      </div>
      <div>
        <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">
          18<Trend cur={18} prev={27} />
        </div>
        <div className="mt-1.5 text-sm text-neutral-500">Comments</div>
      </div>
    </div>
  )
}
