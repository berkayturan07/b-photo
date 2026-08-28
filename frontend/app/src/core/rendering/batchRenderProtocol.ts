import type { PhotoAdjustments } from '@/types/photo'
import type { TemplateVariables, VisualRecipe } from '@/types/template'

/** Worker'a fotoğrafın kendisi değil, yalnız dosyası ve ölçüleri taşınır. */
export interface WorkerPhotoInput {
  file: File
  width: number
  height: number
  adjustments: PhotoAdjustments
}

export interface WorkerLogoInput {
  bitmap: ImageBitmap
  width: number
  height: number
}

export type BatchRenderRequest =
  | {
      type: 'configure'
      recipe: VisualRecipe
      variables: TemplateVariables
      logo: WorkerLogoInput | null
    }
  | { type: 'render'; index: number; photo: WorkerPhotoInput }
  | { type: 'dispose' }

export type BatchRenderResponse =
  | { type: 'ready' }
  | { type: 'rendered'; index: number; blob: Blob }
  | { type: 'failed'; index: number | null; message: string }
