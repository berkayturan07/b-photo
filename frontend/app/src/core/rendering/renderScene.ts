import {
  calculateLogoRect,
  calculateTextBoxLayout,
  clampLogoLayer,
  type Dimensions,
} from '@/core/rendering/geometry'
import { drawPhotoWithAdjustments } from '@/core/rendering/photoAdjustments'
import { resolveTemplateText } from '@/core/template/interpolate'
import type { PhotoAdjustments } from '@/types/photo'
import type {
  LogoLayer,
  TemplateVariables,
  TextLayer,
  VisualRecipe,
  WatermarkLayer,
} from '@/types/template'

/**
 * Sahne çizimi hem ana iş parçacığındaki `HTMLCanvasElement` hem de Web
 * Worker'daki `OffscreenCanvas` üzerinde aynı sonucu vermelidir. Bu yüzden
 * burada DOM'a bağlı hiçbir API kullanılmaz.
 */
export type RenderContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface ScenePhoto extends Dimensions {
  adjustments: PhotoAdjustments
}

export interface RenderSceneOptions {
  context: RenderContext2D
  photo: ScenePhoto
  photoImage: CanvasImageSource
  logoImage: CanvasImageSource | null
  /** Logo katmanının en-boy oranı; rasterleştirilmiş logonun gerçek boyutudur. */
  logoSize: Dimensions | null
  recipe: VisualRecipe
  variables: TemplateVariables
}

/**
 * Tarayıcıların Canvas 2D sınırları: tek kenar 65.535 piksel, toplam alan
 * 268.435.456 piksel. Sınır aşıldığında tuval sessizce boş kalır ve kullanıcı
 * bunu ancak indirdiği dosyada görür; bu yüzden render'dan önce durdurulur.
 */
export const MAX_CANVAS_SIDE = 65_535
export const MAX_CANVAS_PIXELS = 268_435_456

export function assertRenderableSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Fotoğrafın ölçüleri okunamadı.')
  }

  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE || width * height > MAX_CANVAS_PIXELS) {
    const megapixels = (width * height) / 1_000_000
    throw new Error(
      `Bu fotoğraf tarayıcının işleyebileceğinden büyük (${megapixels.toFixed(0)} MP). Daha küçük çözünürlüklü bir dosya kullanın.`,
    )
  }
}

export function drawScene(options: RenderSceneOptions): void {
  const { context, photo, recipe } = options

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  if (recipe.output.format === 'jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, photo.width, photo.height)
  }

  drawPhotoWithAdjustments(
    context,
    options.photoImage,
    0,
    0,
    photo.width,
    photo.height,
    photo.adjustments,
  )

  for (const layer of recipe.layers) {
    if (layer.type === 'image' && options.logoImage && options.logoSize) {
      drawLogo(context, layer, photo, options.logoSize, options.logoImage)
    } else if (layer.type === 'text') {
      drawText(context, layer, options.variables, photo)
    } else if (layer.type === 'watermark') {
      drawWatermark(context, layer, options.variables, photo)
    }
  }
}

function drawLogo(
  context: RenderContext2D,
  layer: LogoLayer,
  photo: Dimensions,
  logoSize: Dimensions,
  logoImage: CanvasImageSource,
): void {
  const rect = calculateLogoRect(clampLogoLayer(layer, photo, logoSize), photo, logoSize)

  context.save()
  context.globalAlpha = layer.opacity

  if (layer.rotation) {
    context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2)
    context.rotate(degreesToRadians(layer.rotation))
    context.drawImage(logoImage, -rect.width / 2, -rect.height / 2, rect.width, rect.height)
  } else {
    context.drawImage(logoImage, rect.x, rect.y, rect.width, rect.height)
  }

  context.restore()
}

function drawText(
  context: RenderContext2D,
  layer: TextLayer,
  variables: TemplateVariables,
  photo: Dimensions,
): void {
  const value = resolveTemplateText(layer.value, variables)
  if (!value.trim()) {
    return
  }

  context.save()
  context.globalAlpha = layer.opacity
  const desiredFontSize = photo.width * (layer.fontSizePercent / 100)
  context.font = buildFont(layer.fontWeight, desiredFontSize, layer.fontFamily)
  const layout = calculateTextBoxLayout(layer, photo, context.measureText(value).width)
  context.font = buildFont(layer.fontWeight, layout.fontSize, layer.fontFamily)
  context.textBaseline = 'middle'

  if (layer.backgroundEnabled) {
    context.fillStyle = layer.backgroundColor
    context.fillRect(layout.x, layout.y, layout.width, layout.height)
  }

  context.fillStyle = layer.color
  context.fillText(
    value,
    layout.x + layout.padding,
    layout.y + layout.padding + layout.textHeight / 2,
  )
  context.restore()
}

function drawWatermark(
  context: RenderContext2D,
  layer: WatermarkLayer,
  variables: TemplateVariables,
  photo: Dimensions,
): void {
  const value = resolveTemplateText(layer.value, variables)
  if (!value.trim()) {
    return
  }

  const fontSize = photo.width * (layer.fontSizePercent / 100)
  context.save()
  context.globalAlpha = layer.opacity
  context.fillStyle = layer.color
  context.font = buildFont(layer.fontWeight, fontSize, layer.fontFamily)
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  if (layer.mode === 'single') {
    drawRotatedText(
      context,
      value,
      photo.width * (layer.xPercent / 100),
      photo.height * (layer.yPercent / 100),
      layer.rotation,
    )
  } else {
    const gapX = Math.max(photo.width * (layer.gapXPercent / 100), fontSize * 2)
    const gapY = Math.max(photo.height * (layer.gapYPercent / 100), fontSize * 2)

    for (let y = -gapY; y <= photo.height + gapY; y += gapY) {
      for (let x = -gapX; x <= photo.width + gapX; x += gapX) {
        drawRotatedText(context, value, x, y, layer.rotation)
      }
    }
  }

  context.restore()
}

function drawRotatedText(
  context: RenderContext2D,
  value: string,
  x: number,
  y: number,
  rotation: number,
): void {
  context.save()
  context.translate(x, y)
  context.rotate(degreesToRadians(rotation))
  context.fillText(value, 0, 0)
  context.restore()
}

function buildFont(weight: number, size: number, family: string): string {
  return `${weight} ${size}px "${family}", sans-serif`
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
