import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'

import { alignLogoLayer, clampLogoLayer } from '@/core/rendering/geometry'
import {
  createDefaultPhotoAdjustments,
  hasPhotoAdjustments,
  normalizePhotoAdjustments,
} from '@/core/rendering/photoAdjustments'
import {
  createDefaultLogoLayer,
  createDefaultRecipe,
  createDefaultTextLayer,
  createDefaultWatermarkLayer,
} from '@/core/template/defaultRecipe'
import type { StudioLogoAsset } from '@/types/logo'
import type { PhotoAdjustments, StudioPhoto } from '@/types/photo'
import type {
  LogoAlignment,
  LogoLayer,
  OutputFormat,
  TemplateVariables,
  TextLayer,
  VisualRecipe,
  WatermarkLayer,
} from '@/types/template'
import {
  createStudioLogoAsset,
  createStudioPhoto,
  isSupportedImage,
  isSupportedLogo,
} from '@/utils/image'

export const useStudioStore = defineStore('studio', () => {
  const photos = ref<StudioPhoto[]>([])
  const selectedPhotoId = ref<string | null>(null)
  const importErrors = ref<string[]>([])
  const isImporting = ref(false)
  const logoAsset = ref<StudioLogoAsset | null>(null)
  const logoImportError = ref('')
  const recipe = ref(createDefaultRecipe())
  const templateVariables = ref<TemplateVariables>({
    firma_adi: 'ABC Otomotiv',
    telefon: '0555 000 00 00',
  })
  const isOriginalPreviewVisible = ref(false)

  const selectedPhoto = computed(
    () => photos.value.find((photo) => photo.id === selectedPhotoId.value) ?? null,
  )
  const selectedPhotoHasAdjustments = computed(() =>
    selectedPhoto.value ? hasPhotoAdjustments(selectedPhoto.value.adjustments) : false,
  )
  const hasAdjustedPhotos = computed(() =>
    photos.value.some((photo) => hasPhotoAdjustments(photo.adjustments)),
  )
  const logoLayer = computed<LogoLayer | null>(
    () =>
      recipe.value.layers.find(
        (layer): layer is LogoLayer => layer.type === 'image' && layer.role === 'logo',
      ) ?? null,
  )
  const textLayer = computed<TextLayer | null>(
    () =>
      recipe.value.layers.find(
        (layer): layer is TextLayer => layer.type === 'text' && layer.role === 'text',
      ) ?? null,
  )
  const watermarkLayer = computed<WatermarkLayer | null>(
    () =>
      recipe.value.layers.find(
        (layer): layer is WatermarkLayer =>
          layer.type === 'watermark' && layer.role === 'watermark',
      ) ?? null,
  )
  const hasRenderableLayers = computed(
    () =>
      Boolean(logoAsset.value && logoLayer.value) ||
      Boolean(textLayer.value) ||
      Boolean(watermarkLayer.value),
  )
  const canExportSelectedPhoto = computed(
    () =>
      Boolean(selectedPhoto.value) &&
      (hasRenderableLayers.value || selectedPhotoHasAdjustments.value),
  )
  const canExportBatch = computed(
    () => photos.value.length > 0 && (hasRenderableLayers.value || hasAdjustedPhotos.value),
  )

  async function addFiles(fileList: FileList | File[]): Promise<void> {
    isImporting.value = true
    importErrors.value = []

    const incomingFiles = Array.from(fileList)
    const knownIds = new Set(photos.value.map((photo) => photo.id))

    for (const file of incomingFiles) {
      if (!isSupportedImage(file)) {
        importErrors.value.push(`${file.name}: Desteklenmeyen dosya türü.`)
        continue
      }

      const id = `${file.name}-${file.size}-${file.lastModified}`
      if (knownIds.has(id)) {
        continue
      }

      try {
        const photo = await createStudioPhoto(file)
        photos.value.push(photo)
        knownIds.add(photo.id)
        selectedPhotoId.value ??= photo.id
        normalizeLogoForSelectedPhoto()
      } catch {
        importErrors.value.push(`${file.name}: Görsel okunamadı.`)
      }
    }

    isImporting.value = false
  }

  function selectPhoto(id: string): void {
    if (photos.value.some((photo) => photo.id === id)) {
      selectedPhotoId.value = id
      isOriginalPreviewVisible.value = false
      normalizeLogoForSelectedPhoto()
    }
  }

  function removePhoto(id: string): void {
    const index = photos.value.findIndex((photo) => photo.id === id)
    if (index === -1) {
      return
    }

    const photo = photos.value[index]
    if (photo) {
      URL.revokeObjectURL(photo.objectUrl)
    }
    photos.value.splice(index, 1)

    if (selectedPhotoId.value === id) {
      selectedPhotoId.value = photos.value[index]?.id ?? photos.value[index - 1]?.id ?? null
      normalizeLogoForSelectedPhoto()
    }
    isOriginalPreviewVisible.value = false
  }

  function clearPhotos(): void {
    photos.value.forEach((photo) => URL.revokeObjectURL(photo.objectUrl))
    photos.value = []
    selectedPhotoId.value = null
    importErrors.value = []
    isOriginalPreviewVisible.value = false
  }

  function updateSelectedPhotoAdjustments(patch: Partial<PhotoAdjustments>): void {
    const photo = selectedPhoto.value
    if (!photo) {
      return
    }

    photo.adjustments = normalizePhotoAdjustments({
      ...photo.adjustments,
      ...patch,
    })
    isOriginalPreviewVisible.value = false
  }

  function resetSelectedPhotoAdjustments(): void {
    const photo = selectedPhoto.value
    if (!photo) {
      return
    }

    photo.adjustments = createDefaultPhotoAdjustments()
    isOriginalPreviewVisible.value = false
  }

  function setOriginalPreviewVisible(visible: boolean): void {
    isOriginalPreviewVisible.value = visible && selectedPhotoHasAdjustments.value
  }

  function dismissImportErrors(): void {
    importErrors.value = []
  }

  async function setLogoFile(file: File): Promise<void> {
    logoImportError.value = ''

    if (!isSupportedLogo(file)) {
      logoImportError.value = 'Logo PNG, SVG, JPG veya WebP formatında olmalıdır.'
      return
    }

    try {
      const nextAsset = await createStudioLogoAsset(file)
      if (logoAsset.value) {
        URL.revokeObjectURL(logoAsset.value.objectUrl)
      }
      logoAsset.value = nextAsset

      if (!logoLayer.value) {
        recipe.value.layers.push(createDefaultLogoLayer())
      }
      normalizeLogoForSelectedPhoto()
    } catch {
      logoImportError.value = 'Logo dosyası tarayıcı tarafından okunamadı.'
    }
  }

  function removeLogo(): void {
    if (logoAsset.value) {
      URL.revokeObjectURL(logoAsset.value.objectUrl)
    }
    logoAsset.value = null
    logoImportError.value = ''
    recipe.value.layers = recipe.value.layers.filter((layer) => layer.role !== 'logo')
  }

  function updateLogoLayer(patch: Partial<LogoLayer>): void {
    const layer = logoLayer.value
    if (!layer) {
      return
    }

    const nextLayer = {
      ...layer,
      ...patch,
    }
    const photo = selectedPhoto.value
    const logo = logoAsset.value
    Object.assign(layer, photo && logo ? clampLogoLayer(nextLayer, photo, logo) : nextLayer)
  }

  function alignLogo(alignment: LogoAlignment): void {
    const layer = logoLayer.value
    const photo = selectedPhoto.value
    const logo = logoAsset.value
    if (!layer || !photo || !logo) {
      return
    }

    Object.assign(layer, alignLogoLayer(layer, alignment, photo, logo))
  }

  function setOutputFormat(format: OutputFormat): void {
    recipe.value.output.format = format
  }

  function setOutputQuality(quality: number): void {
    recipe.value.output.quality = Math.min(Math.max(quality, 0.5), 1)
  }

  function addTextLayer(): void {
    if (!textLayer.value) {
      recipe.value.layers.push(createDefaultTextLayer())
    }
  }

  function removeTextLayer(): void {
    recipe.value.layers = recipe.value.layers.filter((layer) => layer.role !== 'text')
  }

  function updateTextLayer(patch: Partial<TextLayer>): void {
    const layer = textLayer.value
    if (!layer) {
      return
    }

    Object.assign(layer, {
      ...layer,
      ...patch,
      xPercent: Math.min(Math.max(patch.xPercent ?? layer.xPercent, 0), 95),
      yPercent: Math.min(Math.max(patch.yPercent ?? layer.yPercent, 0), 95),
      fontSizePercent: Math.min(
        Math.max(patch.fontSizePercent ?? layer.fontSizePercent, 1),
        10,
      ),
      opacity: Math.min(Math.max(patch.opacity ?? layer.opacity, 0.05), 1),
      paddingPercent: Math.min(Math.max(patch.paddingPercent ?? layer.paddingPercent, 0), 3),
    })
  }

  function addWatermarkLayer(): void {
    if (!watermarkLayer.value) {
      recipe.value.layers.unshift(createDefaultWatermarkLayer())
    }
  }

  function removeWatermarkLayer(): void {
    recipe.value.layers = recipe.value.layers.filter((layer) => layer.role !== 'watermark')
  }

  function updateWatermarkLayer(patch: Partial<WatermarkLayer>): void {
    const layer = watermarkLayer.value
    if (!layer) {
      return
    }

    Object.assign(layer, {
      ...layer,
      ...patch,
      xPercent: Math.min(Math.max(patch.xPercent ?? layer.xPercent, 0), 100),
      yPercent: Math.min(Math.max(patch.yPercent ?? layer.yPercent, 0), 100),
      fontSizePercent: Math.min(
        Math.max(patch.fontSizePercent ?? layer.fontSizePercent, 1),
        10,
      ),
      opacity: Math.min(Math.max(patch.opacity ?? layer.opacity, 0.03), 0.8),
      rotation: Math.min(Math.max(patch.rotation ?? layer.rotation, -75), 75),
      gapXPercent: Math.min(Math.max(patch.gapXPercent ?? layer.gapXPercent, 10), 60),
      gapYPercent: Math.min(Math.max(patch.gapYPercent ?? layer.gapYPercent, 8), 50),
    })
  }

  function updateTemplateVariables(patch: Partial<TemplateVariables>): void {
    templateVariables.value = {
      ...templateVariables.value,
      ...patch,
    }
  }

  async function applyTemplate(
    nextRecipe: VisualRecipe,
    nextVariables: TemplateVariables,
    nextLogoFile: File | null,
  ): Promise<void> {
    if (logoAsset.value) {
      URL.revokeObjectURL(logoAsset.value.objectUrl)
    }

    logoAsset.value = null
    logoImportError.value = ''
    recipe.value = structuredClone(nextRecipe)
    recipe.value.layers = recipe.value.layers.map((layer) =>
      layer.type === 'watermark'
        ? {
            ...layer,
            xPercent: layer.xPercent ?? 50,
            yPercent: layer.yPercent ?? 50,
          }
        : layer,
    )
    templateVariables.value = structuredClone(nextVariables)

    if (nextLogoFile) {
      await setLogoFile(nextLogoFile)
    } else {
      recipe.value.layers = recipe.value.layers.filter((layer) => layer.role !== 'logo')
    }

    normalizeLogoForSelectedPhoto()
  }

  function normalizeLogoForSelectedPhoto(): void {
    const layer = logoLayer.value
    const photo = selectedPhoto.value
    const logo = logoAsset.value
    if (layer && photo && logo) {
      Object.assign(layer, clampLogoLayer(layer, photo, logo))
    }
  }

  function dispose(): void {
    clearPhotos()
    removeLogo()
  }

  return {
    photos,
    selectedPhotoId,
    selectedPhoto,
    selectedPhotoHasAdjustments,
    hasAdjustedPhotos,
    isOriginalPreviewVisible,
    importErrors,
    isImporting,
    logoAsset,
    logoImportError,
    logoLayer,
    textLayer,
    watermarkLayer,
    hasRenderableLayers,
    canExportSelectedPhoto,
    canExportBatch,
    recipe,
    templateVariables,
    addFiles,
    selectPhoto,
    removePhoto,
    clearPhotos,
    dismissImportErrors,
    updateSelectedPhotoAdjustments,
    resetSelectedPhotoAdjustments,
    setOriginalPreviewVisible,
    setLogoFile,
    removeLogo,
    updateLogoLayer,
    alignLogo,
    setOutputFormat,
    setOutputQuality,
    addTextLayer,
    removeTextLayer,
    updateTextLayer,
    addWatermarkLayer,
    removeWatermarkLayer,
    updateWatermarkLayer,
    updateTemplateVariables,
    applyTemplate,
    dispose,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useStudioStore, import.meta.hot))
}
