// The site-wide default frame: what every picture wears unless it says otherwise.
//
// It exists for the same reason the gallery defaults do, and answers the same complaint. A
// site with three hundred pictures has one look for them, not three hundred decisions; and
// an archive that arrives from somewhere else arrives unframed, so "put a frame on all of
// it" has to be one screen rather than one picture at a time.
//
// Applied as CSS, never as markup. A rendered body is cached under a hash of its input, so a
// default that rewrote the HTML would leave every already-rendered post wearing the old
// frame until something unrelated evicted it. Through CSS the change lands on the next
// paint, everywhere, with nothing re-rendered — which is also why this screen has no "apply
// to existing posts" button to explain.
//
// `none` at install, on the owner's instruction: a frame is a decision about a site's voice,
// and arriving with one already made is a default nobody asked for.

import type { FigureSettings } from '@/types'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, SEGMENT_TRACK, tabItemClass } from './kit'

const LABEL = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300'

const FRAMES: FigureSettings['frame'][] = ['none', 'thin', 'medium', 'thick']

export function FigureFields({ figure, onChange }: {
  figure: FigureSettings
  onChange: (f: FigureSettings) => void
}) {
  const t = useAdminT()
  const framed = figure.frame !== 'none'

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={LABEL}>{t.figureFrame}</span>
        <div className={`${SEGMENT_TRACK} flex-wrap`}>
          {FRAMES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChange({ ...figure, frame: f })}
              className={tabItemClass(figure.frame === f, 'sm')}
            >
              {f === 'none' ? t.imgFrameNone
                : f === 'thin' ? t.imgFrameThin
                  : f === 'medium' ? t.imgFrameMedium : t.imgFrameThick}
            </button>
          ))}
        </div>
        <p className={NOTE_TEXT}>{t.figureFrameHint}</p>
      </div>

      {/* The mat's colour is only a question once there is a mat, so it appears with one. */}
      {framed && (
        <div className="space-y-2">
          <span className={LABEL}>{t.figureFrameColour}</span>
          <div className={SEGMENT_TRACK}>
            <button type="button" onClick={() => onChange({ ...figure, ink: false })} className={tabItemClass(!figure.ink, 'sm')}>
              {t.imgFramePaper}
            </button>
            <button type="button" onClick={() => onChange({ ...figure, ink: true })} className={tabItemClass(figure.ink, 'sm')}>
              {t.imgFrameInk}
            </button>
          </div>
          <p className={NOTE_TEXT}>{t.figureFrameColourHint}</p>
        </div>
      )}
    </div>
  )
}
