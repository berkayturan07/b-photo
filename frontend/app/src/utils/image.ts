import { createDefaultPhotoAdjustments } from '@/core/rendering/photoAdjustments'
import type { StudioLogoAsset } from '@/types/logo'
import type { PhotoOrientation, StudioPhoto } from '@/types/photo'

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i
const SUPPORTED_LOGO_TYPES = new Set([...SUPPORTED_IMAGE_TYPES, 'image/svg+xml'])
const SUPPORTED_LOGO_EXTENSIONS = /\.(jpe?g|png|webp|svg)$/i

export function classifyOrientation(width: number, height: number): PhotoOrientation {
  if (width === height) {
    return 'square'
  }

  return width > height ? 'landscape' : 'portrait'
}

export function orientationLabel(orientation: PhotoOrientation): string {
  const labels: Record<PhotoOrientation, string> = {
    landscape: 'Yatay',
    portrait: 'Dikey',
    square: 'Kare',
  }

  return labels[orientation]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function isSupportedImage(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type) || SUPPORTED_IMAGE_EXTENSIONS.test(file.name)
}

export function isSupportedLogo(file: File): boolean {
  return SUPPORTED_LOGO_TYPES.has(file.type) || SUPPORTED_LOGO_EXTENSIONS.test(file.name)
}

export async function createStudioPhoto(file: File): Promise<StudioPhoto> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const dimensions = await readImageDimensions(objectUrl)
    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      objectUrl,
      width: dimensions.width,
      height: dimensions.height,
      orientation: classifyOrientation(dimensions.width, dimensions.height),
      adjustments: createDefaultPhotoAdjustments(),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function createStudioLogoAsset(file: File): Promise<StudioLogoAsset> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const dimensions = await readImageDimensions(objectUrl)
    return {
      file,
      objectUrl,
      width: dimensions.width,
      height: dimensions.height,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      // Ölçü okumak için çözülen tam boyutlu görsel hemen bırakılır; yüzlerce
      // fotoğraf içe aktarılırken bunlar birikirse bellek hızla dolar.
      image.src = ''
      resolve(dimensions)
    }
    image.onerror = () => reject(new Error('Görsel tarayıcı tarafından okunamadı.'))
    image.src = objectUrl
  })
}
