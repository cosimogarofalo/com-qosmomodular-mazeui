<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  originalUrl: string
  renderedUrl: string
}>()

const original = ref<HTMLAudioElement | null>(null)
const rendered = ref<HTMLAudioElement | null>(null)
const activeSource = ref<'original' | 'rendered' | null>(null)

function selectSource(target: 'original' | 'rendered') {
  activeSource.value = target
  const other = target === 'original' ? rendered.value : original.value
  if (other && !other.paused) other.pause()
}

async function play(target: 'original' | 'rendered') {
  const selected = target === 'original' ? original.value : rendered.value
  const other = target === 'original' ? rendered.value : original.value
  if (!selected) return

  const synchronizedTime = other && !other.paused ? other.currentTime : null
  selectSource(target)
  if (synchronizedTime !== null) selected.currentTime = synchronizedTime
  try {
    await selected.play()
  } catch {
    // Native audio controls remain available when autoplay policy blocks play().
  }
}

function pauseBoth() {
  original.value?.pause()
  rendered.value?.pause()
  activeSource.value = null
}

function clearSource(target: 'original' | 'rendered') {
  if (activeSource.value === target) activeSource.value = null
}
</script>

<template>
  <section class="audio-comparison" aria-label="Original and rendered audio comparison">
    <div class="ab-actions">
      <button
        class="button"
        :class="activeSource === 'original' ? 'button-primary' : 'button-ghost'"
        type="button"
        @click="play('original')"
      >
        A · Original
      </button>
      <button
        class="button"
        :class="activeSource === 'rendered' ? 'button-primary' : 'button-ghost'"
        type="button"
        @click="play('rendered')"
      >
        B · Rendered
      </button>
      <button class="button button-ghost" type="button" @click="pauseBoth">
        Pause both
      </button>
      <span>Switching A/B keeps the active playhead when possible.</span>
    </div>
    <div class="audio-players">
      <label>
        <span>Original</span>
        <audio
          ref="original"
          controls
          preload="metadata"
          :src="originalUrl"
          @play="selectSource('original')"
          @ended="clearSource('original')"
        />
      </label>
      <label>
        <span>Rendered</span>
        <audio
          ref="rendered"
          controls
          preload="metadata"
          :src="renderedUrl"
          @play="selectSource('rendered')"
          @ended="clearSource('rendered')"
        />
      </label>
    </div>
  </section>
</template>
