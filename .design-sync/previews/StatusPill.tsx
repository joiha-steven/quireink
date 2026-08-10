import { StatusPill } from 'quireink'

export function Published() {
  return <StatusPill published label="Published" />
}

export function Draft() {
  return <StatusPill published={false} label="Draft" />
}

export function BothStates() {
  return (
    <div className="flex flex-col items-start gap-3 p-2">
      <StatusPill published label="Published" />
      <StatusPill published={false} label="Draft" />
    </div>
  )
}
