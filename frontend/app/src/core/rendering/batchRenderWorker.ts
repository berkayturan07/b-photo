import interLatinExtUrl from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url'
import interLatinUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

import { assertRenderableSize, drawScene } from '@/core/rendering/renderScene'

import type {
  BatchRenderRequest,
  BatchRenderResponse,
  WorkerLogoInput,
  WorkerPhotoInput,
} from './batchRenderProtocol'
import type { TemplateVariables, VisualRecipe } from '@/types/template'

/**
 * Toplu render'ın tamamı bu worker'da yürür: kod çözme, çizim ve JPEG/PNG
 * kodlama. Ana iş parçacığı yalnız ZIP paketlemesini yapar, böylece arayüz
 * büyük fotoğraf setlerinde donmaz.
 *
 * Yazı tipi ana iş parçacığından miras alınmaz; worker kendi `FontFace`
 * kaydını yapar. Türkçe karakterler latin-ext altkümesinde olduğu için iki
 * altküme birden yüklenir.
 */
interface WorkerScope {
  fonts: FontFaceSet
  postMessage(message: BatchRenderResponse, transfer?: Transferable[]): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<BatchRenderRequest>) => void,
  ): void
}

const scope = self as unknown as WorkerScope

let recipe: VisualRecipe | null = null
let variables: TemplateVariables | null = null
let logo: WorkerLogoInput | null = null
let fontsPromise: Promise<void> | null = null

function ensureFonts(): Promise<void> {
  fontsPromise ??= Promise.all(
    [interLatinUrl, interLatinExtUrl].map(async (url) => {
      const face = new FontFace('Inter Variable', `url(${url}) format('woff2')`, {
        weight: '100 900',
      })
      scope.fonts.add(await face.load())
    }),
  ).then(() => undefined)

  return fontsPromise
}

function releaseLogo(): void {
  logo?.bitmap.close()
  logo = null
}

async function renderPhoto(photo: WorkerPhotoInput): Promise<Blob> {
  if (!recipe || !variables) {
    throw new Error('Worker yapılandırılmadan render isteği alındı.')
  }

  assertRenderableSize(photo.width, photo.height)
  await ensureFonts()

  // `from-image`, ana iş parçacığındaki `HTMLImageElement` davranışıyla aynı
  // EXIF yönünü uygular; iki yol arasında çıktı farkı oluşmasını engeller.
  const bitmap = await createImageBitmap(photo.file, { imageOrientation: 'from-image' })

  const canvas = new OffscreenCanvas(photo.width, photo.height)

  try {
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Worker Canvas 2D işlemini başlatamadı.')
    }

    drawScene({
      context,
      photo,
      photoImage: bitmap,
      logoImage: logo?.bitmap ?? null,
      logoSize: logo,
      recipe,
      variables,
    })

    return await canvas.convertToBlob({
      type: recipe.output.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality: recipe.output.quality,
    })
  } finally {
    // Tuval ve kod çözülmüş görsel, sıradaki fotoğraf başlamadan bırakılır;
    // aksi halde büyük setlerde tepe bellek fotoğraf sayısıyla birlikte artar.
    bitmap.close()
    canvas.width = 1
    canvas.height = 1
  }
}

scope.addEventListener('message', (event) => {
  const request = event.data

  if (request.type === 'configure') {
    releaseLogo()
    recipe = request.recipe
    variables = request.variables
    logo = request.logo
    void ensureFonts().then(
      () => scope.postMessage({ type: 'ready' }),
      (error: unknown) =>
        scope.postMessage({
          type: 'failed',
          index: null,
          message: error instanceof Error ? error.message : 'Yazı tipi worker içinde yüklenemedi.',
        }),
    )
    return
  }

  if (request.type === 'dispose') {
    releaseLogo()
    recipe = null
    variables = null
    return
  }

  const { index, photo } = request
  renderPhoto(photo).then(
    (blob) => scope.postMessage({ type: 'rendered', index, blob }),
    (error: unknown) =>
      scope.postMessage({
        type: 'failed',
        index,
        message: error instanceof Error ? error.message : 'Worker render sırasında hata verdi.',
      }),
  )
})
