import { describe, expect, it } from 'vitest'

import {
  buildPhotoFilter,
  createDefaultPhotoAdjustments,
  hasPhotoAdjustments,
  normalizePhotoAdjustments,
} from './photoAdjustments'

describe('photo adjustments', () => {
  it('creates independent neutral adjustment values', () => {
    const first = createDefaultPhotoAdjustments()
    const second = createDefaultPhotoAdjustments()

    first.brightness = 25

    expect(second).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
    })
    expect(hasPhotoAdjustments(first)).toBe(true)
    expect(hasPhotoAdjustments(second)).toBe(false)
  })

  it('clamps invalid and out-of-range values before rendering', () => {
    expect(
      normalizePhotoAdjustments({
        brightness: 140,
        contrast: -120,
        saturation: Number.NaN,
        warmth: 22.4,
      }),
    ).toEqual({
      brightness: 100,
      contrast: -100,
      saturation: 0,
      warmth: 22,
    })
  })

  it('builds the same bounded filter string for preview and export', () => {
    expect(
      buildPhotoFilter({
        brightness: 25,
        contrast: -15,
        saturation: 40,
        warmth: 30,
      }),
    ).toBe('brightness(125%) contrast(85%) saturate(140%)')
  })
})
