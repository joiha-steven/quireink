import { MediaToolbar } from 'quireink'

export function Basic() {
  return (
    <MediaToolbar
      count={612}
      totalSize={1_503_238_553}
      query=""
      onQuery={() => {}}
      sort="new"
      onSort={() => {}}
    />
  )
}

export function Searching() {
  return (
    <MediaToolbar
      count={7}
      totalSize={18_442_190}
      query="keyboard"
      onQuery={() => {}}
      sort="size"
      onSort={() => {}}
    />
  )
}

export function EmptyLibrary() {
  return (
    <MediaToolbar count={0} totalSize={0} query="" onQuery={() => {}} sort="name" onSort={() => {}} />
  )
}
