<script setup lang="ts">
import { computed } from 'vue'
import { AUDIO_METER_FLOOR_DB } from '../services/audioMeter'

const props = defineProps<{
  label: string
  rmsDb: number
  peakDb: number
}>()

function clampDb(value: number): number {
  return Math.max(AUDIO_METER_FLOOR_DB, Math.min(0, value))
}

function levelRatio(value: number): number {
  return (clampDb(value) - AUDIO_METER_FLOOR_DB) / -AUDIO_METER_FLOOR_DB
}

function formatDb(value: number): string {
  return clampDb(value).toFixed(1)
}

const rmsStyle = computed(() => ({
  transform: `scaleY(${levelRatio(props.rmsDb)})`,
}))

const peakStyle = computed(() => ({
  bottom: `calc(${levelRatio(props.peakDb) * 100}% - 1px)`,
}))

const meterText = computed(
  () =>
    `RMS ${formatDb(props.rmsDb)} dBFS, peak ${formatDb(props.peakDb)} dBFS`,
)
</script>

<template>
  <aside class="audio-level-meter" :aria-label="`${label} RMS and peak meter`">
    <header>
      <span>Level</span>
      <small>dBFS</small>
    </header>
    <div class="audio-meter-body">
      <div class="audio-meter-scale" aria-hidden="true">
        <span>0</span>
        <span>-12</span>
        <span>-24</span>
        <span>-48</span>
        <span>-60</span>
      </div>
      <div
        class="audio-meter-track"
        role="meter"
        aria-valuemin="-60"
        aria-valuemax="0"
        :aria-valuenow="clampDb(rmsDb).toFixed(1)"
        :aria-valuetext="meterText"
      >
        <span class="audio-meter-rms" :style="rmsStyle" />
        <span class="audio-meter-peak" :style="peakStyle" />
      </div>
    </div>
    <div class="audio-meter-values">
      <span>RMS <strong>{{ formatDb(rmsDb) }}</strong></span>
      <span>Peak <strong>{{ formatDb(peakDb) }}</strong></span>
    </div>
  </aside>
</template>
