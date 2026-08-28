<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import {
  calculateAlignedPosition,
  calculateTextBoxLayout,
} from '@/core/rendering/geometry'
import {
  buildBatchArchiveFilename,
  renderPhotosArchive,
  type BatchRenderProgress,
} from '@/core/rendering/exportBatch'
import {
  buildOutputFilename,
  downloadBlob,
  renderPhoto,
} from '@/core/rendering/exportPhoto'
import { resolveTemplateText } from '@/core/template/interpolate'
import {
  createSavedLogo,
  createTemplateId,
  deleteSavedTemplate,
  duplicateSavedTemplate,
  listSavedTemplates,
  putSavedTemplate,
  readSavedTemplate,
  restoreSavedLogo,
  type SavedTemplate,
  type SavedTemplateSummary,
} from '@/core/template/templateRepository'
import { useStudioStore } from '@/stores/studio'
import type {
  LogoAlignment,
  OutputFormat,
  TextLayer,
  WatermarkLayer,
} from '@/types/template'
import { formatBytes, orientationLabel } from '@/utils/image'

const studio = useStudioStore()
const settingsPanel = ref<HTMLElement | null>(null)
const logoInput = ref<HTMLInputElement | null>(null)
const isExporting = ref(false)
const isBatchExporting = ref(false)
const batchProgress = ref<BatchRenderProgress | null>(null)
const batchAbortController = ref<AbortController | null>(null)
const exportError = ref('')
const expandedLayer = ref<'logo' | 'text' | 'watermark' | null>(null)
const isPhotoDetailsExpanded = ref(false)
const isEnhancementsExpanded = ref(true)
const isTemplatesExpanded = ref(false)
const savedTemplates = ref<SavedTemplateSummary[]>([])
const selectedTemplateId = ref('')
const templateName = ref('')
const templateMessage = ref('')
const templateError = ref('')
const isTemplateBusy = ref(false)
const measurementCanvas = document.createElement('canvas')
const measurementContext = measurementCanvas.getContext('2d')

const alignments: Array<{ value: LogoAlignment; label: string }> = [
  { value: 'top-left', label: 'Sol Üst' },
  { value: 'top-center', label: 'Üst Orta' },
  { value: 'top-right', label: 'Sağ Üst' },
  { value: 'middle-left', label: 'Sol Orta' },
  { value: 'middle-center', label: 'Merkez' },
  { value: 'middle-right', label: 'Sağ Orta' },
  { value: 'bottom-left', label: 'Sol Alt' },
  { value: 'bottom-center', label: 'Alt Orta' },
  { value: 'bottom-right', label: 'Sağ Alt' },
]

const logoWidth = computed({
  get: () => studio.logoLayer?.widthPercent ?? 20,
  set: (value: number) => studio.updateLogoLayer({ widthPercent: Number(value) }),
})

const logoOpacity = computed({
  get: () => Math.round((studio.logoLayer?.opacity ?? 1) * 100),
  set: (value: number) => studio.updateLogoLayer({ opacity: Number(value) / 100 }),
})

const textValue = computed({
  get: () => studio.textLayer?.value ?? '',
  set: (value: string) => studio.updateTextLayer({ value }),
})

const textContentMode = computed({
  get: () => {
    if (textValue.value === '{{firma_adi}} · {{telefon}}') return 'company-phone'
    if (textValue.value === '{{firma_adi}}') return 'company'
    if (textValue.value === '{{telefon}}') return 'phone'
    return 'custom'
  },
  set: (mode: 'company-phone' | 'company' | 'phone' | 'custom') => {
    const values = {
      'company-phone': '{{firma_adi}} · {{telefon}}',
      company: '{{firma_adi}}',
      phone: '{{telefon}}',
    }
    studio.updateTextLayer({
      value: mode === 'custom' ? '' : values[mode],
    })
  },
})

const resolvedTextValue = computed(() =>
  resolveTemplateText(textValue.value, studio.templateVariables),
)

const textFontSize = computed({
  get: () => studio.textLayer?.fontSizePercent ?? 3.2,
  set: (value: number) => studio.updateTextLayer({ fontSizePercent: Number(value) }),
})

const textOpacity = computed({
  get: () => Math.round((studio.textLayer?.opacity ?? 1) * 100),
  set: (value: number) => studio.updateTextLayer({ opacity: Number(value) / 100 }),
})

const textColor = computed({
  get: () => studio.textLayer?.color ?? '#ffffff',
  set: (value: string) => studio.updateTextLayer({ color: value }),
})

const textFontWeight = computed({
  get: () => studio.textLayer?.fontWeight ?? 700,
  set: (value: TextLayer['fontWeight']) =>
    studio.updateTextLayer({ fontWeight: Number(value) as TextLayer['fontWeight'] }),
})

const textBackgroundEnabled = computed({
  get: () => studio.textLayer?.backgroundEnabled ?? true,
  set: (value: boolean) => studio.updateTextLayer({ backgroundEnabled: value }),
})

const textBackgroundColor = computed({
  get: () => studio.textLayer?.backgroundColor ?? '#102a43',
  set: (value: string) => studio.updateTextLayer({ backgroundColor: value }),
})

const watermarkValue = computed({
  get: () => studio.watermarkLayer?.value ?? '',
  set: (value: string) => studio.updateWatermarkLayer({ value }),
})

const watermarkContentMode = computed({
  get: () => (watermarkValue.value === '{{firma_adi}}' ? 'company' : 'custom'),
  set: (mode: 'company' | 'custom') => {
    studio.updateWatermarkLayer({
      value: mode === 'company' ? '{{firma_adi}}' : '',
    })
  },
})

const resolvedWatermarkValue = computed(() =>
  resolveTemplateText(watermarkValue.value, studio.templateVariables),
)

const watermarkMode = computed({
  get: () => studio.watermarkLayer?.mode ?? 'repeated',
  set: (value: WatermarkLayer['mode']) => studio.updateWatermarkLayer({ mode: value }),
})

const watermarkFontSize = computed({
  get: () => studio.watermarkLayer?.fontSizePercent ?? 2.6,
  set: (value: number) => studio.updateWatermarkLayer({ fontSizePercent: Number(value) }),
})

const watermarkOpacity = computed({
  get: () => Math.round((studio.watermarkLayer?.opacity ?? 0.14) * 100),
  set: (value: number) => studio.updateWatermarkLayer({ opacity: Number(value) / 100 }),
})

const watermarkRotation = computed({
  get: () => studio.watermarkLayer?.rotation ?? -30,
  set: (value: number) => studio.updateWatermarkLayer({ rotation: Number(value) }),
})

const watermarkColor = computed({
  get: () => studio.watermarkLayer?.color ?? '#ffffff',
  set: (value: string) => studio.updateWatermarkLayer({ color: value }),
})

const watermarkGapX = computed({
  get: () => studio.watermarkLayer?.gapXPercent ?? 22,
  set: (value: number) => studio.updateWatermarkLayer({ gapXPercent: Number(value) }),
})

const watermarkGapY = computed({
  get: () => studio.watermarkLayer?.gapYPercent ?? 18,
  set: (value: number) => studio.updateWatermarkLayer({ gapYPercent: Number(value) }),
})

const companyName = computed({
  get: () => studio.templateVariables.firma_adi,
  set: (value: string) => studio.updateTemplateVariables({ firma_adi: value }),
})

const phone = computed({
  get: () => studio.templateVariables.telefon,
  set: (value: string) => studio.updateTemplateVariables({ telefon: value }),
})

const outputFormat = computed({
  get: () => studio.recipe.output.format,
  set: (value: OutputFormat) => studio.setOutputFormat(value),
})

const outputQuality = computed({
  get: () => Math.round(studio.recipe.output.quality * 100),
  set: (value: number) => studio.setOutputQuality(Number(value) / 100),
})

const photoBrightness = computed({
  get: () => studio.selectedPhoto?.adjustments.brightness ?? 0,
  set: (value: number) =>
    studio.updateSelectedPhotoAdjustments({ brightness: Number(value) }),
})

const photoContrast = computed({
  get: () => studio.selectedPhoto?.adjustments.contrast ?? 0,
  set: (value: number) =>
    studio.updateSelectedPhotoAdjustments({ contrast: Number(value) }),
})

const photoSaturation = computed({
  get: () => studio.selectedPhoto?.adjustments.saturation ?? 0,
  set: (value: number) =>
    studio.updateSelectedPhotoAdjustments({ saturation: Number(value) }),
})

const photoWarmth = computed({
  get: () => studio.selectedPhoto?.adjustments.warmth ?? 0,
  set: (value: number) =>
    studio.updateSelectedPhotoAdjustments({ warmth: Number(value) }),
})

function formatAdjustment(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function toggleLayer(layer: 'logo' | 'text' | 'watermark'): void {
  const shouldOpen = expandedLayer.value !== layer
  expandedLayer.value = shouldOpen ? layer : null
  if (shouldOpen) {
    void revealLayerControls(layer)
  }
}

function addTextLayer(): void {
  studio.addTextLayer()
  expandedLayer.value = 'text'
  void revealLayerControls('text')
}

function removeTextLayer(): void {
  studio.removeTextLayer()
  if (expandedLayer.value === 'text') {
    expandedLayer.value = null
  }
}

function addWatermarkLayer(): void {
  studio.addWatermarkLayer()
  expandedLayer.value = 'watermark'
  void revealLayerControls('watermark')
}

function removeWatermarkLayer(): void {
  studio.removeWatermarkLayer()
  if (expandedLayer.value === 'watermark') {
    expandedLayer.value = null
  }
}

function removeLogoLayer(): void {
  studio.removeLogo()
  if (expandedLayer.value === 'logo') {
    expandedLayer.value = null
  }
}

function openLogoPicker(): void {
  logoInput.value?.click()
}

async function revealLayerControls(layer: 'logo' | 'text' | 'watermark'): Promise<void> {
  await nextTick()
  const panel = settingsPanel.value
  const target = document.getElementById(`${layer}-layer-section`)
  if (!panel || !target || window.matchMedia('(max-width: 1120px)').matches) {
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const stickyHeaderHeight =
    panel.querySelector<HTMLElement>(':scope > .panel__header')?.offsetHeight ?? 0
  const stickyBottomHeight =
    panel.querySelector<HTMLElement>(':scope > .settings-panel__bottom')?.offsetHeight ?? 0
  const visibleTop = panelRect.top + stickyHeaderHeight + 12
  const visibleBottom = panelRect.bottom - stickyBottomHeight - 12

  if (targetRect.top < visibleTop || targetRect.bottom > visibleBottom) {
    panel.scrollTo({
      top: panel.scrollTop + targetRect.top - visibleTop,
      behavior: 'smooth',
    })
  }
}

async function handleLogoInput(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await studio.setLogoFile(file)
    if (studio.logoAsset) {
      expandedLayer.value = 'logo'
      void revealLayerControls('logo')
    }
  }
  input.value = ''
}

function measureText(
  value: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
): number {
  if (!measurementContext) {
    return value.length * fontSize * 0.6
  }

  measurementContext.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`
  return measurementContext.measureText(value).width
}

function alignText(alignment: LogoAlignment): void {
  const layer = studio.textLayer
  const photo = studio.selectedPhoto
  const value = resolvedTextValue.value
  if (!layer || !photo || !value.trim()) {
    return
  }

  const desiredFontSize = photo.width * (layer.fontSizePercent / 100)
  const layout = calculateTextBoxLayout(
    layer,
    photo,
    measureText(value, desiredFontSize, layer.fontWeight, layer.fontFamily),
  )
  studio.updateTextLayer(
    calculateAlignedPosition(
      alignment,
      (layout.width / photo.width) * 100,
      (layout.height / photo.height) * 100,
    ),
  )
}

function alignWatermark(alignment: LogoAlignment): void {
  const layer = studio.watermarkLayer
  const photo = studio.selectedPhoto
  const value = resolvedWatermarkValue.value
  if (!layer || !photo || !value.trim()) {
    return
  }

  const fontSize = photo.width * (layer.fontSizePercent / 100)
  const textWidth = measureText(value, fontSize, layer.fontWeight, layer.fontFamily)
  const radians = (layer.rotation * Math.PI) / 180
  const width =
    Math.abs(textWidth * Math.cos(radians)) + Math.abs(fontSize * Math.sin(radians))
  const height =
    Math.abs(textWidth * Math.sin(radians)) + Math.abs(fontSize * Math.cos(radians))
  const widthPercent = (width / photo.width) * 100
  const heightPercent = (height / photo.height) * 100
  const position = calculateAlignedPosition(alignment, widthPercent, heightPercent)

  studio.updateWatermarkLayer({
    xPercent: position.xPercent + widthPercent / 2,
    yPercent: position.yPercent + heightPercent / 2,
  })
}

async function refreshSavedTemplates(): Promise<void> {
  savedTemplates.value = await listSavedTemplates()
}

async function saveCurrentTemplate(): Promise<void> {
  const name = templateName.value.trim()
  if (!name || !studio.hasRenderableLayers) {
    templateError.value = name
      ? 'Şablonu kaydetmek için en az bir katman ekleyin.'
      : 'Şablon için anlaşılır bir ad girin.'
    return
  }

  isTemplateBusy.value = true
  templateError.value = ''
  templateMessage.value = ''

  try {
    const existing = savedTemplates.value.find(
      (template) => template.id === selectedTemplateId.value,
    )
    const now = new Date().toISOString()
    const template: SavedTemplate = {
      id: existing?.id ?? createTemplateId(),
      name,
      recipe: JSON.parse(JSON.stringify(studio.recipe)),
      variables: JSON.parse(JSON.stringify(studio.templateVariables)),
      logo: studio.logoAsset ? createSavedLogo(studio.logoAsset.file) : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await putSavedTemplate(template)
    selectedTemplateId.value = template.id
    templateMessage.value = existing ? 'Şablon güncellendi.' : 'Şablon kaydedildi.'
    await refreshSavedTemplates()
  } catch {
    templateError.value = 'Şablon tarayıcıya kaydedilemedi.'
  } finally {
    isTemplateBusy.value = false
  }
}

async function loadSelectedTemplate(): Promise<void> {
  if (!selectedTemplateId.value) {
    templateName.value = ''
    templateMessage.value = ''
    return
  }

  isTemplateBusy.value = true
  templateError.value = ''
  templateMessage.value = ''

  try {
    const result = await readSavedTemplate(selectedTemplateId.value)
    if (result.status === 'error') {
      templateError.value = result.message
      return
    }

    await applyLoadedTemplate(result.template, result.repairs, 'Şablon çalışma alanına uygulandı.')
  } catch {
    templateError.value = 'Şablon açılamadı.'
  } finally {
    isTemplateBusy.value = false
  }
}

async function applyLoadedTemplate(
  template: SavedTemplate,
  repairs: string[],
  successMessage: string,
): Promise<void> {
  const logoFile = template.logo ? restoreSavedLogo(template.logo) : null
  await studio.applyTemplate(template.recipe, template.variables, logoFile)
  templateName.value = template.name
  expandedLayer.value = null
  templateMessage.value = repairs.length
    ? `${successMessage.replace(/\.$/, '')}; ${repairs.length} ayar güvenli değere düzeltildi.`
    : successMessage
}

async function duplicateSelectedTemplate(): Promise<void> {
  if (!selectedTemplateId.value) {
    return
  }

  isTemplateBusy.value = true
  templateError.value = ''
  templateMessage.value = ''

  try {
    const result = await duplicateSavedTemplate(selectedTemplateId.value)
    if (result.status === 'error') {
      templateError.value = result.message
      return
    }

    await refreshSavedTemplates()
    selectedTemplateId.value = result.template.id
    await applyLoadedTemplate(result.template, result.repairs, 'Şablon kopyası oluşturuldu.')
  } catch {
    templateError.value = 'Şablon çoğaltılamadı.'
  } finally {
    isTemplateBusy.value = false
  }
}

async function removeSelectedTemplate(): Promise<void> {
  const template = savedTemplates.value.find(
    (item) => item.id === selectedTemplateId.value,
  )
  if (!template || !window.confirm(`“${template.name}” şablonu silinsin mi?`)) {
    return
  }

  await deleteSavedTemplate(template.id)
  selectedTemplateId.value = ''
  templateName.value = ''
  templateMessage.value = 'Şablon silindi.'
  await refreshSavedTemplates()
}

async function exportSelectedPhoto(): Promise<void> {
  const photo = studio.selectedPhoto
  if (!photo || !studio.canExportSelectedPhoto) {
    return
  }

  isExporting.value = true
  exportError.value = ''

  try {
    const blob = await renderPhoto({
      photo,
      logoAsset: studio.logoAsset,
      recipe: studio.recipe,
      variables: studio.templateVariables,
    })
    downloadBlob(blob, buildOutputFilename(photo.file.name, studio.recipe.output.format))
  } catch {
    exportError.value = 'Görsel oluşturulamadı. Lütfen dosyaları yeniden seçip deneyin.'
  } finally {
    isExporting.value = false
  }
}

async function exportAllPhotos(): Promise<void> {
  if (!studio.photos.length || !studio.canExportBatch) {
    return
  }

  isBatchExporting.value = true
  batchProgress.value = {
    completed: 0,
    total: studio.photos.length,
    filename: '',
  }
  exportError.value = ''
  const controller = new AbortController()
  batchAbortController.value = controller

  try {
    const archive = await renderPhotosArchive({
      photos: [...studio.photos],
      logoAsset: studio.logoAsset,
      recipe: JSON.parse(JSON.stringify(studio.recipe)),
      variables: JSON.parse(JSON.stringify(studio.templateVariables)),
      signal: controller.signal,
      onProgress: (progress) => {
        batchProgress.value = progress
      },
    })
    downloadBlob(archive, buildBatchArchiveFilename())
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      exportError.value = 'Toplu ZIP oluşturulamadı. Lütfen dosyaları kontrol edip yeniden deneyin.'
    }
  } finally {
    isBatchExporting.value = false
    batchAbortController.value = null
  }
}

function cancelBatchExport(): void {
  batchAbortController.value?.abort()
}

onMounted(async () => {
  try {
    await refreshSavedTemplates()
  } catch {
    templateError.value = 'Kayıtlı şablonlar okunamadı.'
  }
})
</script>

<template>
  <aside ref="settingsPanel" class="panel settings-panel" aria-label="Katmanlar ve ayarlar">
    <div class="panel__header">
      <h2 class="eyebrow">Katmanlar ve Ayarlar</h2>
      <AppIcon name="layers" />
    </div>

    <section v-if="studio.selectedPhoto" class="settings-section overview-section">
      <button
        class="section-heading section-disclosure"
        type="button"
        :aria-expanded="isPhotoDetailsExpanded"
        aria-controls="selected-photo-details"
        :aria-label="
          isPhotoDetailsExpanded
            ? 'Seçili fotoğraf ayrıntılarını daralt'
            : 'Seçili fotoğraf ayrıntılarını göster'
        "
        @click="isPhotoDetailsExpanded = !isPhotoDetailsExpanded"
      >
        <h3>Seçili Fotoğraf</h3>
        <span class="section-disclosure__meta">
          <span class="section-disclosure__status">Hazır</span>
          <span
            class="layer-disclosure__chevron"
            :class="{
              'layer-disclosure__chevron--open': isPhotoDetailsExpanded,
            }"
            aria-hidden="true"
          ></span>
        </span>
      </button>
      <dl v-if="isPhotoDetailsExpanded" id="selected-photo-details" class="metadata-list">
        <div>
          <dt>Dosya</dt>
          <dd :title="studio.selectedPhoto.file.name">{{ studio.selectedPhoto.file.name }}</dd>
        </div>
        <div>
          <dt>Boyut</dt>
          <dd>{{ studio.selectedPhoto.width }} × {{ studio.selectedPhoto.height }}</dd>
        </div>
        <div>
          <dt>Yön</dt>
          <dd>{{ orientationLabel(studio.selectedPhoto.orientation) }}</dd>
        </div>
        <div>
          <dt>Dosya Boyutu</dt>
          <dd>{{ formatBytes(studio.selectedPhoto.file.size) }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="studio.selectedPhoto" class="settings-section photo-enhancement-section">
      <button
        class="section-heading section-disclosure"
        type="button"
        :aria-expanded="isEnhancementsExpanded"
        aria-controls="photo-enhancement-controls"
        :aria-label="
          isEnhancementsExpanded
            ? 'Fotoğraf iyileştirme ayarlarını daralt'
            : 'Fotoğraf iyileştirme ayarlarını göster'
        "
        @click="isEnhancementsExpanded = !isEnhancementsExpanded"
      >
        <h3>Fotoğrafı İyileştir</h3>
        <span class="section-disclosure__meta">
          <span
            class="section-disclosure__status"
            :class="{
              'section-disclosure__status--muted': !studio.selectedPhotoHasAdjustments,
            }"
          >
            {{ studio.selectedPhotoHasAdjustments ? 'Düzenlendi' : 'Doğal' }}
          </span>
          <span
            class="layer-disclosure__chevron"
            :class="{
              'layer-disclosure__chevron--open': isEnhancementsExpanded,
            }"
            aria-hidden="true"
          ></span>
        </span>
      </button>

      <div
        v-if="isEnhancementsExpanded"
        id="photo-enhancement-controls"
        class="photo-enhancement-controls"
      >
        <p class="photo-enhancement-note">
          Bu ayarlar yalnız <strong>{{ studio.selectedPhoto.file.name }}</strong> fotoğrafına
          uygulanır.
        </p>

        <label class="range-field">
          <span>
            <strong>Parlaklık</strong>
            <output>{{ formatAdjustment(photoBrightness) }}</output>
          </span>
          <input
            v-model.number="photoBrightness"
            type="range"
            aria-label="Parlaklık"
            min="-100"
            max="100"
            step="1"
          />
        </label>

        <label class="range-field">
          <span>
            <strong>Kontrast</strong>
            <output>{{ formatAdjustment(photoContrast) }}</output>
          </span>
          <input
            v-model.number="photoContrast"
            type="range"
            aria-label="Kontrast"
            min="-100"
            max="100"
            step="1"
          />
        </label>

        <label class="range-field">
          <span>
            <strong>Renk Canlılığı</strong>
            <output>{{ formatAdjustment(photoSaturation) }}</output>
          </span>
          <input
            v-model.number="photoSaturation"
            type="range"
            aria-label="Renk Canlılığı"
            min="-100"
            max="100"
            step="1"
          />
        </label>

        <label class="range-field">
          <span>
            <strong>Sıcaklık</strong>
            <output>{{ formatAdjustment(photoWarmth) }}</output>
          </span>
          <input
            v-model.number="photoWarmth"
            type="range"
            aria-label="Sıcaklık"
            min="-100"
            max="100"
            step="1"
          />
        </label>

        <div class="photo-enhancement-actions">
          <button
            class="button button--secondary"
            type="button"
            :disabled="!studio.selectedPhotoHasAdjustments"
            :aria-pressed="studio.isOriginalPreviewVisible"
            @click="studio.setOriginalPreviewVisible(!studio.isOriginalPreviewVisible)"
          >
            {{ studio.isOriginalPreviewVisible ? 'Düzenlenmişi Göster' : 'Orijinali Göster' }}
          </button>
          <button
            class="text-button text-button--danger"
            type="button"
            :disabled="!studio.selectedPhotoHasAdjustments"
            @click="studio.resetSelectedPhotoAdjustments"
          >
            Sıfırla
          </button>
        </div>
      </div>
    </section>

    <section class="settings-section template-section overview-section">
      <button
        class="section-heading section-disclosure"
        type="button"
        :aria-expanded="isTemplatesExpanded"
        aria-controls="saved-template-controls"
        :aria-label="
          isTemplatesExpanded
            ? 'Hazır şablonları daralt'
            : 'Hazır şablonları göster'
        "
        @click="isTemplatesExpanded = !isTemplatesExpanded"
      >
        <h3>Hazır Şablonlar</h3>
        <span class="section-disclosure__meta">
          <span class="section-disclosure__status section-disclosure__status--muted">
            {{ savedTemplates.length }} Kayıt
          </span>
          <span
            class="layer-disclosure__chevron"
            :class="{
              'layer-disclosure__chevron--open': isTemplatesExpanded,
            }"
            aria-hidden="true"
          ></span>
        </span>
      </button>

      <div v-if="isTemplatesExpanded" id="saved-template-controls" class="template-controls">
        <label class="stacked-field">
          <span>Kayıtlı Şablon</span>
          <select
            v-model="selectedTemplateId"
            :disabled="isTemplateBusy"
            @change="loadSelectedTemplate"
          >
            <option value="">Yeni şablon oluştur</option>
            <option v-for="template in savedTemplates" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
        </label>

        <label class="stacked-field">
          <span>Şablon Adı</span>
          <input
            v-model="templateName"
            type="text"
            maxlength="60"
            placeholder="Örn. Galeri standart şablonu"
          />
        </label>

        <div class="template-actions">
          <button
            class="button button--secondary"
            type="button"
            :disabled="isTemplateBusy || !studio.hasRenderableLayers"
            @click="saveCurrentTemplate"
          >
            {{ selectedTemplateId ? 'Şablonu Güncelle' : 'Şablonu Kaydet' }}
          </button>
          <button
            v-if="selectedTemplateId"
            class="text-button"
            type="button"
            :disabled="isTemplateBusy"
            title="Seçili şablonun bağımsız bir kopyasını oluşturur"
            @click="duplicateSelectedTemplate"
          >
            Çoğalt
          </button>
          <button
            v-if="selectedTemplateId"
            class="text-button text-button--danger"
            type="button"
            :disabled="isTemplateBusy"
            @click="removeSelectedTemplate"
          >
            Sil
          </button>
        </div>
        <p v-if="templateError" class="field-error" role="alert">{{ templateError }}</p>
        <p v-else-if="templateMessage" class="field-success" role="status">
          {{ templateMessage }}
        </p>
        <p v-else class="section-hint">
          Katmanlar, ilan bilgileri ve logo yalnız bu tarayıcıda saklanır.
        </p>
      </div>
    </section>

    <section
      id="logo-layer-section"
      class="settings-section layer-section"
      :class="{ 'layer-section--expanded': expandedLayer === 'logo' }"
    >
      <div class="section-heading">
        <h3>Logo Katmanı</h3>
        <span v-if="studio.logoAsset">Etkin</span>
        <span v-else class="status-muted">Eklenmedi</span>
      </div>

      <button
        v-if="!studio.logoAsset"
        class="logo-upload-button"
        type="button"
        :disabled="!studio.selectedPhoto"
        @click="openLogoPicker"
      >
        <span class="logo-upload-button__icon">
          <AppIcon name="upload" :size="21" />
        </span>
        <span>
          <strong>Logo Ekleyin</strong>
          <small>PNG, SVG, JPG veya WebP</small>
        </span>
      </button>

      <input
        id="logo-file-input"
        ref="logoInput"
        class="visually-hidden"
        type="file"
        accept=".png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp"
        @change="handleLogoInput"
      />

      <p v-if="studio.logoImportError" class="field-error" role="alert">
        {{ studio.logoImportError }}
      </p>

      <template v-if="studio.logoAsset && studio.logoLayer">
        <button
          class="layer-disclosure"
          type="button"
          :aria-expanded="expandedLayer === 'logo'"
          aria-controls="logo-layer-controls"
          @click="toggleLayer('logo')"
        >
          <span class="layer-disclosure__logo">
            <img :src="studio.logoAsset.objectUrl" alt="" />
          </span>
          <span class="layer-disclosure__copy">
            <strong>{{ studio.logoAsset.file.name }}</strong>
            <small>
              {{
                expandedLayer === 'logo'
                  ? 'Ayarları daralt'
                  : `${Math.round(logoWidth)}% boyut · ${logoOpacity}% şeffaflık`
              }}
            </small>
          </span>
          <span
            class="layer-disclosure__chevron"
            :class="{ 'layer-disclosure__chevron--open': expandedLayer === 'logo' }"
            aria-hidden="true"
          ></span>
        </button>

        <div
          v-if="expandedLayer === 'logo'"
          id="logo-layer-controls"
          class="layer-controls layer-controls--flush layer-controls--disclosed"
        >
          <div class="layer-title-row">
            <span>Logo ayarları</span>
            <button
              class="icon-button icon-button--danger"
              type="button"
              aria-label="Logo katmanını kaldır"
              @click="removeLogoLayer"
            >
              <AppIcon name="trash" :size="17" />
            </button>
          </div>

          <label class="range-field">
            <span>
              <strong>Boyut</strong>
              <output>{{ Math.round(logoWidth) }}%</output>
            </span>
            <input v-model.number="logoWidth" type="range" min="5" max="70" step="1" />
          </label>

          <label class="range-field">
            <span>
              <strong>Şeffaflık</strong>
              <output>{{ logoOpacity }}%</output>
            </span>
            <input v-model.number="logoOpacity" type="range" min="5" max="100" step="1" />
          </label>

          <fieldset class="alignment-field">
            <legend>Hazır Konum</legend>
            <div class="alignment-grid">
              <button
                v-for="alignment in alignments"
                :key="alignment.value"
                type="button"
                :aria-label="`Logoyu ${alignment.label} konumuna taşı`"
                :title="alignment.label"
                @click="studio.alignLogo(alignment.value)"
              >
                <span></span>
              </button>
            </div>
          </fieldset>

          <button class="text-button logo-change-button" type="button" @click="openLogoPicker">
            Logoyu Değiştir
          </button>
        </div>
      </template>
    </section>

    <section
      id="text-layer-section"
      class="settings-section layer-section"
      :class="{ 'layer-section--expanded': expandedLayer === 'text' }"
    >
      <div class="section-heading">
        <h3>Metin Katmanı</h3>
        <span v-if="studio.textLayer">Etkin</span>
        <span v-else class="status-muted">Eklenmedi</span>
      </div>

      <button
        v-if="!studio.textLayer"
        class="layer-add-button"
        type="button"
        :disabled="!studio.selectedPhoto"
        @click="addTextLayer"
      >
        <span class="layer-add-button__icon">T</span>
        <span>
          <strong>Metin Ekleyin</strong>
          <small>Firma adı, telefon veya özel metin</small>
        </span>
      </button>

      <template v-else>
        <button
          class="layer-disclosure"
          type="button"
          :aria-expanded="expandedLayer === 'text'"
          aria-controls="text-layer-controls"
          @click="toggleLayer('text')"
        >
          <span class="layer-add-button__icon">T</span>
          <span class="layer-disclosure__copy">
            <strong>{{ resolvedTextValue || 'Metin girilmedi' }}</strong>
            <small>
              {{
                expandedLayer === 'text'
                  ? 'Ayarları daralt'
                  : `${Number(textFontSize).toFixed(1)}% · ${textOpacity}% şeffaflık`
              }}
            </small>
          </span>
          <span
            class="layer-disclosure__chevron"
            :class="{ 'layer-disclosure__chevron--open': expandedLayer === 'text' }"
            aria-hidden="true"
          ></span>
        </button>

        <div
          v-if="expandedLayer === 'text'"
          id="text-layer-controls"
          class="layer-controls layer-controls--flush layer-controls--disclosed"
        >
          <div class="layer-title-row">
            <span>Metin ayarları</span>
            <button
              class="icon-button icon-button--danger"
              type="button"
              aria-label="Metin katmanını kaldır"
              @click="removeTextLayer"
            >
              <AppIcon name="trash" :size="17" />
            </button>
          </div>

          <label class="stacked-field">
            <span>Gösterilecek Bilgi</span>
            <select v-model="textContentMode">
              <option value="company-phone">Firma adı ve telefon</option>
              <option value="company">Yalnız firma adı</option>
              <option value="phone">Yalnız telefon</option>
              <option value="custom">Özel metin</option>
            </select>
          </label>

          <label v-if="textContentMode === 'custom'" class="stacked-field">
            <span>Özel Metin</span>
            <input v-model="textValue" type="text" placeholder="Görselde görünecek metni yazın" />
          </label>

          <div v-else class="layer-subsection">
            <div class="layer-subsection__heading">
              <strong>İlan Bilgileri</strong>
              <small>Bu değerler metin ve filigran katmanlarında ortak kullanılır.</small>
            </div>
            <div class="dynamic-fields">
              <label v-if="textContentMode !== 'phone'" class="stacked-field">
                <span>Firma Adı</span>
                <input v-model="companyName" type="text" />
              </label>
              <label v-if="textContentMode !== 'company'" class="stacked-field">
                <span>Telefon</span>
                <input v-model="phone" type="text" />
              </label>
            </div>
          </div>

          <div class="layer-group-label">Görünüm</div>

          <div class="inline-fields">
            <label class="color-field">
              <span>Metin Rengi</span>
              <input v-model="textColor" type="color" />
            </label>
            <label class="select-field select-field--stacked">
              <span>Yazı Kalınlığı</span>
              <select v-model.number="textFontWeight">
                <option :value="400">Normal</option>
                <option :value="600">Yarı Kalın</option>
                <option :value="700">Kalın</option>
              </select>
            </label>
          </div>

          <label class="range-field">
            <span>
              <strong>Yazı Boyutu</strong>
              <output>{{ Number(textFontSize).toFixed(1) }}%</output>
            </span>
            <input v-model.number="textFontSize" type="range" min="1" max="10" step="0.1" />
          </label>

          <label class="range-field">
            <span>
              <strong>Şeffaflık</strong>
              <output>{{ textOpacity }}%</output>
            </span>
            <input v-model.number="textOpacity" type="range" min="5" max="100" step="1" />
          </label>

          <div class="toggle-color-row">
            <label class="toggle-field">
              <input v-model="textBackgroundEnabled" type="checkbox" />
              <span>Arka Plan Kutusu</span>
            </label>
            <label v-if="textBackgroundEnabled" class="compact-color">
              <span class="visually-hidden">Metin arka plan rengi</span>
              <input v-model="textBackgroundColor" type="color" />
            </label>
          </div>

          <fieldset class="alignment-field">
            <legend>Hazır Konum</legend>
            <div class="alignment-grid">
              <button
                v-for="alignment in alignments"
                :key="alignment.value"
                type="button"
                :aria-label="`Metni ${alignment.label} konumuna taşı`"
                :title="alignment.label"
                @click="alignText(alignment.value)"
              >
                <span></span>
              </button>
            </div>
          </fieldset>

          <p class="control-hint">Metni önizleme üzerinde sürükleyerek konumlandırabilirsiniz.</p>
        </div>
      </template>
    </section>

    <section
      id="watermark-layer-section"
      class="settings-section layer-section"
      :class="{ 'layer-section--expanded': expandedLayer === 'watermark' }"
    >
      <div class="section-heading">
        <h3>Filigran Katmanı</h3>
        <span v-if="studio.watermarkLayer">Etkin</span>
        <span v-else class="status-muted">Eklenmedi</span>
      </div>

      <button
        v-if="!studio.watermarkLayer"
        class="layer-add-button"
        type="button"
        :disabled="!studio.selectedPhoto"
        @click="addWatermarkLayer"
      >
        <span class="layer-add-button__icon layer-add-button__icon--watermark">W</span>
        <span>
          <strong>Filigran Ekleyin</strong>
          <small>Tek veya tekrarlanan marka metni</small>
        </span>
      </button>

      <template v-else>
        <button
          class="layer-disclosure"
          type="button"
          :aria-expanded="expandedLayer === 'watermark'"
          aria-controls="watermark-layer-controls"
          @click="toggleLayer('watermark')"
        >
          <span class="layer-add-button__icon layer-add-button__icon--watermark">W</span>
          <span class="layer-disclosure__copy">
            <strong>{{ resolvedWatermarkValue || 'Filigran metni girilmedi' }}</strong>
            <small>
              {{
                expandedLayer === 'watermark'
                  ? 'Ayarları daralt'
                  : `${watermarkMode === 'single' ? 'Tek' : 'Tekrarlanan'} · ${watermarkOpacity}% şeffaflık`
              }}
            </small>
          </span>
          <span
            class="layer-disclosure__chevron"
            :class="{ 'layer-disclosure__chevron--open': expandedLayer === 'watermark' }"
            aria-hidden="true"
          ></span>
        </button>

        <div
          v-if="expandedLayer === 'watermark'"
          id="watermark-layer-controls"
          class="layer-controls layer-controls--flush layer-controls--disclosed"
        >
          <div class="layer-title-row">
            <span>Filigran ayarları</span>
            <button
              class="icon-button icon-button--danger"
              type="button"
              aria-label="Filigran katmanını kaldır"
              @click="removeWatermarkLayer"
            >
              <AppIcon name="trash" :size="17" />
            </button>
          </div>

          <label class="stacked-field">
            <span>Gösterilecek Bilgi</span>
            <select v-model="watermarkContentMode">
              <option value="company">Firma adı</option>
              <option value="custom">Özel filigran metni</option>
            </select>
          </label>

          <label v-if="watermarkContentMode === 'custom'" class="stacked-field">
            <span>Filigran Metni</span>
            <input
              v-model="watermarkValue"
              type="text"
              placeholder="Görselde görünecek filigranı yazın"
            />
          </label>

          <div v-else class="layer-subsection">
            <div class="layer-subsection__heading">
              <strong>İlan Bilgileri</strong>
              <small>Bu firma adı metin katmanında da ortak kullanılır.</small>
            </div>
            <label class="stacked-field">
              <span>Firma Adı</span>
              <input v-model="companyName" type="text" />
            </label>
          </div>

          <div class="inline-fields">
            <label class="select-field select-field--stacked">
              <span>Yerleşim</span>
              <select v-model="watermarkMode">
                <option value="single">Tek Filigran</option>
                <option value="repeated">Tekrarlanan</option>
              </select>
            </label>
            <label class="color-field">
              <span>Renk</span>
              <input v-model="watermarkColor" type="color" />
            </label>
          </div>

          <label class="range-field">
            <span>
              <strong>Yazı Boyutu</strong>
              <output>{{ Number(watermarkFontSize).toFixed(1) }}%</output>
            </span>
            <input
              v-model.number="watermarkFontSize"
              type="range"
              min="1"
              max="10"
              step="0.1"
            />
          </label>

          <label class="range-field">
            <span>
              <strong>Şeffaflık</strong>
              <output>{{ watermarkOpacity }}%</output>
            </span>
            <input v-model.number="watermarkOpacity" type="range" min="3" max="80" step="1" />
          </label>

          <label class="range-field">
            <span>
              <strong>Açı</strong>
              <output>{{ watermarkRotation }}°</output>
            </span>
            <input
              v-model.number="watermarkRotation"
              type="range"
              min="-75"
              max="75"
              step="1"
            />
          </label>

          <fieldset v-if="watermarkMode === 'single'" class="alignment-field">
            <legend>Hazır Konum</legend>
            <div class="alignment-grid">
              <button
                v-for="alignment in alignments"
                :key="alignment.value"
                type="button"
                :aria-label="`Filigranı ${alignment.label} konumuna taşı`"
                :title="alignment.label"
                @click="alignWatermark(alignment.value)"
              >
                <span></span>
              </button>
            </div>
          </fieldset>

          <template v-if="watermarkMode === 'repeated'">
            <label class="range-field">
              <span>
                <strong>Yatay Aralık</strong>
                <output>{{ watermarkGapX }}%</output>
              </span>
              <input v-model.number="watermarkGapX" type="range" min="10" max="60" step="1" />
            </label>
            <label class="range-field">
              <span>
                <strong>Dikey Aralık</strong>
                <output>{{ watermarkGapY }}%</output>
              </span>
              <input v-model.number="watermarkGapY" type="range" min="8" max="50" step="1" />
            </label>
          </template>
          <p class="control-hint">
            {{
              watermarkMode === 'single'
                ? 'Tek filigranı önizleme üzerinde sürükleyerek konumlandırabilirsiniz.'
                : 'Tekrarlanan filigran tüm görsel alanına otomatik yayılır.'
            }}
          </p>
        </div>
      </template>
    </section>

    <section v-if="studio.canExportBatch" class="settings-section">
      <div class="section-heading">
        <h3>Çıktı Ayarları</h3>
        <span class="status-muted">{{ studio.photos.length }} Görsel</span>
      </div>

      <label class="select-field">
        <span>Dosya Formatı</span>
        <select v-model="outputFormat">
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
        </select>
      </label>

      <label v-if="outputFormat === 'jpeg'" class="range-field range-field--quality">
        <span>
          <strong>JPG Kalitesi</strong>
          <output>{{ outputQuality }}%</output>
        </span>
        <input v-model.number="outputQuality" type="range" min="50" max="100" step="1" />
      </label>
    </section>

    <div class="settings-panel__bottom">
      <div class="export-actions">
        <button
          class="button button--wide"
          :class="studio.photos.length > 1 ? 'button--secondary' : 'button--primary'"
          type="button"
          :aria-label="isExporting ? 'Görsel hazırlanıyor' : 'Seçili Görseli İndir'"
          :disabled="
            !studio.selectedPhoto ||
              !studio.canExportSelectedPhoto ||
              isExporting ||
              isBatchExporting
          "
          @click="exportSelectedPhoto"
        >
          <AppIcon name="download" />
          <span class="export-label export-label--full">
            {{ isExporting ? 'Görsel Hazırlanıyor…' : 'Seçili Görseli İndir' }}
          </span>
          <span class="export-label export-label--compact">
            {{ isExporting ? 'Hazırlanıyor…' : 'Seçili Görsel' }}
          </span>
        </button>
        <button
          v-if="studio.photos.length > 1"
          class="button button--primary button--wide"
          type="button"
          :aria-label="
            isBatchExporting && batchProgress
              ? `Toplu görseller hazırlanıyor ${batchProgress.completed}/${batchProgress.total}`
              : `Tümünü ZIP İndir (${studio.photos.length})`
          "
          :disabled="!studio.canExportBatch || isExporting || isBatchExporting"
          @click="exportAllPhotos"
        >
          <AppIcon name="download" />
          <span class="export-label export-label--full">
            {{
              isBatchExporting && batchProgress
                ? `Hazırlanıyor ${batchProgress.completed}/${batchProgress.total}`
                : `Tümünü ZIP İndir (${studio.photos.length})`
            }}
          </span>
          <span class="export-label export-label--compact">
            {{
              isBatchExporting && batchProgress
                ? `${batchProgress.completed}/${batchProgress.total} hazırlanıyor`
                : `ZIP İndir (${studio.photos.length})`
            }}
          </span>
        </button>
      </div>
      <div v-if="isBatchExporting && batchProgress" class="batch-progress" role="status">
        <div class="batch-progress__track">
          <span
            :style="{
              width: `${(batchProgress.completed / Math.max(batchProgress.total, 1)) * 100}%`,
            }"
          ></span>
        </div>
        <div class="batch-progress__status">
          <span>{{ batchProgress.completed }}/{{ batchProgress.total }} görsel tamamlandı</span>
          <button class="text-button text-button--danger" type="button" @click="cancelBatchExport">
            İptal Et
          </button>
        </div>
      </div>
      <p v-if="exportError" class="field-error" role="alert">{{ exportError }}</p>
      <p v-else-if="studio.canExportBatch">
        Tüm çıktılar fotoğrafların kendi orijinal çözünürlüğünde hazırlanır.
      </p>
      <p v-else>İndirmek için fotoğrafı iyileştirin veya en az bir katman ekleyin.</p>
    </div>
  </aside>
</template>
