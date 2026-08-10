import { Tabs } from 'quireink'

// 'underline' is what Settings uses: chips on a tinted rail.
export function Underline() {
  return (
    <Tabs
      tabs={[
        { key: 'site', label: 'Site' },
        { key: 'reading', label: 'Reading' },
        { key: 'appearance', label: 'Appearance' },
        { key: 'comments', label: 'Comments' },
        { key: 'advanced', label: 'Advanced' },
      ]}
      value="reading"
      onChange={() => {}}
    />
  )
}

// 'segment' is what Content uses: a segmented control on a tinted track.
export function Segment() {
  return (
    <Tabs
      tabs={[
        { key: 'posts', label: 'Posts' },
        { key: 'pages', label: 'Pages' },
      ]}
      value="posts"
      onChange={() => {}}
      variant="segment"
    />
  )
}

export function BothVariants() {
  return (
    <div className="flex flex-col items-start gap-4 p-2">
      <Tabs
        tabs={[{ key: 'a', label: 'Site' }, { key: 'b', label: 'Reading' }, { key: 'c', label: 'Advanced' }]}
        value="a"
        onChange={() => {}}
      />
      <Tabs
        tabs={[{ key: 'a', label: 'Posts' }, { key: 'b', label: 'Pages' }]}
        value="b"
        onChange={() => {}}
        variant="segment"
      />
    </div>
  )
}
