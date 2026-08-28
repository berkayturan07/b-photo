import type { PhotoAdjustments } from '@/types/photo'

export const MIN_PHOTO_ADJUSTMENT = -100
export const MAX_PHOTO_ADJUSTMENT = 100

export function createDefaultPhotoAdjustments(): PhotoAdjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
  }
}

export function normalizePhotoAdjustments(
  adjustments: Partial<PhotoAdjustments>,
): PhotoAdjustments {
  const defaults = createDefaultPhotoAdjustments()

  return {
    brightness: normalizeValue(adjustments.brightness, defaults.brightness),
    contrast: normalizeValue(adjustments.contrast, defaults.contrast),
    saturation: normalizeValue(adjustments.saturation, defaults.saturation),
    warmth: normalizeValue(adjustments.warmth, defaults.warmth),
  }
}

export function hasPhotoAdjustments(adjustments: PhotoAdjustments): boolean {
  const normalized = normalizePhotoAdjustments(adjustments)
  return Object.values(normalized).some((value) => value !== 0)
}

export function buildPhotoFilter(adjustments: PhotoAdjustments): string {
  const normalized = normalizePhotoAdjustments(adjustments)

  return [
    `brightness(${100 + normalized.brightness}%)`,
    `contrast(${100 + normalized.contrast}%)`,
    `saturate(${100 + normalized.saturation}%)`,
  ].join(' ')
}

export function drawPhotoWithAdjustments(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  adjustments: PhotoAdjustments,
): void {
  const normalized = normalizePhotoAdjustments(adjustments)

  context.save()
  context.filter = buildPhotoFilter(normalized)
  context.drawImage(image, x, y, width, height)
  context.filter = 'none'

  if (normalized.warmth !== 0) {
    context.globalCompositeOperation = 'source-atop'
    context.globalAlpha = (Math.abs(normalized.warmth) / 100) * 0.2
    context.fillStyle = normalized.warmth > 0 ? '#f2a13b' : '#4c8fe8'
    context.fillRect(x, y, width, height)
  }

  context.restore()
}

function normalizeValue(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.round(
    Math.min(Math.max(value, MIN_PHOTO_ADJUSTMENT), MAX_PHOTO_ADJUSTMENT),
  )
}
