import { describe, expect, it } from 'vitest'

import { buildOutputFilename } from './exportPhoto'

describe('export filename', () => {
  it('adds the product suffix and requested extension', () => {
    expect(buildOutputFilename('arac-on.jpg', 'png')).toBe('arac-on-b-photo.png')
    expect(buildOutputFilename('arac.on.webp', 'jpeg')).toBe('arac.on-b-photo.jpg')
  })
})
