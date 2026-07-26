<script setup lang="ts">
import { computed, ref } from 'vue'

import type { AudioInput, OutputFormat } from '@/types/maze'

const props = defineProps<{
  inputs: AudioInput[]
  selectedInputId: string
  inputsLoading: boolean
  uploading: boolean
  audioError: string | null
  chainName: string
  outputBaseName: string
  outputFormat: OutputFormat
  canRender: boolean
  renderReason: string
  rendering: boolean
}>()

const emit = defineEmits<{
  selectInput: [inputId: string]
  upload: [file: File]
  updateChainName: [name: string]
  updateOutputName: [name: string]
  updateOutputFormat: [format: OutputFormat]
  render: []
}>()

const filePicker = ref<HTMLInputElement | null>(null)
const selectedInput = computed(() =>
  props.inputs.find((input) => input.id === props.selectedInputId),
)

function chooseFile() {
  filePicker.value?.click()
}

function uploadSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', file)
  input.value = ''
}

function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'unknown duration'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
</script>

<template>
  <footer class="transport-bar">
    <div class="transport-field input-picker">
      <span class="transport-label">Managed input</span>
      <div class="input-picker-row">
        <select
          :value="selectedInputId"
          :disabled="inputsLoading || uploading"
          @change="$emit('selectInput', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            {{ inputsLoading ? 'Loading inputs…' : 'Select an input…' }}
          </option>
          <option v-for="input in inputs" :key="input.id" :value="input.id">
            {{ input.fileName }}
          </option>
        </select>
        <button
          class="button button-ghost upload-button"
          type="button"
          :disabled="uploading"
          @click="chooseFile"
        >
          {{ uploading ? 'Uploading…' : 'Choose file…' }}
        </button>
        <input
          ref="filePicker"
          class="visually-hidden"
          type="file"
          accept=".wav,.wave,.aif,.aiff,audio/wav,audio/aiff"
          @change="uploadSelected"
        />
      </div>
      <small v-if="selectedInput" class="audio-summary">
        {{ selectedInput.format }} ·
        {{ selectedInput.sampleRate.toLocaleString() }} Hz ·
        {{ selectedInput.channels === 1 ? 'Mono' : 'Stereo' }} ·
        {{ duration(selectedInput.durationSeconds) }}
      </small>
      <small v-if="audioError" class="inline-error">{{ audioError }}</small>
    </div>

    <label class="transport-field">
      <span class="transport-label">Chain name</span>
      <input
        :value="chainName"
        type="text"
        @input="$emit('updateChainName', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="transport-field">
      <span class="transport-label">Output</span>
      <div class="output-picker-row">
        <input
          :value="outputBaseName"
          type="text"
          placeholder="maze-render"
          aria-label="Safe output base name"
          @input="$emit('updateOutputName', ($event.target as HTMLInputElement).value)"
        />
        <select
          :value="outputFormat"
          aria-label="Output format"
          @change="
            $emit(
              'updateOutputFormat',
              ($event.target as HTMLSelectElement).value as OutputFormat,
            )
          "
        >
          <option value="WAV">WAV</option>
          <option value="AIFF">AIFF</option>
        </select>
      </div>
    </div>

    <div class="render-action">
      <button
        class="button render-button"
        type="button"
        :disabled="!canRender || rendering"
        :title="renderReason"
        @click="$emit('render')"
      >
        {{ rendering ? 'Submitting…' : '▶ Render chain' }}
      </button>
      <small :class="{ ready: canRender }">{{ renderReason }}</small>
    </div>
  </footer>
</template>
