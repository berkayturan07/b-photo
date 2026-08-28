export type OutputFormat = 'jpeg' | 'png'

export type LogoAlignment =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface TemplateCanvas {
  mode: 'original'
}

export interface LogoLayer {
  id: string
  type: 'image'
  role: 'logo'
  xPercent: number
  yPercent: number
  widthPercent: number
  opacity: number
  rotation: number
}

export interface TextLayer {
  id: string
  type: 'text'
  role: 'text'
  value: string
  xPercent: number
  yPercent: number
  fontSizePercent: number
  fontFamily: 'Inter Variable'
  fontWeight: 400 | 600 | 700
  color: string
  opacity: number
  backgroundEnabled: boolean
  backgroundColor: string
  paddingPercent: number
}

export interface WatermarkLayer {
  id: string
  type: 'watermark'
  role: 'watermark'
  mode: 'single' | 'repeated'
  value: string
  xPercent: number
  yPercent: number
  fontSizePercent: number
  fontFamily: 'Inter Variable'
  fontWeight: 400 | 600 | 700
  color: string
  opacity: number
  rotation: number
  gapXPercent: number
  gapYPercent: number
}

export type TemplateLayer = LogoLayer | TextLayer | WatermarkLayer

export interface TemplateVariables {
  firma_adi: string
  telefon: string
}

export interface TemplateOutput {
  format: OutputFormat
  quality: number
}

export interface VisualRecipe {
  schemaVersion: 1
  canvas: TemplateCanvas
  layers: TemplateLayer[]
  output: TemplateOutput
}
