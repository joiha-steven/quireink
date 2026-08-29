// How tables are drawn (Admin → Settings → Appearance).
//
// One set for the whole blog, and that is the design. GFM has no syntax for a tinted header
// or a row rule, so the alternative is an attribute carried in the Markdown — which would
// make a table stop being something anybody can paste in or out. Measured against a real
// article of six tables (2026-08-29): one timeline of three short columns, five reference
// tables of two columns with cells past 150 characters. They were all ONE KIND. Nobody needed
// this table to differ from that one; they needed the default to be worth looking at.
//
// ⚠️ `head: 'tint'` is the only default in this product that does NOT reproduce today.
// `content/settings-table.ts` holds the reason and the previous rendering's exact settings.

import type { TableSettings } from '@/types'
import { NOTE_TEXT, PANEL_LIST, SETTING_GAP } from './kit'
import { ToggleRow } from '@/admin/ui/Switch'
import { Choice } from './Choice'
import { useAdminT } from './I18nProvider'

export function TableFields({ table, onChange }: {
  table: TableSettings
  onChange: (t: TableSettings) => void
}) {
  const t = useAdminT()

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.tableHint}</p>

      <Choice
        label={t.tableHead}
        note={t.tableHeadHint}
        value={table.head}
        options={[
          { value: 'plain', label: t.tableHeadPlain },
          { value: 'tint', label: t.tableHeadTint },
          { value: 'rule', label: t.tableHeadRule },
          { value: 'ink', label: t.tableHeadInk },
        ]}
        onChange={(head) => onChange({ ...table, head })}
      />

      <Choice
        label={t.tableGrid}
        note={t.tableGridHint}
        value={table.grid}
        options={[
          { value: 'all', label: t.tableGridAll },
          { value: 'rows', label: t.tableGridRows },
          { value: 'none', label: t.tableGridNone },
        ]}
        onChange={(grid) => onChange({ ...table, grid })}
      />

      <Choice
        label={t.tableRuleWeight}
        note={t.tableRuleWeightHint}
        value={table.ruleWeight}
        options={[
          { value: 'hairline', label: t.tableHairline },
          { value: 'bold', label: t.tableThick },
        ]}
        onChange={(ruleWeight) => onChange({ ...table, ruleWeight })}
      />

      <Choice
        label={t.tableFirstCol}
        note={t.tableFirstColHint}
        value={table.firstColumn}
        options={[
          { value: 'normal', label: t.tableColNormal },
          { value: 'strong', label: t.tableColStrong },
        ]}
        onChange={(firstColumn) => onChange({ ...table, firstColumn })}
      />

      {/* The air words are the SHAPE card's, deliberately: this is the same question that
          card asks about the page, asked about a cell, and two vocabularies for one idea is
          how a settings screen stops being readable. */}
      <Choice
        label={t.tablePadding}
        note={t.tablePaddingHint}
        value={table.padding}
        options={[
          { value: 'tight', label: t.shapeCompact },
          { value: 'normal', label: t.shapeNormal },
          { value: 'roomy', label: t.shapeRelaxed },
        ]}
        onChange={(padding) => onChange({ ...table, padding })}
      />

      <Choice
        label={t.tableNarrow}
        note={t.tableNarrowHint}
        value={table.narrow}
        options={[
          { value: 'fit', label: t.tableNarrowFit },
          { value: 'scroll', label: t.tableNarrowScroll },
        ]}
        onChange={(narrow) => onChange({ ...table, narrow })}
      />

      {/* A switch rather than a two-option Choice: it is on or off, and the six above are
          all "which one", so drawing it as a seventh track would say it is the same kind of
          question. `PANEL_LIST` because ToggleRow carries its own padding and expects the
          boxed row the feature lists put it in. */}
      <div className={PANEL_LIST}>
        <ToggleRow
          label={t.tableStripe}
          desc={t.tableStripeHint}
          checked={table.stripe}
          onChange={(stripe) => onChange({ ...table, stripe })}
        />
      </div>
    </div>
  )
}
