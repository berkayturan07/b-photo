import { describe, expect, it } from 'vitest'

import { assertRenderableSize, MAX_CANVAS_SIDE } from './renderScene'

describe('assertRenderableSize', () => {
  it('olağan ilan fotoğrafı ölçülerini kabul eder', () => {
    expect(() => assertRenderableSize(6000, 4000)).not.toThrow()
    expect(() => assertRenderableSize(1, 1)).not.toThrow()
  })

  it('okunamayan ölçüleri reddeder', () => {
    expect(() => assertRenderableSize(0, 1080)).toThrow('ölçüleri okunamadı')
    expect(() => assertRenderableSize(Number.NaN, 1080)).toThrow('ölçüleri okunamadı')
  })

  it('tuval alanı sınırını aşan fotoğrafı megapiksel bilgisiyle reddeder', () => {
    expect(() => assertRenderableSize(30_000, 30_000)).toThrow('900 MP')
  })

  it('tek kenar sınırını aşan fotoğrafı reddeder', () => {
    expect(() => assertRenderableSize(MAX_CANVAS_SIDE + 1, 10)).toThrow('küçük çözünürlüklü')
  })
})
