import { clamp } from '@/core/rendering/geometry'
import { releaseCanvas } from '@/core/rendering/exportPhoto'
import type { StudioLogoAsset } from '@/types/logo'
import type { StudioPhoto } from '@/types/photo'
import type { TemplateVariables, VisualRecipe } from '@/types/template'

import type {
  BatchRenderRequest,
  BatchRenderResponse,
  WorkerLogoInput,
} from './batchRenderProtocol'

/** Vektör logonun rasterleştirileceği en büyük kenar; bellek üst sınırıdır. */
const MAX_LOGO_RASTER_WIDTH = 4096

export interface BatchRenderSession {
  render(photo: StudioPhoto): Promise<Blob>
  dispose(): void
}

export function isWorkerRenderSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap === 'function'
  )
}

/**
 * Logo, worker'a bir kez rasterleştirilmiş olarak aktarılır. SVG blob'ları
 * worker içinde `createImageBitmap` ile açılamadığı için rasterleştirme ana
 * iş parçacığında yapılır; vektör logo, setteki en büyük fotoğrafa göre
 * gereken çözünürlükte hazırlanır ki büyütmede bulanıklaşmasın.
 */
export async function prepareLogoBitmap(
  logoAsset: StudioLogoAsset,
  targetWidth: number,
): Promise<WorkerLogoInput> {
  const isVector =
    logoAsset.file.type === 'image/svg+xml' || /\.svg$/i.test(logoAsset.file.name)
  const aspectRatio = logoAsset.height > 0 ? logoAsset.width / logoAsset.height : 1
  const width = Math.round(
    clamp(isVector ? targetWidth : logoAsset.width, 1, MAX_LOGO_RASTER_WIDTH),
  )
  const height = Math.max(Math.round(width / aspectRatio), 1)

  const image = await loadImage(logoAsset.objectUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  try {
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Logo rasterleştirilemedi.')
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    return { bitmap: await createImageBitmap(canvas), width, height }
  } finally {
    image.src = ''
    releaseCanvas(canvas)
  }
}

/** Toplu render için worker'ın gerektiği en büyük logo genişliğini hesaplar. */
export function calculateLogoTargetWidth(
  photos: readonly StudioPhoto[],
  recipe: VisualRecipe,
): number {
  const logoLayer = recipe.layers.find((layer) => layer.role === 'logo')
  if (!logoLayer || logoLayer.type !== 'image') {
    return 1
  }

  const widestPhoto = photos.reduce((widest, photo) => Math.max(widest, photo.width), 0)
  return Math.max((widestPhoto * logoLayer.widthPercent) / 100, 1)
}

export async function createBatchRenderSession(options: {
  recipe: VisualRecipe
  variables: TemplateVariables
  logo: WorkerLogoInput | null
}): Promise<BatchRenderSession> {
  const worker = new Worker(new URL('./batchRenderWorker.ts', import.meta.url), {
    type: 'module',
  })

  let nextIndex = 0
  let pending: {
    index: number
    resolve: (blob: Blob) => void
    reject: (error: Error) => void
  } | null = null

  function settleFailure(error: Error): void {
    const current = pending
    pending = null
    current?.reject(error)
  }

  worker.addEventListener('message', (event: MessageEvent<BatchRenderResponse>) => {
    const response = event.data

    if (response.type === 'rendered') {
      if (pending?.index === response.index) {
        const { resolve } = pending
        pending = null
        resolve(response.blob)
      }
      return
    }

    if (response.type === 'failed') {
      settleFailure(new Error(response.message))
    }
  })

  worker.addEventListener('error', (event) => {
    settleFailure(new Error(event.message || 'Toplu render worker hatası.'))
  })

  function post(request: BatchRenderRequest, transfer?: Transferable[]): void {
    worker.postMessage(request, transfer ?? [])
  }

  await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent<BatchRenderResponse>) => {
      if (event.data.type === 'ready') {
        cleanup()
        resolve()
      } else if (event.data.type === 'failed') {
        cleanup()
        reject(new Error(event.data.message))
      }
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(event.message || 'Toplu render worker başlatılamadı.'))
    }
    function cleanup(): void {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    post(
      {
        type: 'configure',
        recipe: toPlainData(options.recipe),
        variables: toPlainData(options.variables),
        logo: options.logo,
      },
      options.logo ? [options.logo.bitmap] : [],
    )
  })

  return {
    render(photo: StudioPhoto): Promise<Blob> {
      const index = nextIndex
      nextIndex += 1

      return new Promise<Blob>((resolve, reject) => {
        pending = { index, resolve, reject }
        post({
          type: 'render',
          index,
          photo: {
            file: photo.file,
            width: photo.width,
            height: photo.height,
            adjustments: toPlainData(photo.adjustments),
          },
        })
      })
    },
    dispose(): void {
      settleFailure(new Error('Toplu render oturumu kapatıldı.'))
      post({ type: 'dispose' })
      worker.terminate()
    },
  }
}

/**
 * `postMessage` yapılandırılmış klonlaması Proxy nesnelerini reddeder; store'dan
 * gelen reçete, değişkenler ve ayarlar reaktif proxy olduğu için worker'a
 * gönderilmeden önce düz veriye çevrilir.
 */
function toPlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Logo render için yüklenemedi.'))
    image.src = objectUrl
  })
}
