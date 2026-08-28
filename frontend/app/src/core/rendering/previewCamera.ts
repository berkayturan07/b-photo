import { clamp } from '@/core/rendering/geometry'

export const MIN_PREVIEW_ZOOM = 0.25
export const MAX_PREVIEW_ZOOM = 4

export interface PreviewPoint {
  x: number
  y: number
}

export interface PreviewCamera {
  zoom: number
  panX: number
  panY: number
}

export function constrainPreviewPan(
  camera: PreviewCamera,
  fittedWidth: number,
  fittedHeight: number,
): PreviewCamera {
  const zoom = clamp(camera.zoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM)

  if (zoom <= 1) {
    return { zoom, panX: 0, panY: 0 }
  }

  const maximumPanX = (fittedWidth * (zoom - 1)) / 2
  const maximumPanY = (fittedHeight * (zoom - 1)) / 2

  return {
    zoom,
    panX: clamp(camera.panX, -maximumPanX, maximumPanX),
    panY: clamp(camera.panY, -maximumPanY, maximumPanY),
  }
}

export function zoomPreviewAroundPoint(
  camera: PreviewCamera,
  nextZoom: number,
  focus: PreviewPoint,
  viewportCenter: PreviewPoint,
  fittedWidth: number,
  fittedHeight: number,
): PreviewCamera {
  const zoom = clamp(nextZoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM)
  const ratio = zoom / camera.zoom
  const panX =
    focus.x -
    viewportCenter.x -
    ratio * (focus.x - viewportCenter.x - camera.panX)
  const panY =
    focus.y -
    viewportCenter.y -
    ratio * (focus.y - viewportCenter.y - camera.panY)

  return constrainPreviewPan({ zoom, panX, panY }, fittedWidth, fittedHeight)
}
