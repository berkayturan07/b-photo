import { describe, expect, it } from 'vitest'

import { resolveTemplateText } from './interpolate'

const variables = {
  firma_adi: 'ABC Otomotiv',
  telefon: '0555 000 00 00',
}

describe('dynamic template fields', () => {
  it('resolves known fields', () => {
    expect(resolveTemplateText('{{firma_adi}} · {{telefon}}', variables)).toBe(
      'ABC Otomotiv · 0555 000 00 00',
    )
  })

  it('preserves unknown fields so configuration errors stay visible', () => {
    expect(resolveTemplateText('{{ilan_no}}', variables)).toBe('{{ilan_no}}')
  })
})

