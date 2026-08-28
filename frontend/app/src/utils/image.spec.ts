import { describe, expect, it } from 'vitest'

import {
  classifyOrientation,
  formatBytes,
  isSupportedImage,
  isSupportedLogo,
  orientationLabel,
} from './image'

describe('image utilities', () => {
  it('classifies landscape, portrait and square photos', () => {
    expect(classifyOrientation(1600, 1200)).toBe('landscape')
    expect(classifyOrientation(1200, 1600)).toBe('portrait')
    expect(classifyOrientation(1080, 1080)).toBe('square')
  })

  it('returns Turkish orientation labels', () => {
    expect(orientationLabel('landscape')).toBe('Yatay')
    expect(orientationLabel('portrait')).toBe('Dikey')
    expect(orientationLabel('square')).toBe('Kare')
  })

  it('formats file sizes for the interface', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('accepts supported image mime types and extensions', () => {
    expect(isSupportedImage(new File([], 'arac.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(isSupportedImage(new File([], 'arac.webp'))).toBe(true)
    expect(isSupportedImage(new File([], 'arac.gif', { type: 'image/gif' }))).toBe(false)
  })

  it('accepts SVG only for logo assets', () => {
    const svgLogo = new File([], 'logo.svg', { type: 'image/svg+xml' })

    expect(isSupportedLogo(svgLogo)).toBe(true)
    expect(isSupportedImage(svgLogo)).toBe(false)
  })
})
