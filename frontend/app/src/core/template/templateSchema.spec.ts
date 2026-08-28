import { describe, expect, it } from 'vitest'

import {
  createDefaultLogoLayer,
  createDefaultRecipe,
  createDefaultTextLayer,
  createDefaultWatermarkLayer,
} from './defaultRecipe'
import {
  CURRENT_RECIPE_SCHEMA_VERSION,
  createDuplicateName,
  parseTemplateName,
  parseTemplateVariables,
  parseVisualRecipe,
} from './templateSchema'

function createValidRecipe(): Record<string, unknown> {
  return {
    ...createDefaultRecipe(),
    layers: [createDefaultWatermarkLayer(), createDefaultLogoLayer(), createDefaultTextLayer()],
  }
}

describe('parseVisualRecipe', () => {
  it('geçerli bir reçeteyi onarım gerektirmeden kabul eder', () => {
    const result = parseVisualRecipe(createValidRecipe())

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.repairs).toEqual([])
    expect(result.recipe.schemaVersion).toBe(CURRENT_RECIPE_SCHEMA_VERSION)
    expect(result.recipe.layers.map((layer) => layer.role)).toEqual([
      'watermark',
      'logo',
      'text',
    ])
  })

  it('nesne olmayan veya sürümsüz kayıtları reddeder', () => {
    expect(parseVisualRecipe(null)).toMatchObject({ ok: false, code: 'malformed' })
    expect(parseVisualRecipe('{}')).toMatchObject({ ok: false, code: 'malformed' })
    expect(parseVisualRecipe([])).toMatchObject({ ok: false, code: 'malformed' })

    const withoutVersion = createValidRecipe()
    delete withoutVersion.schemaVersion
    expect(parseVisualRecipe(withoutVersion)).toMatchObject({
      ok: false,
      code: 'missing-version',
    })
  })

  it('daha yeni sürümü açmaz ve sürümü mesajda bildirir', () => {
    const result = parseVisualRecipe({ ...createValidRecipe(), schemaVersion: 2 })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.code).toBe('newer-version')
    expect(result.message).toContain('2')
  })

  it('desteklenmeyen eski sürümü reddeder', () => {
    expect(parseVisualRecipe({ ...createValidRecipe(), schemaVersion: 0 })).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    })
  })

  it('katman listesi bozuksa veya kullanılabilir katman kalmazsa hata döner', () => {
    expect(parseVisualRecipe({ ...createValidRecipe(), layers: 'yok' })).toMatchObject({
      ok: false,
      code: 'malformed',
    })
    expect(parseVisualRecipe({ ...createValidRecipe(), layers: [] })).toMatchObject({
      ok: false,
      code: 'no-usable-layers',
    })
    expect(
      parseVisualRecipe({ ...createValidRecipe(), layers: [{ role: 'sticker' }, null] }),
    ).toMatchObject({ ok: false, code: 'no-usable-layers' })
  })

  it('aralık dışı sayısal değerleri güvenli sınıra çeker', () => {
    const result = parseVisualRecipe({
      ...createValidRecipe(),
      layers: [
        { ...createDefaultLogoLayer(), widthPercent: 400, opacity: 12, xPercent: -50 },
        { ...createDefaultTextLayer(), fontSizePercent: 90, paddingPercent: 99 },
        { ...createDefaultWatermarkLayer(), rotation: -720, gapXPercent: 0 },
      ],
      output: { format: 'jpeg', quality: 4 },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const [logo, text, watermark] = result.recipe.layers
    expect(logo).toMatchObject({ widthPercent: 70, opacity: 1, xPercent: 0 })
    expect(text).toMatchObject({ fontSizePercent: 10, paddingPercent: 3 })
    expect(watermark).toMatchObject({ rotation: -75, gapXPercent: 10 })
    expect(result.recipe.output.quality).toBe(1)
    expect(result.repairs.length).toBeGreaterThan(0)
  })

  it('geçersiz tip, renk ve seçenek değerlerini varsayılana döndürür', () => {
    const result = parseVisualRecipe({
      ...createValidRecipe(),
      canvas: { mode: 'square' },
      layers: [
        {
          ...createDefaultTextLayer(),
          value: 42,
          color: 'kirmizi',
          backgroundColor: '#ABC',
          fontWeight: 123,
          backgroundEnabled: 'evet',
        },
        { ...createDefaultWatermarkLayer(), mode: 'diagonal' },
      ],
      output: { format: 'tiff', quality: 'yüksek' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const defaults = createDefaultTextLayer()
    expect(result.recipe.canvas).toEqual({ mode: 'original' })
    expect(result.recipe.layers[0]).toMatchObject({
      value: defaults.value,
      color: defaults.color,
      backgroundColor: '#aabbcc',
      fontWeight: defaults.fontWeight,
      backgroundEnabled: defaults.backgroundEnabled,
    })
    expect(result.recipe.layers[1]).toMatchObject({ mode: createDefaultWatermarkLayer().mode })
    expect(result.recipe.output).toEqual({ format: 'jpeg', quality: 0.9 })
  })

  it('bilinmeyen alanları ve aynı rolün tekrarını çıkarır', () => {
    const result = parseVisualRecipe({
      ...createValidRecipe(),
      layers: [
        { ...createDefaultTextLayer(), value: 'ilk', onClick: 'alert(1)' },
        { ...createDefaultTextLayer(), value: 'ikinci' },
      ],
      layerCount: 2,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.recipe.layers).toHaveLength(1)
    expect(result.recipe.layers[0]).toMatchObject({ value: 'ilk' })
    expect(result.recipe.layers[0]).not.toHaveProperty('onClick')
    expect(result.recipe).not.toHaveProperty('layerCount')
  })

  it('metin içeriğindeki kontrol karakterlerini temizler ve uzunluğu sınırlar', () => {
    const result = parseVisualRecipe({
      ...createValidRecipe(),
      layers: [
        {
          ...createDefaultTextLayer(),
          value: `A${String.fromCharCode(1)}B${String.fromCharCode(31)}C${'x'.repeat(400)}`,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const layer = result.recipe.layers[0] as { value: string }
    expect(layer.value.startsWith('A B C')).toBe(true)
    expect(layer.value).toHaveLength(200)
  })
})

describe('parseTemplateVariables', () => {
  it('metin olmayan veya eksik değerleri boş dizeye indirger', () => {
    expect(parseTemplateVariables({ firma_adi: '  ABC Otomotiv ', telefon: 5550000 })).toEqual({
      firma_adi: 'ABC Otomotiv',
      telefon: '',
    })
    expect(parseTemplateVariables(null)).toEqual({ firma_adi: '', telefon: '' })
  })
})

describe('createDuplicateName', () => {
  it('ilk kopyaya sade bir sonek verir', () => {
    expect(createDuplicateName('Galeri', ['Galeri'])).toBe('Galeri (kopya)')
  })

  it('ad çakıştıkça numara artırır', () => {
    expect(createDuplicateName('Galeri', ['Galeri', 'Galeri (kopya)'])).toBe('Galeri (kopya 2)')
    expect(
      createDuplicateName('Galeri', ['Galeri', 'galeri (KOPYA)', 'Galeri (kopya 2)']),
    ).toBe('Galeri (kopya 3)')
  })

  it('kopyanın kopyasında sonek zinciri oluşturmaz', () => {
    expect(createDuplicateName('Galeri (kopya)', ['Galeri', 'Galeri (kopya)'])).toBe(
      'Galeri (kopya 2)',
    )
    expect(createDuplicateName('Galeri (kopya 2)', ['Galeri (kopya 2)'])).toBe('Galeri (kopya)')
  })

  it('uzun adı sonekle birlikte sınırın içinde tutar', () => {
    const name = createDuplicateName('A'.repeat(200), [])

    expect(name.length).toBeLessThanOrEqual(120)
    expect(name.endsWith(' (kopya)')).toBe(true)
  })
})

describe('parseTemplateName', () => {
  it('boş ve metin olmayan adları reddeder', () => {
    expect(parseTemplateName('  Vitrin  ')).toBe('Vitrin')
    expect(parseTemplateName('   ')).toBeNull()
    expect(parseTemplateName(undefined)).toBeNull()
  })
})
