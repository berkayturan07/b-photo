<script setup lang="ts">
import { ref } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function openFilePicker(): void {
  fileInput.value?.click()
}

function openFolderPicker(): void {
  folderInput.value?.click()
}

async function handleInput(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await studio.addFiles(input.files)
  }
  input.value = ''
}

async function handleDrop(event: DragEvent): Promise<void> {
  isDragging.value = false
  if (event.dataTransfer?.files.length) {
    await studio.addFiles(event.dataTransfer.files)
  }
}
</script>

<template>
  <section
    class="upload-zone"
    :class="{ 'upload-zone--dragging': isDragging }"
    aria-labelledby="upload-title"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <div class="upload-zone__icon">
      <AppIcon name="upload" :size="26" />
    </div>
    <div class="upload-zone__copy">
      <h2 id="upload-title">Fotoğraflarınızı Ekleyin</h2>
      <p>JPG, PNG veya WebP dosyalarını sürükleyin ya da cihazınızdan seçin.</p>
    </div>
    <div class="upload-zone__actions">
      <button class="button button--primary" type="button" @click="openFilePicker">
        <AppIcon name="image" />
        Fotoğraf Seç
      </button>
      <button class="button button--secondary" type="button" @click="openFolderPicker">
        <AppIcon name="folder" />
        Klasör Seç
      </button>
    </div>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
      multiple
      @change="handleInput"
    />
    <input
      ref="folderInput"
      class="visually-hidden"
      type="file"
      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
      multiple
      webkitdirectory
      @change="handleInput"
    />
  </section>
</template>

