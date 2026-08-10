import { AdminI18nProvider, Card, Setting, Switch } from 'quireink'

// The provider holds the admin language in state so the picker can switch the whole UI
// instantly, before the save round-trip. It renders nothing itself, so each cell shows a
// consumer under a different `lang` — which is also the clearest way to see that the shipped
// fonts carry the Vietnamese subset.
export function English() {
  return (
    <AdminI18nProvider lang="en">
      <Card title="Reading">
        <Setting label="Show reading time" note="An estimate above the article body." inline>
          <Switch checked onChange={() => {}} />
        </Setting>
      </Card>
    </AdminI18nProvider>
  )
}

export function Vietnamese() {
  return (
    <AdminI18nProvider lang="vi">
      <Card title="Đọc">
        <Setting label="Hiện thời gian đọc" note="Ước lượng đặt phía trên nội dung bài." inline>
          <Switch checked onChange={() => {}} />
        </Setting>
      </Card>
    </AdminI18nProvider>
  )
}
