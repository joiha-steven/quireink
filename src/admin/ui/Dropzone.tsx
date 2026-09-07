// The upload zone: drop files on it, or reach it with the keyboard.
//
// It existed twice, byte for byte, in ImageUploader and FileUploader, and both copies were a
// `<div onClick>` in front of a `hidden` file input. A div is not a control: Tab went past
// it, Enter and Space did nothing, and a screen reader read a line of grey text with nothing
// to say it could be operated. The only way to add a file was a pointer.
//
// One primitive, and the primitive is a button. The input stays hidden and stays OUTSIDE the
// button, because a form control inside a button is not something a browser has to honour.
import { useRef, useState, type ReactNode } from 'react'
import { DROPZONE, DROPZONE_IDLE, DROPZONE_OVER } from '@/admin/components/kit'

export function Dropzone({
  label,
  accept,
  progress,
  onFiles,
}: {
  label: ReactNode
  accept?: string
  /** 0 to 100 while an upload is in flight, null when there is none. */
  progress: number | null
  onFiles: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(Array.from(e.dataTransfer.files)) }}
        className={`${DROPZONE} block w-full ${dragging ? DROPZONE_OVER : DROPZONE_IDLE}`}
      >
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />
      {progress !== null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
        >
          {/* A transform, not a width: the fill scales on the compositor instead of re-laying
              out the bar on every tick of the upload. */}
          <div className="h-full w-full origin-left bg-neutral-900 transition-transform" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      )}
    </div>
  )
}
