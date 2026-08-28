import type { LogoAlignment, LogoLayer, TextLayer } from '@/types/template'

export interface Dimensions {
  width: number
  height: number
}

export interface RenderRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextBoxLayout extends RenderRect {
  fontSize: number
  padding: number
  textWidth: number
  textHeight: number
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function fitFontSizeToWidth(
  desiredFontSize: number,
  measuredWidth: number,
  maximumWidth: number,
): number {
  if (measuredWidth <= 0 || measuredWidth <= maximumWidth) {
    return desiredFontSize
  }

  return desiredFontSize * (maximumWidth / measuredWidth)
}

export function calculateTextBoxLayout(
  layer: TextLayer,
  photo: Dimensions,
  measuredWidthAtDesiredSize: number,
): TextBoxLayout {
  const desiredFontSize = photo.width * (layer.fontSizePercent / 100)
  const fontSize = fitFontSizeToWidth(
    desiredFontSize,
    measuredWidthAtDesiredSize,
    photo.width * 0.92,
  )
  const scale = desiredFontSize > 0 ? fontSize / desiredFontSize : 1
  const textWidth = measuredWidthAtDesiredSize * scale
  const textHeight = fontSize * 1.2
  const padding = photo.width * (layer.paddingPercent / 100)
  const width = textWidth + padding * 2
  const height = textHeight + padding * 2

  return {
    x: clamp(
      photo.width * (layer.xPercent / 100),
      0,
      Math.max(photo.width - width, 0),
    ),
    y: clamp(
      photo.height * (layer.yPercent / 100),
      0,
      Math.max(photo.height - height, 0),
    ),
    width,
    height,
    fontSize,
    padding,
    textWidth,
    textHeight,
  }
}

export function calculateAlignedPosition(
  alignment: LogoAlignment,
  widthPercent: number,
  heightPercent: number,
  marginPercent = 3,
): { xPercent: number; yPercent: number } {
  const [vertical, horizontal] = alignment.split('-')
  const xPositions = {
    left: marginPercent,
    center: (100 - widthPercent) / 2,
    right: 100 - widthPercent - marginPercent,
  }
  const yPositions = {
    top: marginPercent,
    middle: (100 - heightPercent) / 2,
    bottom: 100 - heightPercent - marginPercent,
  }

  return {
    xPercent: clamp(xPositions[horizontal as keyof typeof xPositions], 0, 100),
    yPercent: clamp(yPositions[vertical as keyof typeof yPositions], 0, 100),
  }
}

export function calculateLogoHeightPercent(
  layer: LogoLayer,
  photo: Dimensions,
  logo: Dimensions,
): number {
  if (photo.height <= 0 || logo.width <= 0) {
    return 0
  }

  const logoAspectRatio = logo.width / logo.height
  const photoAspectRatio = photo.width / photo.height
  return (layer.widthPercent * photoAspectRatio) / logoAspectRatio
}

export function calculateLogoRect(
  layer: LogoLayer,
  photo: Dimensions,
  logo: Dimensions,
): RenderRect {
  const width = photo.width * (layer.widthPercent / 100)
  const height = logo.width > 0 ? width * (logo.height / logo.width) : 0

  return {
    x: photo.width * (layer.xPercent / 100),
    y: photo.height * (layer.yPercent / 100),
    width,
    height,
  }
}

export function clampLogoLayer(
  layer: LogoLayer,
  photo: Dimensions,
  logo: Dimensions,
): LogoLayer {
  const widthPercent = clamp(layer.widthPercent, 5, 70)
  const normalizedLayer = {
    ...layer,
    widthPercent,
    opacity: clamp(layer.opacity, 0.05, 1),
  }
  const heightPercent = calculateLogoHeightPercent(normalizedLayer, photo, logo)

  return {
    ...normalizedLayer,
    xPercent: clamp(normalizedLayer.xPercent, 0, Math.max(100 - widthPercent, 0)),
    yPercent: clamp(normalizedLayer.yPercent, 0, Math.max(100 - heightPercent, 0)),
  }
}

export function alignLogoLayer(
  layer: LogoLayer,
  alignment: LogoAlignment,
  photo: Dimensions,
  logo: Dimensions,
  marginPercent = 3,
): LogoLayer {
  const normalizedLayer = clampLogoLayer(layer, photo, logo)
  const heightPercent = calculateLogoHeightPercent(normalizedLayer, photo, logo)
  const position = calculateAlignedPosition(
    alignment,
    normalizedLayer.widthPercent,
    heightPercent,
    marginPercent,
  )

  return clampLogoLayer(
    {
      ...normalizedLayer,
      ...position,
    },
    photo,
    logo,
  )
}
