<script setup lang="ts">
import { computed } from 'vue'
import {
  AUDIO_METER_FLOOR_DB,
  type AudioMeterLevels,
} from '../services/audioMeter'

const props = defineProps<{
  label: string
  levels: AudioMeterLevels[]
  position: 'leading' | 'trailing'
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

const channelLabels = computed(() =>
  props.levels.length === 2 ? ['L', 'R'] : ['M'],
)

function rmsStyle(level: AudioMeterLevels) {
  return { transform: `scaleY(${levelRatio(level.rmsDb)})` }
}

function peakStyle(level: AudioMeterLevels) {
  return {
    bottom: `calc(${levelRatio(level.peakDb) * 100}% - 1px)`,
  }
}

function meterText(level: AudioMeterLevels): string {
  return `RMS ${formatDb(level.rmsDb)} dBFS, peak ${formatDb(level.peakDb)} dBFS`
}
</script>

<template>
  <aside class="audio-level-meter" :aria-label="`${label} RMS and peak meter`">
    <header>
      <span>Level</span>
      <small>{{ levels.length === 2 ? 'Stereo' : 'Mono' }} · dBFS</small>
    </header>
    <div
      class="audio-meter-body"
      :class="{ 'is-stereo': levels.length === 2 }"
    >
      <div v-if="levels.length === 1" class="audio-meter-scale" aria-hidden="true">
        <span>0</span>
        <span>-12</span>
        <span>-24</span>
        <span>-48</span>
        <span>-60</span>
      </div>
      <template
        v-for="(level, index) in levels"
        :key="channelLabels[index]"
      >
        <div
          class="audio-meter-channel"
          :class="{
            'toward-scale-from-left':
              levels.length === 2 &&
              position === 'trailing' &&
              channelLabels[index] === 'L',
            'toward-scale-from-right':
              levels.length === 2 &&
              position === 'leading' &&
              channelLabels[index] === 'R',
          }"
        >
          <span class="audio-meter-channel-label" aria-hidden="true">
            {{ channelLabels[index] }}
          </span>
          <div
            class="audio-meter-track"
            role="meter"
            aria-valuemin="-60"
            aria-valuemax="0"
            :aria-label="`${label} ${channelLabels[index]} channel`"
            :aria-valuenow="clampDb(level.rmsDb).toFixed(1)"
            :aria-valuetext="meterText(level)"
          >
            <span class="audio-meter-rms" :style="rmsStyle(level)" />
            <span class="audio-meter-peak" :style="peakStyle(level)" />
          </div>
        </div>
        <div
          v-if="levels.length === 2 && index === 0"
          class="audio-meter-scale"
          aria-hidden="true"
        >
          <span>0</span>
          <span>-12</span>
          <span>-24</span>
          <span>-48</span>
          <span>-60</span>
        </div>
      </template>
    </div>
    <div class="audio-meter-values">
      <div
        v-for="(level, index) in levels"
        :key="`value-${channelLabels[index]}`"
        class="audio-meter-channel-values"
      >
        <strong>{{ channelLabels[index] }}</strong>
        <span>R {{ formatDb(level.rmsDb) }}</span>
        <span>P {{ formatDb(level.peakDb) }}</span>
      </div>
    </div>
  </aside>
</template>
