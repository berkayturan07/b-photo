<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { hasPhotoAdjustments } from '@/core/rendering/photoAdjustments'
import { useStudioStore } from '@/stores/studio'
import { formatBytes, orientationLabel } from '@/utils/image'

const studio = useStudioStore()
</script>

<template>
  <aside class="panel photo-panel" aria-label="Fotoğraf listesi">
    <div class="panel__header">
      <h2 class="eyebrow">Fotoğraflar</h2>
      <span class="count-badge">{{ studio.photos.length }}</span>
    </div>

    <div v-if="studio.isImporting" class="panel-state">
      Fotoğraflar okunuyor…
    </div>

    <ul v-else-if="studio.photos.length" class="photo-list">
      <li
        v-for="(photo, index) in studio.photos"
        :key="photo.id"
        class="photo-card"
        :class="{ 'photo-card--active': studio.selectedPhotoId === photo.id }"
      >
        <button
          class="photo-card__select"
          type="button"
          @click="studio.selectPhoto(photo.id)"
        >
          <span class="photo-card__number">{{ String(index + 1).padStart(2, '0') }}</span>
          <img :src="photo.objectUrl" :alt="`${photo.file.name} küçük önizlemesi`" />
          <span class="photo-card__details">
            <strong :title="photo.file.name">{{ photo.file.name }}</strong>
            <span>{{ photo.width }} × {{ photo.height }}</span>
            <span>{{ orientationLabel(photo.orientation) }} · {{ formatBytes(photo.file.size) }}</span>
            <span v-if="hasPhotoAdjustments(photo.adjustments)" class="photo-adjusted-badge">
              İyileştirildi
            </span>
          </span>
        </button>
        <button
          class="icon-button icon-button--danger"
          type="button"
          :aria-label="`${photo.file.name} fotoğrafını kaldır`"
          @click="studio.removePhoto(photo.id)"
        >
          <AppIcon name="trash" :size="17" />
        </button>
      </li>
    </ul>

    <div v-else class="panel-state panel-state--empty">
      <AppIcon name="image" :size="28" />
      <strong>Henüz fotoğraf yok</strong>
      <span>Yukarıdaki alandan fotoğraf ekleyin.</span>
    </div>

    <div v-if="studio.photos.length" class="panel__footer">
      <button class="text-button text-button--danger" type="button" @click="studio.clearPhotos">
        Tümünü Temizle
      </button>
    </div>
  </aside>
</template>
