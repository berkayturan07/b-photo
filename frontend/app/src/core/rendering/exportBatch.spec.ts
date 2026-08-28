import { describe, expect, it } from 'vitest'

import { buildBatchArchiveFilename, makeUniqueFilename } from './exportBatch'

describe('batch export filenames', () => {
  it('uses a stable local archive name', () => {
    expect(buildBatchArchiveFilename(new Date('2026-07-29T12:00:00Z'))).toBe(
      'b-photo-toplu-2026-07-29.zip',
    )
  })

  it('keeps duplicate output names unique inside the archive', () => {
    const used = new Set<string>()

    expect(makeUniqueFilename('arac-b-photo.jpg', used)).toBe(
      'arac-b-photo.jpg',
    )
    expect(makeUniqueFilename('arac-b-photo.jpg', used)).toBe(
      'arac-b-photo-2.jpg',
    )
    expect(makeUniqueFilename('arac-b-photo.jpg', used)).toBe(
      'arac-b-photo-3.jpg',
    )
  })
})
