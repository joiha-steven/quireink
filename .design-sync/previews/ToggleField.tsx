import { ToggleField } from 'quireink'

export function On() { return <ToggleField checked onChange={() => {}} label="Show reading time" /> }
export function Off() { return <ToggleField checked={false} onChange={() => {}} label="Show author byline" /> }

export function AsAList() {
  return (
    <div className="flex flex-col gap-4 p-2">
      <ToggleField checked onChange={() => {}} label="Show reading time" />
      <ToggleField checked onChange={() => {}} label="Show table of contents" />
      <ToggleField checked={false} onChange={() => {}} label="Show author byline" />
    </div>
  )
}
