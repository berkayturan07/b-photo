import { describe, expect, it } from 'vitest'

import { toKonvaFontStyle } from './konvaText'

describe('toKonvaFontStyle', () => {
  it('sayısal ağırlığı olduğu gibi aktarır', () => {
    expect(toKonvaFontStyle(400)).toBe('400')
    expect(toKonvaFontStyle(600)).toBe('600')
    expect(toKonvaFontStyle(700)).toBe('700')
  })

  it('hiçbir ağırlığı `bold` anahtar kelimesine çevirmez', () => {
    // `bold` 700 demektir; 600 için kullanılırsa çizim ölçümden geniş olur ve
    // önizlemede son harf kırpılır.
    for (const weight of [400, 600, 700]) {
      expect(toKonvaFontStyle(weight)).not.toBe('bold')
      expect(toKonvaFontStyle(weight)).not.toBe('normal')
    }
  })
})
