import type { LogoLayer, TextLayer, VisualRecipe, WatermarkLayer } from '@/types/template'

export function createDefaultRecipe(): VisualRecipe {
  return {
    schemaVersion: 1,
    canvas: {
      mode: 'original',
    },
    layers: [],
    output: {
      format: 'jpeg',
      quality: 0.9,
    },
  }
}

export function createDefaultLogoLayer(): LogoLayer {
  return {
    id: 'primary-logo',
    type: 'image',
    role: 'logo',
    xPercent: 77,
    yPercent: 3,
    widthPercent: 20,
    opacity: 1,
    rotation: 0,
  }
}

export function createDefaultTextLayer(): TextLayer {
  return {
    id: 'primary-text',
    type: 'text',
    role: 'text',
    value: '{{firma_adi}} · {{telefon}}',
    xPercent: 4,
    yPercent: 88,
    fontSizePercent: 3.2,
    fontFamily: 'Inter Variable',
    fontWeight: 700,
    color: '#ffffff',
    opacity: 1,
    backgroundEnabled: true,
    backgroundColor: '#102a43',
    paddingPercent: 0.8,
  }
}

export function createDefaultWatermarkLayer(): WatermarkLayer {
  return {
    id: 'primary-watermark',
    type: 'watermark',
    role: 'watermark',
    mode: 'repeated',
    value: '{{firma_adi}}',
    xPercent: 50,
    yPercent: 50,
    fontSizePercent: 2.6,
    fontFamily: 'Inter Variable',
    fontWeight: 600,
    color: '#ffffff',
    opacity: 0.14,
    rotation: -30,
    gapXPercent: 22,
    gapYPercent: 18,
  }
}
