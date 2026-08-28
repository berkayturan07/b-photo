import { describe, expect, it } from 'vitest'

import {
  constrainPreviewPan,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  zoomPreviewAroundPoint,
} from '@/core/rendering/previewCamera'

describe('preview camera', () => {
  it('keeps fit and zoomed-out views centered', () => {
    expect(constrainPreviewPan({ zoom: 1, panX: 80, panY: -50 }, 600, 400)).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    expect(constrainPreviewPan({ zoom: 0.5, panX: 80, panY: -50 }, 600, 400)).toEqual({
      zoom: 0.5,
      panX: 0,
      panY: 0,
    })
  })

  it('constrains zoom and panning to the navigable photo area', () => {
    expect(constrainPreviewPan({ zoom: 10, panX: 5_000, panY: -5_000 }, 600, 400)).toEqual({
      zoom: MAX_PREVIEW_ZOOM,
      panX: 900,
      panY: -600,
    })
    expect(constrainPreviewPan({ zoom: 0.01, panX: 10, panY: 10 }, 600, 400)).toEqual({
      zoom: MIN_PREVIEW_ZOOM,
      panX: 0,
      panY: 0,
    })
  })

  it('zooms around the requested viewport point', () => {
    const result = zoomPreviewAroundPoint(
      { zoom: 1, panX: 0, panY: 0 },
      2,
      { x: 500, y: 250 },
      { x: 400, y: 300 },
      700,
      500,
    )

    expect(result).toEqual({ zoom: 2, panX: -100, panY: 50 })
  })
})
