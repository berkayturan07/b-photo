<script setup lang="ts">
import type Konva from 'konva'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import { calculateTextBoxLayout, clamp } from '@/core/rendering/geometry'
import { drawPhotoWithAdjustments } from '@/core/rendering/photoAdjustments'
import { toKonvaFontStyle } from '@/core/rendering/konvaText'
import {
  constrainPreviewPan,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  zoomPreviewAroundPoint,
} from '@/core/rendering/previewCamera'
import { resolveTemplateText } from '@/core/template/interpolate'
import { useStudioStore } from '@/stores/studio'

interface VueKonvaNode<T> {
  getNode: () => T
}

// Legacy key is retained so the B Photo rename preserves the user's preference.
const WHEEL_ZOOM_STORAGE_KEY = 'ilan-matik:wheel-zoom-enabled'
const studio = useStudioStore()
const previewPanel = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const photoImageElement = ref<HTMLImageElement | null>(null)
const adjustedPhotoCanvas = ref<HTMLCanvasElement | null>(null)
const logoImageElement = ref<HTMLImageElement | null>(null)
const logoNode = ref<VueKonvaNode<Konva.Image> | null>(null)
const transformerNode = ref<VueKonvaNode<Konva.Transformer> | null>(null)
const stageWidth = ref(720)
const stageHeight = ref(480)
const cameraZoom = ref(1)
const cameraPanX = ref(0)
const cameraPanY = ref(0)
const isPanning = ref(false)
const spacePressed = ref(false)
const wheelZoomEnabled = ref(readWheelZoomPreference())
const isExpandedPreview = ref(false)
let panStart: { pointerX: number; pointerY: number; panX: number; panY: number } | null = null
let pinchDistance: number | null = null
let resizeObserver: ResizeObserver | null = null
const measurementCanvas = document.createElement('canvas')
const measurementContext = measurementCanvas.getContext('2d')
const zoomSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
}))

const fittedPhotoFrame = computed(() => {
  const photo = studio.selectedPhoto
  if (!photo || !photoImageElement.value) {
    return null
  }

  const padding = 28
  const availableWidth = Math.max(stageWidth.value - padding * 2, 1)
  const availableHeight = Math.max(stageHeight.value - padding * 2, 1)
  const scale = Math.min(availableWidth / photo.width, availableHeight / photo.height)
  const width = photo.width * scale
  const height = photo.height * scale

  return {
    x: (stageWidth.value - width) / 2,
    y: (stageHeight.value - height) / 2,
    width,
    height,
  }
})

const photoFrame = computed(() => {
  const fittedFrame = fittedPhotoFrame.value
  if (!fittedFrame) {
    return null
  }

  const width = fittedFrame.width * cameraZoom.value
  const height = fittedFrame.height * cameraZoom.value

  return {
    x: (stageWidth.value - width) / 2 + cameraPanX.value,
    y: (stageHeight.value - height) / 2 + cameraPanY.value,
    width,
    height,
  }
})

const zoomPercentage = computed(() => Math.round(cameraZoom.value * 100))
const isFitView = computed(
  () =>
    Math.abs(cameraZoom.value - 1) < 0.001 &&
    Math.abs(cameraPanX.value) < 0.5 &&
    Math.abs(cameraPanY.value) < 0.5,
)
const canZoomOut = computed(() => cameraZoom.value > MIN_PREVIEW_ZOOM + 0.001)
const canZoomIn = computed(() => cameraZoom.value < MAX_PREVIEW_ZOOM - 0.001)
const canPan = computed(() => cameraZoom.value > 1)
const previewHelpText = computed(() => {
  if (studio.isOriginalPreviewVisible) {
    return 'Karşılaştırma için seçili fotoğrafın düzenlenmemiş hâli gösteriliyor.'
  }

  const layerHint =
    studio.logoAsset ||
    studio.textLayer ||
    (studio.watermarkLayer && studio.watermarkLayer.mode === 'single')
      ? 'Katmanları sürükleyebilirsiniz. '
      : ''
  const wheelHint = wheelZoomEnabled.value
    ? 'Tekerlekle zoom açık; yakın görünümde fotoğrafı sürükleyerek gezinin.'
    : 'Tekerlek sayfayı kaydırır; Ctrl veya Cmd ile birlikte kullanırsanız zoom yapar.'

  return `${layerHint}${wheelHint}`
})

const previewPhotoSource = computed(
  () => adjustedPhotoCanvas.value ?? photoImageElement.value,
)

const photoConfig = computed(() => {
  if (!photoFrame.value || !previewPhotoSource.value) {
    return null
  }

  return {
    image: previewPhotoSource.value,
    name: 'preview-photo',
    ...photoFrame.value,
  }
})

const logoConfig = computed(() => {
  const frame = photoFrame.value
  const layer = studio.logoLayer
  const asset = studio.logoAsset
  if (!frame || !layer || !asset || !logoImageElement.value) {
    return null
  }

  const width = frame.width * (layer.widthPercent / 100)
  const height = width * (asset.height / asset.width)
  const minimumX = frame.x
  const minimumY = frame.y
  const maximumX = frame.x + frame.width - width
  const maximumY = frame.y + frame.height - height

  return {
    image: logoImageElement.value,
    x: frame.x + frame.width * (layer.xPercent / 100),
    y: frame.y + frame.height * (layer.yPercent / 100),
    width,
    height,
    opacity: layer.opacity,
    rotation: layer.rotation,
    draggable: !spacePressed.value,
    dragBoundFunc: (position: { x: number; y: number }) => ({
      x: clamp(position.x, minimumX, Math.max(maximumX, minimumX)),
      y: clamp(position.y, minimumY, Math.max(maximumY, minimumY)),
    }),
  }
})

const textVisual = computed(() => {
  const frame = photoFrame.value
  const layer = studio.textLayer
  if (!frame || !layer) {
    return null
  }

  const value = resolveTemplateText(layer.value, studio.templateVariables)
  if (!value.trim()) {
    return null
  }

  const desiredFontSize = frame.width * (layer.fontSizePercent / 100)
  const desiredWidth = measureText(
    value,
    desiredFontSize,
    layer.fontWeight,
    layer.fontFamily,
  )
  const layout = calculateTextBoxLayout(layer, frame, desiredWidth)
  const minimumX = frame.x
  const minimumY = frame.y
  const maximumX = frame.x + frame.width - layout.width
  const maximumY = frame.y + frame.height - layout.height

  return {
    group: {
      x: frame.x + layout.x,
      y: frame.y + layout.y,
      opacity: layer.opacity,
      draggable: !spacePressed.value,
      dragBoundFunc: (position: { x: number; y: number }) => ({
        x: clamp(position.x, minimumX, Math.max(maximumX, minimumX)),
        y: clamp(position.y, minimumY, Math.max(maximumY, minimumY)),
      }),
    },
    background: {
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      fill: layer.backgroundColor,
      cornerRadius: Math.max(layout.fontSize * 0.16, 2),
      visible: layer.backgroundEnabled,
    },
    text: {
      x: layout.padding,
      y: layout.padding,
      text: value,
      fontSize: layout.fontSize,
      // Kırpılmayı tetikleyen alt piksel yuvarlamalarına karşı bir piksellik
      // pay bırakılır; arka plan kutusu `layout.width` ile hesaplandığı için
      // bu pay görünümü değiştirmez.
      width: Math.ceil(layout.textWidth) + 1,
      height: layout.textHeight,
      fontFamily: layer.fontFamily,
      fontStyle: toKonvaFontStyle(layer.fontWeight),
      fill: layer.color,
      verticalAlign: 'middle',
      wrap: 'none',
      listening: false,
    },
  }
})

const watermarkGroupConfig = computed(() => {
  const frame = photoFrame.value
  const layer = studio.watermarkLayer
  if (!frame || !layer) {
    return null
  }

  return {
    clipX: frame.x,
    clipY: frame.y,
    clipWidth: frame.width,
    clipHeight: frame.height,
    listening: layer.mode === 'single',
  }
})

const watermarkItems = computed(() => {
  const frame = photoFrame.value
  const layer = studio.watermarkLayer
  if (!frame || !layer) {
    return []
  }

  const value = resolveTemplateText(layer.value, studio.templateVariables)
  if (!value.trim()) {
    return []
  }

  const fontSize = frame.width * (layer.fontSizePercent / 100)
  const textWidth = measureText(value, fontSize, layer.fontWeight, layer.fontFamily)
  const baseConfig = {
    text: value,
    fontSize,
    fontFamily: layer.fontFamily,
    fontStyle: toKonvaFontStyle(layer.fontWeight),
    fill: layer.color,
    opacity: layer.opacity,
    rotation: layer.rotation,
    offsetX: textWidth / 2,
    offsetY: fontSize / 2,
    listening: false,
  }

  if (layer.mode === 'single') {
    const radians = (layer.rotation * Math.PI) / 180
    const rotatedWidth =
      Math.abs(textWidth * Math.cos(radians)) + Math.abs(fontSize * Math.sin(radians))
    const rotatedHeight =
      Math.abs(textWidth * Math.sin(radians)) + Math.abs(fontSize * Math.cos(radians))
    const halfWidth = rotatedWidth / 2
    const halfHeight = rotatedHeight / 2

    return [
      {
        ...baseConfig,
        id: 'watermark-single',
        x: frame.x + frame.width * (layer.xPercent / 100),
        y: frame.y + frame.height * (layer.yPercent / 100),
        listening: true,
        draggable: !spacePressed.value,
        dragBoundFunc: (position: { x: number; y: number }) => ({
          x: clamp(
            position.x,
            frame.x + halfWidth,
            Math.max(frame.x + frame.width - halfWidth, frame.x + halfWidth),
          ),
          y: clamp(
            position.y,
            frame.y + halfHeight,
            Math.max(frame.y + frame.height - halfHeight, frame.y + halfHeight),
          ),
        }),
      },
    ]
  }

  const items: Array<Record<string, unknown>> = []
  const gapX = Math.max(frame.width * (layer.gapXPercent / 100), fontSize * 2)
  const gapY = Math.max(frame.height * (layer.gapYPercent / 100), fontSize * 2)
  let index = 0

  for (let y = frame.y - gapY; y <= frame.y + frame.height + gapY; y += gapY) {
    for (let x = frame.x - gapX; x <= frame.x + frame.width + gapX; x += gapX) {
      items.push({
        ...baseConfig,
        id: `watermark-${index}`,
        x,
        y,
      })
      index += 1
    }
  }

  return items
})

const backgroundConfig = computed(() => ({
  name: 'preview-background',
  x: 0,
  y: 0,
  width: stageWidth.value,
  height: stageHeight.value,
  fill: '#17202c',
}))

function measureText(value: string, size: number, weight: number, family: string): number {
  if (!measurementContext) {
    return value.length * size * 0.6
  }

  measurementContext.font = `${weight} ${size}px "${family}", sans-serif`
  return measurementContext.measureText(value).width
}

function readWheelZoomPreference(): boolean {
  try {
    return window.localStorage.getItem(WHEEL_ZOOM_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveWheelZoomPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(WHEEL_ZOOM_STORAGE_KEY, String(enabled))
  } catch {
    // Tarayıcı depolamayı engellese de anahtar oturum boyunca çalışmaya devam eder.
  }
}

const transformerConfig = {
  rotateEnabled: false,
  flipEnabled: false,
  keepRatio: true,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  anchorFill: '#ffffff',
  anchorStroke: '#0c8f86',
  anchorStrokeWidth: 2,
  anchorSize: 10,
  borderStroke: '#0c8f86',
  borderStrokeWidth: 2,
  boundBoxFunc: (
    _oldBox: { width: number; height: number },
    nextBox: { width: number; height: number },
  ) => {
    if (nextBox.width < 24 || nextBox.height < 12) {
      return _oldBox
    }
    return nextBox
  },
}

async function loadSelectedPhoto(): Promise<void> {
  photoImageElement.value = null
  adjustedPhotoCanvas.value = null
  const photo = studio.selectedPhoto
  if (!photo) {
    return
  }

  photoImageElement.value = await loadImage(photo.objectUrl)
  refreshAdjustedPhotoPreview()
}

function refreshAdjustedPhotoPreview(): void {
  const photo = studio.selectedPhoto
  const image = photoImageElement.value
  if (
    !photo ||
    !image ||
    !studio.selectedPhotoHasAdjustments ||
    studio.isOriginalPreviewVisible
  ) {
    adjustedPhotoCanvas.value = null
    return
  }

  const maximumPreviewDimension = 1600
  const scale = Math.min(
    1,
    maximumPreviewDimension / Math.max(photo.width, photo.height),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(Math.round(photo.width * scale), 1)
  canvas.height = Math.max(Math.round(photo.height * scale), 1)
  const context = canvas.getContext('2d')
  if (!context) {
    adjustedPhotoCanvas.value = null
    return
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  drawPhotoWithAdjustments(
    context,
    image,
    0,
    0,
    canvas.width,
    canvas.height,
    photo.adjustments,
  )
  adjustedPhotoCanvas.value = canvas
}

async function loadLogo(): Promise<void> {
  logoImageElement.value = null
  if (!studio.logoAsset) {
    return
  }

  logoImageElement.value = await loadImage(studio.logoAsset.objectUrl)
  await nextTick()
  attachTransformer()
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Önizleme görseli yüklenemedi.'))
    image.src = objectUrl
  })
}

function attachTransformer(): void {
  const imageNode = logoNode.value?.getNode()
  const transformer = transformerNode.value?.getNode()
  if (!imageNode || !transformer) {
    return
  }

  transformer.nodes([imageNode])
  transformer.getLayer()?.batchDraw()
}

function handleLogoDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
  const frame = photoFrame.value
  if (!frame) {
    return
  }

  studio.updateLogoLayer({
    xPercent: ((event.target.x() - frame.x) / frame.width) * 100,
    yPercent: ((event.target.y() - frame.y) / frame.height) * 100,
  })
}

function handleLogoTransformEnd(event: Konva.KonvaEventObject<Event>): void {
  const frame = photoFrame.value
  if (!frame) {
    return
  }

  const node = event.target
  const width = node.width() * node.scaleX()
  const x = node.x()
  const y = node.y()
  node.scaleX(1)
  node.scaleY(1)

  studio.updateLogoLayer({
    xPercent: ((x - frame.x) / frame.width) * 100,
    yPercent: ((y - frame.y) / frame.height) * 100,
    widthPercent: (width / frame.width) * 100,
  })
  void nextTick(attachTransformer)
}

function handleTextDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
  const frame = photoFrame.value
  if (!frame) {
    return
  }

  studio.updateTextLayer({
    xPercent: ((event.target.x() - frame.x) / frame.width) * 100,
    yPercent: ((event.target.y() - frame.y) / frame.height) * 100,
  })
}

function handleWatermarkDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
  const frame = photoFrame.value
  if (!frame) {
    return
  }

  studio.updateWatermarkLayer({
    xPercent: ((event.target.x() - frame.x) / frame.width) * 100,
    yPercent: ((event.target.y() - frame.y) / frame.height) * 100,
  })
}

function setCamera(zoom: number, panX: number, panY: number): void {
  const fittedFrame = fittedPhotoFrame.value
  if (!fittedFrame) {
    return
  }

  const camera = constrainPreviewPan(
    { zoom, panX, panY },
    fittedFrame.width,
    fittedFrame.height,
  )
  cameraZoom.value = camera.zoom
  cameraPanX.value = camera.panX
  cameraPanY.value = camera.panY
  void nextTick(attachTransformer)
}

function applyZoom(nextZoom: number, focus?: { x: number; y: number }): void {
  const fittedFrame = fittedPhotoFrame.value
  if (!fittedFrame) {
    return
  }

  const camera = zoomPreviewAroundPoint(
    {
      zoom: cameraZoom.value,
      panX: cameraPanX.value,
      panY: cameraPanY.value,
    },
    nextZoom,
    focus ?? { x: stageWidth.value / 2, y: stageHeight.value / 2 },
    { x: stageWidth.value / 2, y: stageHeight.value / 2 },
    fittedFrame.width,
    fittedFrame.height,
  )
  setCamera(camera.zoom, camera.panX, camera.panY)
}

function zoomIn(): void {
  const nextZoom =
    zoomSteps.find((step) => step > cameraZoom.value + 0.001) ?? MAX_PREVIEW_ZOOM
  applyZoom(nextZoom)
}

function zoomOut(): void {
  const nextZoom =
    [...zoomSteps].reverse().find((step) => step < cameraZoom.value - 0.001) ??
    MIN_PREVIEW_ZOOM
  applyZoom(nextZoom)
}

function resetCamera(): void {
  cameraZoom.value = 1
  cameraPanX.value = 0
  cameraPanY.value = 0
  stopPanning()
  void nextTick(attachTransformer)
}

function handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
  if (
    !wheelZoomEnabled.value &&
    !event.evt.ctrlKey &&
    !event.evt.metaKey
  ) {
    return
  }

  const pointer = event.target.getStage()?.getPointerPosition()
  if (!pointer) {
    return
  }

  event.evt.preventDefault()
  const multiplier = event.evt.deltaY > 0 ? 1 / 1.12 : 1.12
  applyZoom(cameraZoom.value * multiplier, pointer)
}

function canStartPan(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean {
  if (!canPan.value) {
    return false
  }

  const targetName = event.target.name()
  return (
    spacePressed.value ||
    targetName === 'preview-photo' ||
    targetName === 'preview-background'
  )
}

function startPanning(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (!canStartPan(event)) {
    return
  }

  if (event.evt instanceof MouseEvent && event.evt.button !== 0) {
    return
  }

  const pointer = event.target.getStage()?.getPointerPosition()
  if (!pointer) {
    return
  }

  event.evt.preventDefault()
  event.cancelBubble = true
  panStart = {
    pointerX: pointer.x,
    pointerY: pointer.y,
    panX: cameraPanX.value,
    panY: cameraPanY.value,
  }
  isPanning.value = true
}

function movePanning(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (!panStart || !isPanning.value) {
    return
  }

  const pointer = event.target.getStage()?.getPointerPosition()
  if (!pointer) {
    return
  }

  event.evt.preventDefault()
  setCamera(
    cameraZoom.value,
    panStart.panX + pointer.x - panStart.pointerX,
    panStart.panY + pointer.y - panStart.pointerY,
  )
}

function stopPanning(): void {
  panStart = null
  pinchDistance = null
  isPanning.value = false
}

function touchPoint(
  stage: Konva.Stage,
  firstTouch: Touch,
  secondTouch?: Touch,
): { x: number; y: number } {
  const bounds = stage.container().getBoundingClientRect()
  const clientX = secondTouch
    ? (firstTouch.clientX + secondTouch.clientX) / 2
    : firstTouch.clientX
  const clientY = secondTouch
    ? (firstTouch.clientY + secondTouch.clientY) / 2
    : firstTouch.clientY

  return { x: clientX - bounds.left, y: clientY - bounds.top }
}

function handleTouchStart(event: Konva.KonvaEventObject<TouchEvent>): void {
  const stage = event.target.getStage()
  const [firstTouch, secondTouch] = Array.from(event.evt.touches)
  if (!stage || !firstTouch) {
    return
  }

  if (secondTouch) {
    event.evt.preventDefault()
    stopPanning()
    pinchDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    )
    return
  }

  startPanning(event)
}

function handleTouchMove(event: Konva.KonvaEventObject<TouchEvent>): void {
  const stage = event.target.getStage()
  const [firstTouch, secondTouch] = Array.from(event.evt.touches)
  if (!stage || !firstTouch) {
    return
  }

  if (secondTouch && pinchDistance) {
    event.evt.preventDefault()
    const nextDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    )
    const focus = touchPoint(stage, firstTouch, secondTouch)
    applyZoom(cameraZoom.value * (nextDistance / pinchDistance), focus)
    pinchDistance = nextDistance
    return
  }

  movePanning(event)
}

function handleSpaceDown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || !studio.selectedPhoto) {
    return
  }

  event.preventDefault()
  spacePressed.value = true
}

function handleSpaceUp(event: KeyboardEvent): void {
  if (event.code !== 'Space') {
    return
  }

  spacePressed.value = false
  stopPanning()
}

function handleCanvasBlur(): void {
  spacePressed.value = false
  stopPanning()
}

function setExpandedPreview(expanded: boolean): void {
  isExpandedPreview.value = expanded
  document.body.classList.toggle('preview-expanded', expanded)
  void nextTick(() => {
    updateStageSize()
    container.value?.focus()
  })
}

function toggleExpandedPreview(): void {
  setExpandedPreview(!isExpandedPreview.value)
}

function handleExpandedPreviewKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isExpandedPreview.value) {
    setExpandedPreview(false)
  }
}

function updateStageSize(): void {
  if (!container.value) {
    return
  }

  stageWidth.value = Math.max(Math.floor(container.value.clientWidth), 320)
  stageHeight.value = Math.max(Math.floor(container.value.clientHeight), 360)
  setCamera(cameraZoom.value, cameraPanX.value, cameraPanY.value)
  void nextTick(attachTransformer)
}

watch(
  () => studio.selectedPhoto?.objectUrl,
  async () => {
    resetCamera()
    try {
      await loadSelectedPhoto()
      await nextTick()
      attachTransformer()
    } catch {
      photoImageElement.value = null
    }
  },
  { immediate: true },
)

watch(
  () => [
    studio.selectedPhoto?.adjustments.brightness ?? 0,
    studio.selectedPhoto?.adjustments.contrast ?? 0,
    studio.selectedPhoto?.adjustments.saturation ?? 0,
    studio.selectedPhoto?.adjustments.warmth ?? 0,
    studio.isOriginalPreviewVisible,
  ],
  refreshAdjustedPhotoPreview,
)

watch(
  () => studio.logoAsset?.objectUrl,
  async () => {
    try {
      await loadLogo()
    } catch {
      logoImageElement.value = null
    }
  },
  { immediate: true },
)

watch(wheelZoomEnabled, saveWheelZoomPreference)

onMounted(async () => {
  await nextTick()
  updateStageSize()
  resizeObserver = new ResizeObserver(updateStageSize)
  if (container.value) {
    resizeObserver.observe(container.value)
  }
  document.addEventListener('keydown', handleExpandedPreviewKeydown)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('keydown', handleExpandedPreviewKeydown)
  document.body.classList.remove('preview-expanded')
})
</script>

<template>
  <main
    ref="previewPanel"
    class="preview-panel"
    :class="{ 'preview-panel--expanded': isExpandedPreview }"
  >
    <div class="preview-toolbar">
      <h2 class="eyebrow">Önizleme</h2>
      <div v-if="studio.selectedPhoto" class="preview-toolbar__meta">
        <div class="zoom-controls" aria-label="Önizleme yakınlaştırma kontrolleri">
          <button
            type="button"
            class="zoom-control"
            :disabled="!canZoomOut"
            aria-label="Önizlemeyi uzaklaştır"
            title="Uzaklaştır"
            @click="zoomOut"
          >
            −
          </button>
          <output
            class="zoom-controls__value"
            aria-live="polite"
            aria-label="Önizleme yakınlaştırma oranı"
            data-testid="preview-zoom-value"
          >
            %{{ zoomPercentage }}
          </output>
          <button
            type="button"
            class="zoom-control"
            :disabled="!canZoomIn"
            aria-label="Önizlemeyi yakınlaştır"
            title="Yakınlaştır"
            @click="zoomIn"
          >
            +
          </button>
          <button
            type="button"
            class="zoom-fit-button"
            :disabled="isFitView"
            aria-label="Önizlemeyi ekrana sığdır"
            title="Fotoğrafın tamamını ekrana sığdır"
            @click="resetCamera"
          >
            Ekrana Sığdır
          </button>
        </div>
        <label
          class="wheel-zoom-toggle"
          :class="{ 'wheel-zoom-toggle--active': wheelZoomEnabled }"
          title="Açıkken fare tekerleği önizlemeyi yakınlaştırır"
        >
          <span class="wheel-zoom-toggle__label" aria-hidden="true">Tekerlekle Zoom</span>
          <input
            v-model="wheelZoomEnabled"
            class="visually-hidden"
            type="checkbox"
            aria-label="Tekerlekle zoom"
          />
          <span class="wheel-zoom-toggle__track" aria-hidden="true">
            <span></span>
          </span>
        </label>
        <button
          type="button"
          class="preview-expand-button"
          :aria-pressed="isExpandedPreview"
          :aria-label="
            isExpandedPreview
              ? 'Büyük önizleme görünümünü kapat'
              : 'Önizlemeyi büyük görünümde aç'
          "
          :title="isExpandedPreview ? 'Büyük görünümü kapat (Esc)' : 'Büyük görünüm'"
          @click="toggleExpandedPreview"
        >
          <AppIcon :name="isExpandedPreview ? 'collapse' : 'expand'" :size="16" />
          <span>{{ isExpandedPreview ? 'Küçült' : 'Büyük Görünüm' }}</span>
        </button>
        <span class="resolution-badge">
          {{ studio.selectedPhoto.width }} × {{ studio.selectedPhoto.height }} px
        </span>
      </div>
    </div>

    <div
      ref="container"
      class="canvas-shell"
      :class="{
        'canvas-shell--pan-ready': canPan,
        'canvas-shell--panning': isPanning,
        'canvas-shell--space-pan': spacePressed,
      }"
      tabindex="0"
      aria-label="Görsel önizleme çalışma alanı"
      @keydown="handleSpaceDown"
      @keyup="handleSpaceUp"
      @blur="handleCanvasBlur"
    >
      <v-stage
        v-if="studio.selectedPhoto && photoConfig"
        :config="stageConfig"
        @wheel="handleWheel"
        @mousedown="startPanning"
        @mousemove="movePanning"
        @mouseup="stopPanning"
        @mouseleave="stopPanning"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="stopPanning"
        @touchcancel="stopPanning"
      >
        <v-layer>
          <v-rect :config="backgroundConfig" />
          <v-image :config="photoConfig" />
          <v-group v-if="watermarkGroupConfig" :config="watermarkGroupConfig">
            <v-text
              v-for="item in watermarkItems"
              :key="String(item.id)"
              :config="item"
              @dragend="handleWatermarkDragEnd"
            />
          </v-group>
          <v-image
            v-if="logoConfig"
            ref="logoNode"
            :config="logoConfig"
            @dragend="handleLogoDragEnd"
            @transformend="handleLogoTransformEnd"
          />
          <v-transformer
            v-if="logoConfig"
            ref="transformerNode"
            :config="transformerConfig"
          />
          <v-group
            v-if="textVisual"
            :config="textVisual.group"
            @dragend="handleTextDragEnd"
          >
            <v-rect :config="textVisual.background" />
            <v-text :config="textVisual.text" />
          </v-group>
        </v-layer>
      </v-stage>
      <div v-else class="canvas-empty">
        <span class="canvas-empty__icon">
          <AppIcon name="sparkles" :size="32" />
        </span>
        <h3>Çalışma alanı hazır</h3>
        <p>Önizlemeye başlamak için bir veya daha fazla fotoğraf ekleyin.</p>
      </div>
    </div>

    <div class="preview-footer">
      <span>{{ previewHelpText }}</span>
      <span class="local-pill"><span></span> Yerel İşleme</span>
    </div>
  </main>
</template>
