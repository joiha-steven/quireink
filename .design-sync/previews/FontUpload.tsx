import { FontUpload } from 'quireink'
import { SETTINGS } from './_fixtures'

// No uploaded face: the picker offers to add one, and the reading font stays a built-in.
export function NoCustomFont() {
  return <FontUpload value={SETTINGS.customFont} onChange={() => {}} />
}

export function WithUploadedFace() {
  return (
    <FontUpload
      value={{
        family: 'Cardo',
        faces: [
          { weight: 400, url: '/uploads/fonts/cardo-400.woff2' },
          { weight: 700, url: '/uploads/fonts/cardo-700.woff2' },
        ],
      }}
      onChange={() => {}}
    />
  )
}
