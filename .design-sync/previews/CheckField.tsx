import { CheckField } from 'quireink'

export function Checked() { return <CheckField checked onChange={() => {}} label="Send a newsletter when this publishes" /> }
export function Unchecked() { return <CheckField checked={false} onChange={() => {}} label="Allow comments on this post" /> }
export function Disabled() { return <CheckField checked={false} onChange={() => {}} label="Requires an SMTP server" disabled /> }

export function AsAList() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <CheckField checked onChange={() => {}} label="Include drafts in the export" />
      <CheckField checked onChange={() => {}} label="Include media files" />
      <CheckField checked={false} onChange={() => {}} label="Include revisions" />
      <CheckField checked={false} onChange={() => {}} label="Include analytics" disabled />
    </div>
  )
}
