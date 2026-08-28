import { assertRenderableSize, drawScene } from '@/core/rendering/renderScene'
import type { StudioLogoAsset } from '@/types/logo'
import type { StudioPhoto } from '@/types/photo'
import type { OutputFormat, TemplateVariables, VisualRecipe } from '@/types/template'

export interface RenderPhotoOptions {
  photo: StudioPhoto
  logoAsset: StudioLogoAsset | null
  recipe: VisualRecipe
  variables: TemplateVariables
}

export async function renderPhoto(options: RenderPhotoOptions): Promise<Blob> {
  assertRenderableSize(options.photo.width, options.photo.height)

  const photoImage = await loadImage(options.photo.objectUrl)
  const logoImage = options.logoAsset ? await loadImage(options.logoAsset.objectUrl) : null
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = options.photo.width
  canvas.height = options.photo.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Tarayıcı Canvas 2D işlemini başlatamadı.')
  }

  try {
    drawScene({
      context,
      photo: options.photo,
      photoImage,
      logoImage,
      logoSize: options.logoAsset,
      recipe: options.recipe,
      variables: options.variables,
    })

    return await canvasToBlob(canvas, options.recipe.output.format, options.recipe.output.quality)
  } finally {
    releaseImage(photoImage)
    releaseImage(logoImage)
    releaseCanvas(canvas)
  }
}

export function buildOutputFilename(filename: string, format: OutputFormat): string {
  const basename = filename.replace(/\.[^/.]+$/, '') || 'ilan-gorseli'
  const extension = format === 'jpeg' ? 'jpg' : 'png'
  return `${basename}-b-photo.${extension}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

/**
 * Tam çözünürlüklü tuval, fotoğraf başına yüz megabaytı bulabilir. Tarayıcı
 * çöp toplayıcısını beklemeden geri kazanabilmesi için tuval işi biter bitmez
 * en küçük boyuta indirilir.
 */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1
  canvas.height = 1
}

function releaseImage(image: HTMLImageElement | null): void {
  if (image) {
    image.src = ''
  }
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel render için yüklenemedi.'))
    image.src = objectUrl
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Tarayıcı çıktı dosyasını oluşturamadı.'))
      },
      mimeType,
      quality,
    )
  })
}
