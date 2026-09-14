// THE THREE WAYS A PICTURE GETS INTO SETTINGS: the library picker, a direct upload to the files
// store, and a plain preview beside the pair of keys that change it.
//
// All three ship drawn in the state the server can see, and the island only ever swaps a `src`,
// an emptiness and a `hidden`. Nothing here builds a row.
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT } from '@/admin-shared/scale'
import { EMPTY_SLOT } from '@/admin-shared/slot'
import { hiddenField } from '@/web/admin/fields'

/** A block that is in the DOM whether or not it applies, with no curtain: React mounted these
 *  on a condition, which pops rather than animates, and a conversion is not the place to
 *  change how something appears. */
export const gate = (open: boolean, body: string, attrs = ''): string =>
  `<div${attrs ? ` ${attrs}` : ''}${open ? '' : ' hidden'}>${body}</div>`

/**
 * A PICTURE CHOSEN FROM THE LIBRARY: the preview, the key that opens the picker, and the key
 * that takes it away.
 *
 * `data-k` rides on a hidden input rather than on anything visible, because what is stored is a
 * URL and there is no field for it: the picker answers, the island writes the value here, and
 * the form's diff sees it like every other field.
 */
export function pickedImage(f: {
  k: string
  value: string
  chooseLabel: string
  removeLabel: string
  emptyLabel: string
  previewClass: string
  alt: string
  /**
   * SLOT · WORDS · KEYS on one line, rather than stacked.
   *
   * The portrait takes this and the two logos do not, and the difference is the picture: a
   * 16px-square avatar sits beside its keys, a full-width wordmark cannot.
   */
  row?: boolean
  /** The empty state as a WELL rather than a sentence, where there is room to draw one. */
  slotClass?: string
}): string {
  const empty = f.slotClass
    ? `<span aria-hidden="true" data-pick-slot class="${EMPTY_SLOT} ${f.slotClass}"`
      + `${f.value ? ' hidden' : ''}></span>`
      // NOT `NOTE_TEXT`: that carries `admin-note`, so with the explanations hidden this row
      // would lose the words beside its slot while the favicon and app-icon rows kept theirs.
      // "No image chosen" is the slot's STATE, not an explanation of it.
      + `<span class="text-xs text-neutral-500 dark:text-neutral-400" data-pick-none`
      + `${f.value ? ' hidden' : ''}>${escapeHtml(f.emptyLabel)}</span>`
    : `<p class="${NOTE_TEXT}" data-pick-none${f.value ? ' hidden' : ''}>${escapeHtml(f.emptyLabel)}</p>`
  return `<div class="${f.row ? 'flex flex-wrap items-center gap-3' : 'space-y-3'}" data-pick-image>`
    + hiddenField(f.k, f.value)
    + `<img src="${escapeAttr(f.value)}" alt="${escapeAttr(f.alt)}" data-pick-preview`
    + ` class="${f.previewClass}"${f.value ? '' : ' hidden'}>`
    + empty
    + `<div class="flex${f.row ? '' : ' flex-wrap'} gap-2">`
    + `<button type="button" data-pick-open class="${buttonClass('secondary')}">`
    + `${escapeHtml(f.chooseLabel)}</button>`
    + `<button type="button" data-pick-clear class="${buttonClass('ghost')}"${f.value ? '' : ' hidden'}>`
    + `${escapeHtml(f.removeLabel)}</button></div></div>`
}

/**
 * A SITE ICON, uploaded straight to the files store rather than chosen from the library.
 *
 * Deliberately not the media grid: a favicon is not a picture in the blog, and putting it there
 * would leave it in the library to be deleted by somebody tidying up.
 *
 * ⚠️ ONE FOOTPRINT, whatever size the picture inside it is. The slot is drawn at the size the
 * picture will be — a favicon is 32px and an app icon is not — so the row does not change height
 * the moment one goes in. Measured on the Blog tab: the two rows sit in the same card and their
 * "Choose an image" keys landed 16px apart, because the 32px slot and the 48px slot pushed the
 * words along by different amounts. The box is the larger of the two; the picture is centred in
 * it and keeps its own size.
 */
export function iconUpload(f: {
  k: string
  kind: 'favicon' | 'app-icon'
  value: string
  previewClass: string
  chooseLabel: string
  removeLabel: string
  emptyLabel: string
}): string {
  return `<div class="flex items-center gap-3" data-icon="${escapeAttr(f.kind)}">`
    + hiddenField(f.k, f.value)
    + `<span class="flex h-12 w-12 shrink-0 items-center justify-center">`
    + `<img src="${escapeAttr(f.value)}" alt="" data-icon-preview`
    + ` class="bg-neutral-100 object-contain p-1 ${f.previewClass}"${f.value ? '' : ' hidden'}>`
    + `<span aria-hidden="true" data-icon-slot class="${EMPTY_SLOT} shrink-0 ${f.previewClass}"`
    + `${f.value ? ' hidden' : ''}></span></span>`
    // "No image" is worth saying rather than implying, and it goes beside the slot because a
    // 32px square has no room for it.
    + `<span class="text-xs text-neutral-500 dark:text-neutral-400" data-icon-none`
    + `${f.value ? ' hidden' : ''}>${escapeHtml(f.emptyLabel)}</span>`
    + `<input type="file" hidden data-icon-file`
    + ` accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp,image/x-icon,.ico">`
    + `<button type="button" data-icon-open class="${buttonClass('secondary')}">`
    + `${escapeHtml(f.chooseLabel)}</button>`
    + `<button type="button" data-icon-clear class="${buttonClass('ghost')}"${f.value ? '' : ' hidden'}>`
    + `${escapeHtml(f.removeLabel)}</button></div>`
}
