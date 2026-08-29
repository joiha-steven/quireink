// The featured-image picker on the post and page sidebars.
//
// One component because it is one control. Written out twice it had already drifted: the
// label was a hand-typed `text-neutral-700 dark:text-neutral-300` against the kit's
// `SETTING_LABEL`, a shade off in both modes, and the post copy had picked up a second
// `dark:text-neutral-400` on its empty state — the same class listed twice, which is what a
// careless edit to a duplicate looks like from the outside.
//
// Not to be confused with `FeaturedField.tsx`, which picks featured POSTS for the home page.
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, SETTING_LABEL } from './kit'

export function FeaturedImageField(
  { value, onPick, onClear }: { value: string; onPick: () => void; onClear: () => void },
) {
  const t = useAdminT()
  return (
    <div className="space-y-1.5">
      <span className={SETTING_LABEL}>{t.featuredImage}</span>
      <p className={NOTE_TEXT}>{t.featuredImageHint}</p>
      {value ? (
        <img src={value} alt="" className="aspect-video w-full rounded-lg object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {t.noImageSelected}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onPick} type="button">
          {t.chooseImage}
        </Button>
        {value && (
          <Button variant="ghost" onClick={onClear} type="button">
            {t.removeSelection}
          </Button>
        )}
      </div>
    </div>
  )
}
