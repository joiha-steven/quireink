import { describe, it, expect } from '@/test/vitest'
import { videoEmbed, isVideoUrl, videoFileUrl, isVideoAttachment } from '@/render/video'

describe('videoEmbed', () => {
  it('maps a YouTube watch URL to a nocookie embed', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      embed: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
  })

  it('maps a youtu.be short link too', () => {
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')?.embed).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
  })

  it('maps a Vimeo URL to a player embed', () => {
    expect(videoEmbed('https://vimeo.com/123456789')).toEqual({
      kind: 'vimeo',
      embed: 'https://player.vimeo.com/video/123456789',
    })
  })

  it('maps a TikTok video URL to an embed', () => {
    expect(videoEmbed('https://www.tiktok.com/@user/video/7234567890123456789')?.kind).toBe(
      'tiktok',
    )
  })

  it('returns null for a non-video URL', () => {
    expect(videoEmbed('https://example.com/article')).toBeNull()
  })

  it('embeds a Spotify track/album/playlist', () => {
    expect(videoEmbed('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toEqual({
      kind: 'spotify',
      embed: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT',
    })
    expect(videoEmbed('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')?.embed).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    )
  })

  it('embeds an Apple Music album on the embed host', () => {
    expect(videoEmbed('https://music.apple.com/us/album/1989-taylors-version/1713845538')?.embed).toBe(
      'https://embed.music.apple.com/us/album/1989-taylors-version/1713845538',
    )
  })

  it('rejects an Apple Music URL with a quote (iframe-src breakout guard)', () => {
    expect(videoEmbed('https://music.apple.com/us/album/x"onerror=1/1')).toBeNull()
    expect(isVideoUrl('https://example.com/article')).toBe(false)
  })
})

describe('videoFileUrl (direct/self-hosted files)', () => {
  it('accepts absolute and root-relative video files, with query/hash', () => {
    expect(videoFileUrl('/uploads/files/a.mp4')).toBe('/uploads/files/a.mp4')
    expect(videoFileUrl('https://cdn.example.com/v.webm?x=1')).toBe('https://cdn.example.com/v.webm?x=1')
    expect(videoFileUrl('/uploads/files/a.MOV#t=3')).toBe('/uploads/files/a.MOV#t=3')
  })

  it('rejects non-video extensions and unsafe/relative schemes', () => {
    expect(videoFileUrl('/uploads/files/a.pdf')).toBeNull()
    expect(videoFileUrl('javascript:alert(1)//x.mp4')).toBeNull() // scheme gate
    expect(videoFileUrl('files/a.mp4')).toBeNull() // must be http(s) or root-relative
  })
})

describe('isVideoAttachment (Library tab split)', () => {
  it('classifies by MIME first, extension as fallback', () => {
    expect(isVideoAttachment('clip.mp4', 'video/mp4')).toBe(true)
    expect(isVideoAttachment('clip.bin', 'video/webm')).toBe(true) // MIME wins
    expect(isVideoAttachment('clip.mov', 'application/octet-stream')).toBe(true) // ext fallback
    expect(isVideoAttachment('doc.pdf', 'application/pdf')).toBe(false)
  })
})
