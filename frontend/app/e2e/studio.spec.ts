import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const RED_LOGO_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" rx="3" fill="#ff0000"/></svg>',
)

test('renders aligned layers and restores a saved local template without network writes', async ({
  page,
}) => {
  const writeRequests: string[] = []
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`)
    }
  })

  const renderWorkerUrls: string[] = []
  page.on('worker', (worker) => renderWorkerUrls.push(worker.url()))
  const renderWarnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('worker')) {
      renderWarnings.push(message.text())
    }
  })

  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'İlan fotoğraflarınızı tek seferde hazırlayın.' }),
  ).toBeVisible()
  await expect(page.locator('.page-title__accent')).toHaveText('tek seferde')
  await expect(page.getByText('Dosyalar', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Canlı Görünüm', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Reçete', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Fotoğraflar', exact: true }),
  ).toHaveClass(/eyebrow/)
  await expect(
    page.getByRole('heading', { name: 'Önizleme', exact: true }),
  ).toHaveClass(/eyebrow/)
  await expect(
    page.getByRole('heading', { name: 'Katmanlar ve Ayarlar', exact: true }),
  ).toHaveClass(/eyebrow/)
  const desktopHeaderHeights = await page
    .locator('.panel__header, .preview-toolbar')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  expect(desktopHeaderHeights.every((height) => height <= 57)).toBe(true)

  const photoBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas context unavailable')
    }
    context.fillStyle = '#303030'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'ornek-arac.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photoBase64!, 'base64'),
  })

  await expect(page.locator('.photo-card').getByText('ornek-arac.png', { exact: true })).toBeVisible()
  await expect(page.getByText('320 × 240', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.photo-card').getByText(/^Yatay ·/)).toBeVisible()
  const scrollbarStyles = await page.evaluate(() => {
    const webkitScrollbarStyle = getComputedStyle(
      document.documentElement,
      '::-webkit-scrollbar',
    )
    const webkitThumbStyle = getComputedStyle(
      document.documentElement,
      '::-webkit-scrollbar-thumb',
    )
    const webkitButtonStyle = getComputedStyle(
      document.documentElement,
      '::-webkit-scrollbar-button',
    )

    return {
      width: webkitScrollbarStyle.width,
      thumbBackground: webkitThumbStyle.backgroundImage,
      thumbRadius: webkitThumbStyle.borderRadius,
      buttonHeight: webkitButtonStyle.height,
    }
  })
  expect(scrollbarStyles.width).toBe('12px')
  expect(scrollbarStyles.thumbBackground).toContain('linear-gradient')
  expect(scrollbarStyles.thumbRadius).toBe('999px')
  expect(scrollbarStyles.buttonHeight).toBe('0px')
  const photoOverview = page
    .locator('.overview-section')
    .filter({ has: page.getByRole('heading', { name: 'Seçili Fotoğraf' }) })
  const templateSection = page
    .locator('.overview-section')
    .filter({ has: page.getByRole('heading', { name: 'Hazır Şablonlar' }) })
  await expect(photoOverview.locator('.section-disclosure')).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(photoOverview.locator('.metadata-list')).toBeHidden()
  await expect(templateSection.locator('.section-disclosure')).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(templateSection.getByLabel('Kayıtlı Şablon')).toBeHidden()

  const enhancementSection = page
    .locator('.photo-enhancement-section')
    .filter({ has: page.getByRole('heading', { name: 'Fotoğrafı İyileştir' }) })
  await expect(enhancementSection.locator('.section-disclosure')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(enhancementSection.getByText('Doğal', { exact: true })).toBeVisible()
  const brightnessSlider = enhancementSection.getByRole('slider', { name: 'Parlaklık' })
  await brightnessSlider.fill('35')
  await expect(brightnessSlider).toHaveValue('35')
  await expect(enhancementSection.getByText('Düzenlendi', { exact: true })).toBeVisible()
  await expect(page.locator('.photo-card').getByText('İyileştirildi', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seçili Görseli İndir' })).toBeEnabled()
  const originalPreviewButton = enhancementSection.getByRole('button', {
    name: 'Orijinali Göster',
  })
  await originalPreviewButton.click()
  await expect(
    enhancementSection.getByRole('button', { name: 'Düzenlenmişi Göster' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.preview-footer')).toContainText('düzenlenmemiş hâli')
  await enhancementSection.getByRole('button', { name: 'Düzenlenmişi Göster' }).click()
  await expect(originalPreviewButton).toHaveAttribute('aria-pressed', 'false')
  await enhancementSection.getByRole('button', { name: 'Sıfırla' }).click()
  await expect(brightnessSlider).toHaveValue('0')
  await expect(page.locator('.photo-card').getByText('İyileştirildi', { exact: true })).toHaveCount(0)
  await brightnessSlider.fill('35')

  await photoOverview.locator('.section-disclosure').click()
  await expect(photoOverview.locator('.metadata-list')).toBeVisible()
  await photoOverview.locator('.section-disclosure').click()
  await expect(photoOverview.locator('.metadata-list')).toBeHidden()
  await expect(page.locator('.canvas-shell canvas')).toBeVisible()
  const initialWorkspaceHeight = await page
    .locator('.studio-grid')
    .evaluate((element) => element.getBoundingClientRect().height)
  const zoomValue = page.getByTestId('preview-zoom-value')
  const wheelZoomToggle = page.getByRole('checkbox', { name: 'Tekerlekle zoom' })
  await expect(zoomValue).toHaveText('%100')
  await expect(wheelZoomToggle).not.toBeChecked()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('.canvas-shell canvas').hover()
  const initialPageScroll = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 240)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(
    initialPageScroll,
  )
  await expect(zoomValue).toHaveText('%100')
  await page.evaluate(() => window.scrollTo(0, 0))

  await page.locator('.wheel-zoom-toggle').click()
  await expect(wheelZoomToggle).toBeChecked()
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('ilan-matik:wheel-zoom-enabled')),
    )
    .toBe('true')
  await page.locator('.canvas-shell canvas').hover()
  await page.mouse.wheel(0, -100)
  await expect(zoomValue).toHaveText('%112')
  await page.getByRole('button', { name: 'Önizlemeyi ekrana sığdır' }).click()
  await page.locator('.wheel-zoom-toggle').click()
  await expect(wheelZoomToggle).not.toBeChecked()

  await page.locator('.canvas-shell canvas').hover()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect(zoomValue).toHaveText('%112')
  await page.getByRole('button', { name: 'Önizlemeyi ekrana sığdır' }).click()
  await page.getByRole('button', { name: 'Önizlemeyi yakınlaştır' }).click()
  await expect(zoomValue).toHaveText('%125')
  const zoomedWorkspaceHeight = await page
    .locator('.studio-grid')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(Math.abs(zoomedWorkspaceHeight - initialWorkspaceHeight)).toBeLessThan(1)
  await page.getByRole('button', { name: 'Önizlemeyi ekrana sığdır' }).click()
  await expect(zoomValue).toHaveText('%100')

  const previewPanel = page.locator('.preview-panel')
  const normalPreviewBox = await previewPanel.boundingBox()
  expect(normalPreviewBox).not.toBeNull()
  await page.getByRole('button', { name: 'Önizlemeyi büyük görünümde aç' }).click()
  await expect(previewPanel).toHaveClass(/preview-panel--expanded/)
  await expect(page.locator('body')).toHaveClass(/preview-expanded/)
  const expandedPreviewBox = await previewPanel.boundingBox()
  expect(expandedPreviewBox).not.toBeNull()
  expect(expandedPreviewBox!.width).toBeGreaterThan(normalPreviewBox!.width)
  expect(expandedPreviewBox!.height).toBeGreaterThan(normalPreviewBox!.height)
  await expect(
    page.getByRole('button', { name: 'Büyük önizleme görünümünü kapat' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(previewPanel).not.toHaveClass(/preview-panel--expanded/)
  await expect(page.locator('body')).not.toHaveClass(/preview-expanded/)
  await expect(zoomValue).toHaveText('%100')

  await page.locator('#logo-file-input').setInputFiles({
    name: 'galeri-logo.svg',
    mimeType: 'image/svg+xml',
    buffer: RED_LOGO_SVG,
  })

  await expect(page.getByText('galeri-logo.svg', { exact: true })).toBeVisible()
  await expect(page.getByText('Etkin', { exact: true })).toBeVisible()

  const logoSection = page
    .locator('.settings-section')
    .filter({ has: page.getByRole('heading', { name: 'Logo Katmanı' }) })
  await expect(logoSection.locator('.layer-disclosure')).toHaveAttribute('aria-expanded', 'true')
  const logoWidthSlider = logoSection.locator('.layer-controls input[type="range"]').first()
  await logoWidthSlider.fill('20')
  await expect(logoSection.locator('.layer-controls output').first()).toHaveText('20%')
  await page.getByRole('button', { name: 'Logoyu Sağ Üst konumuna taşı' }).click()

  await page.getByRole('button', { name: 'Metin Ekleyin' }).click()
  const textSection = page
    .locator('.settings-section')
    .filter({ has: page.getByRole('heading', { name: 'Metin Katmanı' }) })
  await expect(logoSection.locator('.layer-disclosure')).toHaveAttribute('aria-expanded', 'false')
  await expect(logoSection.getByLabel('Boyut')).toBeHidden()
  await expect(textSection.locator('.layer-disclosure')).toHaveAttribute('aria-expanded', 'true')
  await textSection.getByLabel('Gösterilecek Bilgi').selectOption('company')
  const companyNameInput = textSection.getByRole('textbox', { name: 'Firma Adı' })
  await companyNameInput.fill('TEST GALERİ')
  await expect(companyNameInput).toHaveValue('TEST GALERİ')
  await page.getByRole('button', { name: 'Metni Sol Alt konumuna taşı' }).click()

  await page.getByRole('button', { name: 'Filigran Ekleyin' }).click()
  const watermarkSection = page
    .locator('.settings-section')
    .filter({ has: page.getByRole('heading', { name: 'Filigran Katmanı' }) })
  await expect(textSection.locator('.layer-disclosure')).toHaveAttribute('aria-expanded', 'false')
  await expect(textSection.getByLabel('Metin Şablonu')).toBeHidden()
  await expect(watermarkSection.locator('.layer-disclosure')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await watermarkSection.getByLabel('Gösterilecek Bilgi').selectOption('custom')
  await watermarkSection.getByRole('textbox', { name: 'Filigran Metni' }).fill('FİLİGRAN')
  await watermarkSection.getByLabel('Yerleşim').selectOption('single')
  await watermarkSection.getByLabel('Renk').fill('#00ff00')
  await watermarkSection.locator('input[type="range"]').nth(1).fill('50')
  await page.getByRole('button', { name: 'Filigranı Alt Orta konumuna taşı' }).click()
  const expandedWorkspaceHeight = await page
    .locator('.studio-grid')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(Math.abs(expandedWorkspaceHeight - initialWorkspaceHeight)).toBeLessThan(1)
  const settingsOverflow = await page.locator('.settings-panel').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(settingsOverflow.scrollHeight).toBeGreaterThan(settingsOverflow.clientHeight)

  await page.getByLabel('Dosya Formatı').selectOption('png')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Seçili Görseli İndir' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('ornek-arac-b-photo.png')
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const output = await readFile(downloadPath!)
  expect(output.readUInt32BE(16)).toBe(320)
  expect(output.readUInt32BE(20)).toBe(240)
  const outputPixels = await page.evaluate(async (dataUrl) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context?.drawImage(image, 0, 0)
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data ?? []
    let red = 0
    let green = 0
    let light = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index] ?? 0
      const g = pixels[index + 1] ?? 0
      const b = pixels[index + 2] ?? 0
      if (r > 180 && g < 90 && b < 90) red += 1
      if (g > 40 && g > r * 1.5 && g > b * 1.5) green += 1
      if (r > 180 && g > 180 && b > 180) light += 1
    }
    const centerIndex = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4
    return {
      red,
      green,
      light,
      center: [
        pixels[centerIndex] ?? 0,
        pixels[centerIndex + 1] ?? 0,
        pixels[centerIndex + 2] ?? 0,
      ],
    }
  }, `data:image/png;base64,${output.toString('base64')}`)
  expect(outputPixels.red).toBeGreaterThan(100)
  expect(outputPixels.green).toBeGreaterThan(100)
  expect(outputPixels.light).toBeGreaterThan(20)
  expect(outputPixels.center.every((channel) => channel > 60)).toBe(true)

  await page.getByLabel('Dosya Formatı').selectOption('jpeg')
  const jpegDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Seçili Görseli İndir' }).click()
  const jpegDownload = await jpegDownloadPromise
  expect(jpegDownload.suggestedFilename()).toBe('ornek-arac-b-photo.jpg')
  const jpegPath = await jpegDownload.path()
  expect(jpegPath).not.toBeNull()
  const jpegOutput = await readFile(jpegPath!)
  expect(Array.from(jpegOutput.subarray(0, 2))).toEqual([0xff, 0xd8])

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'ikinci-arac.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photoBase64!, 'base64'),
  })
  await expect(page.locator('.photo-card').getByText('ikinci-arac.png', { exact: true })).toBeVisible()
  const firstPhotoCard = page.locator('.photo-card').filter({ hasText: 'ornek-arac.png' })
  const secondPhotoCard = page.locator('.photo-card').filter({ hasText: 'ikinci-arac.png' })
  await secondPhotoCard.locator('.photo-card__select').click()
  await expect(brightnessSlider).toHaveValue('0')
  await expect(secondPhotoCard.getByText('İyileştirildi', { exact: true })).toHaveCount(0)
  await firstPhotoCard.locator('.photo-card__select').click()
  await expect(brightnessSlider).toHaveValue('35')
  const selectedExportButton = page.getByRole('button', { name: 'Seçili Görseli İndir' })
  const batchExportButton = page.getByRole('button', { name: 'Tümünü ZIP İndir (2)' })
  const desktopExportPositions = await Promise.all([
    selectedExportButton.boundingBox(),
    batchExportButton.boundingBox(),
  ])
  expect(desktopExportPositions[0]).not.toBeNull()
  expect(desktopExportPositions[1]).not.toBeNull()
  expect(
    Math.abs(desktopExportPositions[0]!.y - desktopExportPositions[1]!.y),
  ).toBeLessThan(1)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobilePreviewToolbar = await page.locator('.preview-toolbar').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
  }))
  expect(mobilePreviewToolbar.scrollWidth).toBeLessThanOrEqual(
    mobilePreviewToolbar.clientWidth,
  )
  expect(mobilePreviewToolbar.height).toBeLessThanOrEqual(81)
  const mobileExportPositions = await Promise.all([
    selectedExportButton.boundingBox(),
    batchExportButton.boundingBox(),
  ])
  expect(mobileExportPositions[0]).not.toBeNull()
  expect(mobileExportPositions[1]).not.toBeNull()
  expect(mobileExportPositions[1]!.y).toBeGreaterThan(
    mobileExportPositions[0]!.y + mobileExportPositions[0]!.height,
  )
  await page.setViewportSize({ width: 1280, height: 720 })

  const archiveDownloadPromise = page.waitForEvent('download')
  await batchExportButton.click()
  const archiveDownload = await archiveDownloadPromise
  expect(archiveDownload.suggestedFilename()).toMatch(/^b-photo-toplu-\d{4}-\d{2}-\d{2}\.zip$/)
  const archivePath = await archiveDownload.path()
  expect(archivePath).not.toBeNull()
  const archiveOutput = await readFile(archivePath!)
  expect(Array.from(archiveOutput.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  expect(archiveOutput.includes(Buffer.from('ornek-arac-b-photo.jpg'))).toBe(true)
  expect(archiveOutput.includes(Buffer.from('ikinci-arac-b-photo.jpg'))).toBe(true)

  // Toplu render gerçekten worker'da çalışmalı; ana iş parçacığına düşülürse
  // uyarı basılır ve bu test onu yakalar.
  expect(renderWorkerUrls.some((url) => url.includes('batchRenderWorker'))).toBe(true)
  expect(renderWarnings).toEqual([])

  await templateSection.locator('.section-disclosure').click()
  await templateSection.getByLabel('Şablon Adı').fill('Galeri Standart')
  await templateSection.getByRole('button', { name: 'Şablonu Kaydet' }).click()
  await expect(templateSection.getByText('Şablon kaydedildi.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Hazır şablonları göster' }).click()
  await page.getByLabel('Kayıtlı Şablon').selectOption({ label: 'Galeri Standart' })
  await expect(page.getByText('Şablon çalışma alanına uygulandı.')).toBeVisible()
  await expect(page.getByText('galeri-logo.svg', { exact: true })).toBeVisible()
  const restoredTextSection = page
    .locator('.settings-section')
    .filter({ has: page.getByRole('heading', { name: 'Metin Katmanı' }) })
  await restoredTextSection.locator('.layer-disclosure').click()
  await expect(
    restoredTextSection.getByRole('textbox', { name: 'Firma Adı' }),
  ).toHaveValue('TEST GALERİ')

  await page.getByRole('button', { name: 'Çoğalt' }).click()
  await expect(page.getByText('Şablon kopyası oluşturuldu.')).toBeVisible()
  await expect(page.getByLabel('Şablon Adı')).toHaveValue('Galeri Standart (kopya)')
  await expect(page.getByLabel('Kayıtlı Şablon').locator('option:checked')).toHaveText(
    'Galeri Standart (kopya)',
  )
  await expect(page.getByText('galeri-logo.svg', { exact: true })).toBeVisible()

  // Kopya bağımsızdır: kaynağı silmek kopyayı etkilemez.
  await page.getByLabel('Kayıtlı Şablon').selectOption({ label: 'Galeri Standart' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Sil' }).click()
  await expect(page.getByText('Şablon silindi.')).toBeVisible()
  await page.getByLabel('Kayıtlı Şablon').selectOption({ label: 'Galeri Standart (kopya)' })
  await expect(page.getByText('Şablon çalışma alanına uygulandı.')).toBeVisible()
  await expect(page.getByText('galeri-logo.svg', { exact: true })).toBeVisible()

  expect(writeRequests).toEqual([])
})

test('auto-dismisses import warnings outside hover and supports manual close', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')

  const unsupportedFile = {
    name: 'desteklenmeyen.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  }
  await page.locator('input[type="file"]').first().setInputFiles(unsupportedFile)

  const warning = page.getByRole('alert')
  await expect(warning).toContainText('Desteklenmeyen dosya türü')
  await page.clock.fastForward(9_000)
  await warning.hover()
  await page.clock.fastForward(5_000)
  await expect(warning).toBeVisible()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(1_100)
  await expect(warning).toBeHidden()

  await page.locator('input[type="file"]').first().setInputFiles(unsupportedFile)
  await expect(warning).toBeVisible()
  await page.getByRole('button', { name: 'Dosya uyarısını kapat' }).click()
  await expect(warning).toBeHidden()
})
