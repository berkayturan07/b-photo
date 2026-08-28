import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'

import {
  calculateLogoTargetWidth,
  createBatchRenderSession,
  isWorkerRenderSupported,
  prepareLogoBitmap,
  type BatchRenderSession,
} from '@/core/rendering/batchRenderClient'
import {
  buildOutputFilename,
  renderPhoto,
  type RenderPhotoOptions,
} from '@/core/rendering/exportPhoto'
import { assertRenderableSize } from '@/core/rendering/renderScene'
import type { StudioPhoto } from '@/types/photo'

export interface BatchRenderProgress {
  completed: number
  total: number
  filename: string
}

export interface RenderPhotosArchiveOptions
  extends Omit<RenderPhotoOptions, 'photo'> {
  photos: StudioPhoto[]
  signal?: AbortSignal
  onProgress?: (progress: BatchRenderProgress) => void
}

export async function renderPhotosArchive(
  options: RenderPhotosArchiveOptions,
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip')
  const zipWriter = new ZipWriter(blobWriter)
  const usedFilenames = new Set<string>()
  const session = await startRenderSession(options)

  try {
    for (const [index, photo] of options.photos.entries()) {
      throwIfAborted(options.signal)
      const blob = await renderInSessionOrFallback(session, photo, options)
      throwIfAborted(options.signal)

      const filename = makeUniqueFilename(
        buildOutputFilename(photo.file.name, options.recipe.output.format),
        usedFilenames,
      )
      await zipWriter.add(filename, new BlobReader(blob))
      options.onProgress?.({
        completed: index + 1,
        total: options.photos.length,
        filename,
      })
    }

    return await zipWriter.close()
  } catch (error) {
    try {
      await zipWriter.close()
    } catch {
      // The original render or cancellation error is more useful to the caller.
    }
    throw error
  } finally {
    session?.dispose()
  }
}

/**
 * Worker desteklenmiyorsa veya başlatılamazsa toplu render ana iş parçacığında
 * eskisi gibi sürer; kullanıcı için tek fark arayüzün akıcılığıdır.
 */
async function startRenderSession(
  options: RenderPhotosArchiveOptions,
): Promise<BatchRenderSession | null> {
  if (!isWorkerRenderSupported() || options.photos.length === 0) {
    return null
  }

  try {
    const hasLogoLayer = options.recipe.layers.some((layer) => layer.role === 'logo')
    const logo =
      options.logoAsset && hasLogoLayer
        ? await prepareLogoBitmap(
            options.logoAsset,
            calculateLogoTargetWidth(options.photos, options.recipe),
          )
        : null

    return await createBatchRenderSession({
      recipe: options.recipe,
      variables: options.variables,
      logo,
    })
  } catch (error) {
    console.warn('Toplu render worker başlatılamadı; ana iş parçacığına dönüldü.', error)
    return null
  }
}

async function renderInSessionOrFallback(
  session: BatchRenderSession | null,
  photo: StudioPhoto,
  options: RenderPhotosArchiveOptions,
): Promise<Blob> {
  // Ölçü sınırı iki yolda da aynı sonucu verir; worker'a boşuna iş göndermemek
  // için burada bir kez kontrol edilir.
  assertRenderableSize(photo.width, photo.height)

  if (session) {
    try {
      return await session.render(photo)
    } catch (error) {
      if (options.signal?.aborted) {
        throw error
      }
      // Tek bir fotoğrafın worker'da başarısız olması toplu işlemi bitirmez.
      console.warn(
        `${photo.file.name}: worker render başarısız, ana iş parçacığında yeniden denendi.`,
        error,
      )
    }
  }

  return renderPhoto({
    photo,
    logoAsset: options.logoAsset,
    recipe: options.recipe,
    variables: options.variables,
  })
}

export function buildBatchArchiveFilename(date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return `b-photo-toplu-${day}.zip`
}

export function makeUniqueFilename(filename: string, usedFilenames: Set<string>): string {
  if (!usedFilenames.has(filename)) {
    usedFilenames.add(filename)
    return filename
  }

  const dotIndex = filename.lastIndexOf('.')
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : ''
  let sequence = 2
  let candidate = `${basename}-${sequence}${extension}`

  while (usedFilenames.has(candidate)) {
    sequence += 1
    candidate = `${basename}-${sequence}${extension}`
  }

  usedFilenames.add(candidate)
  return candidate
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Toplu işlem iptal edildi.', 'AbortError')
  }
}
