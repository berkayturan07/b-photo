<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import PhotoUploader from '@/components/uploader/PhotoUploader.vue'
import CanvasPreview from '@/components/studio/CanvasPreview.vue'
import PhotoList from '@/components/studio/PhotoList.vue'
import SettingsPanel from '@/components/studio/SettingsPanel.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
// Uygulama GitHub Pages'te alt dizinde yayınlanabildiği için marka bağlantısı
// sabit '/' yerine derleme tabanını kullanır.
const baseUrl = import.meta.env.BASE_URL
const importErrorDismissDelay = 10_000
let importErrorTimer: number | null = null
let importErrorTimerStartedAt = 0
let importErrorTimeRemaining = importErrorDismissDelay

function clearImportErrorTimer(): void {
  if (importErrorTimer !== null) {
    window.clearTimeout(importErrorTimer)
    importErrorTimer = null
  }
}

function scheduleImportErrorDismiss(delay = importErrorTimeRemaining): void {
  clearImportErrorTimer()
  if (!studio.importErrors.length) {
    return
  }

  importErrorTimeRemaining = delay
  importErrorTimerStartedAt = performance.now()
  importErrorTimer = window.setTimeout(() => {
    studio.dismissImportErrors()
  }, delay)
}

function pauseImportErrorDismiss(): void {
  if (importErrorTimer === null) {
    return
  }

  importErrorTimeRemaining = Math.max(
    importErrorTimeRemaining - (performance.now() - importErrorTimerStartedAt),
    0,
  )
  clearImportErrorTimer()
}

function resumeImportErrorDismiss(): void {
  if (studio.importErrors.length) {
    scheduleImportErrorDismiss(importErrorTimeRemaining)
  }
}

function dismissImportErrors(): void {
  clearImportErrorTimer()
  studio.dismissImportErrors()
}

watch(
  () => studio.importErrors.join('\u0000'),
  (errors) => {
    clearImportErrorTimer()
    if (errors) {
      importErrorTimeRemaining = importErrorDismissDelay
      scheduleImportErrorDismiss()
    }
  },
)

onBeforeUnmount(() => {
  clearImportErrorTimer()
  studio.dispose()
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" :href="baseUrl" aria-label="B Photo ana sayfa">
        <span class="brand__mark">BP</span>
        <span>
          <strong>B Photo</strong>
          <small>Görsel Hazırlama Stüdyosu</small>
        </span>
      </a>
    </header>

    <div class="page-intro">
      <div>
        <h1 class="page-title">
          İlan fotoğraflarınızı
          <span class="page-title__accent">tek seferde</span> hazırlayın.
        </h1>
      </div>
      <div class="privacy-card">
        <AppIcon name="shield" :size="22" />
        <span>
          <strong>Gizlilik Öncelikli</strong>
          <small>Fotoğraflar tarayıcınızdan ayrılmaz.</small>
        </span>
      </div>
    </div>

    <PhotoUploader />

    <div
      v-if="studio.importErrors.length"
      class="error-summary"
      role="alert"
      @mouseenter="pauseImportErrorDismiss"
      @mouseleave="resumeImportErrorDismiss"
    >
      <button
        class="error-summary__close"
        type="button"
        aria-label="Dosya uyarısını kapat"
        @click="dismissImportErrors"
      >
        ×
      </button>
      <strong>Bazı dosyalar eklenemedi:</strong>
      <ul>
        <li v-for="error in studio.importErrors" :key="error">{{ error }}</li>
      </ul>
    </div>

    <div class="studio-grid">
      <PhotoList />
      <CanvasPreview />
      <SettingsPanel />
    </div>
  </div>
</template>
