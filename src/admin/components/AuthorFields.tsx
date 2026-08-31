// Who wrote this blog (Admin → Settings → Site).
//
// One blog, one owner (ADR 0002), so this is a person and not a table of them. It sits on
// SITE, beside the title and the marks, because it answers the same question they do — what
// is this site, and whose is it — rather than "what does a reader get on a post".
//
// ⚠️ THE NAME IS THE SWITCH. Empty means silence: no byline, no author box, and no `author`
// in the JSON-LD, which is what every install did before this existed. That is why the note
// above says so before the first field rather than after the last, and why nothing here is
// marked required.
//
// The portrait uses the MEDIA LIBRARY PICKER, the same control the logo uses and for the
// same reason: the server collapses and expands it as a blob reference like every other
// stored image (Invariant 3 — stored bytes carry no origin), so a typed-in address would be
// the one image ref on the site that does not travel.

import { useState } from 'react'
import type { AuthorSettings } from '@/types'
import { Input, Textarea } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { MediaLibrary } from './MediaLibrary'
import { NOTE_TEXT, Setting, SETTING_GAP } from './kit'
import { useAdminT } from './I18nProvider'
import { EMPTY_SLOT } from './slot'

export function AuthorFields({ author, onChange }: {
  author: AuthorSettings
  onChange: (a: AuthorSettings) => void
}) {
  const t = useAdminT()
  const [picking, setPicking] = useState(false)

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.authorHint}</p>

      <Input
        label={t.authorName}
        note={t.authorNameHint}
        value={author.name}
        maxLength={80}
        onChange={(e) => onChange({ ...author, name: e.target.value })}
      />

      <Textarea
        label={t.authorBio}
        note={t.authorBioHint}
        rows={3}
        value={author.bio}
        maxLength={400}
        onChange={(e) => onChange({ ...author, bio: e.target.value })}
      />

      <Setting label={t.authorAvatar} note={t.authorAvatarHint}>
        <div className="space-y-3">
          {author.avatarUrl
            ? <img src={author.avatarUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            : (
              // The slot at the portrait's own size, so choosing one does not move the
              // buttons under it, with the sentence beside it: 64px has no room for words.
              <div className="flex items-center gap-3">
                <span aria-hidden className={`${EMPTY_SLOT} h-16 w-16 shrink-0 rounded-lg`} />
                <p className={NOTE_TEXT}>{t.authorNoAvatar}</p>
              </div>
            )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>{t.chooseImage}</Button>
            {author.avatarUrl && (
              <Button variant="ghost" type="button" onClick={() => onChange({ ...author, avatarUrl: '' })}>
                {t.removeSelection}
              </Button>
            )}
          </div>
        </div>
      </Setting>

      <Input
        label={t.authorLink}
        note={t.authorLinkHint}
        type="url"
        inputMode="url"
        value={author.url}
        placeholder="https://"
        onChange={(e) => onChange({ ...author, url: e.target.value })}
      />

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            onChange({ ...author, avatarUrl: url })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
