export type PhotoOrientation = 'landscape' | 'portrait' | 'square'

export interface PhotoAdjustments {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
}

export interface StudioPhoto {
  id: string
  file: File
  objectUrl: string
  width: number
  height: number
  orientation: PhotoOrientation
  adjustments: PhotoAdjustments
}
