import { describe, expect, it } from 'vitest'

import { createDefaultLogoLayer, createDefaultRecipe } from '@/core/template/defaultRecipe'
import type { StudioPhoto } from '@/types/photo'
import type { VisualRecipe } from '@/types/template'

import { calculateLogoTargetWidth } from './batchRenderClient'

function createPhoto(width: number): StudioPhoto {
  return {
    id: `photo-${width}`,
    file: new File([], 'arac.jpg', { type: 'image/jpeg' }),
    objectUrl: 'blob:test',
    width,
    height: Math.round(width * 0.75),
    orientation: 'landscape',
    adjustments: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
  }
}

function createRecipeWithLogo(widthPercent: number): VisualRecipe {
  return {
    ...createDefaultRecipe(),
    layers: [{ ...createDefaultLogoLayer(), widthPercent }],
  }
}

describe('calculateLogoTargetWidth', () => {
  it('setteki en geniş fotoğrafa göre logo çözünürlüğü ister', () => {
    const photos = [createPhoto(1600), createPhoto(6000), createPhoto(3000)]

    expect(calculateLogoTargetWidth(photos, createRecipeWithLogo(20))).toBe(1200)
  })

  it('logo katmanı yokken rasterleştirme boyutu istemez', () => {
    expect(calculateLogoTargetWidth([createPhoto(6000)], createDefaultRecipe())).toBe(1)
  })

  it('fotoğraf listesi boşken en küçük geçerli genişliği döndürür', () => {
    expect(calculateLogoTargetWidth([], createRecipeWithLogo(20))).toBe(1)
  })
})
