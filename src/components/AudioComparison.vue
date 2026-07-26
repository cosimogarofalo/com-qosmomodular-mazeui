<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  originalUrl: string
  renderedUrl: string
}>()

type AudioSource = 'original' | 'rendered'

interface AnalysisNode {
  analyser: AnalyserNode
  source: MediaElementAudioSourceNode
  timeData: Uint8Array<ArrayBuffer>
  frequencyData: Uint8Array<ArrayBuffer>
}

const original = ref<HTMLAudioElement | null>(null)
const rendered = ref<HTMLAudioElement | null>(null)
const originalAmplitude = ref<HTMLCanvasElement | null>(null)
const originalSpectrum = ref<HTMLCanvasElement | null>(null)
const renderedAmplitude = ref<HTMLCanvasElement | null>(null)
const renderedSpectrum = ref<HTMLCanvasElement | null>(null)
const activeSource = ref<AudioSource | null>(null)
const loopPlayback = ref(false)
const analysisError = ref<string | null>(null)

let audioContext: AudioContext | null = null
let originalAnalysis: AnalysisNode | null = null
let renderedAnalysis: AnalysisNode | null = null
let animationFrame: number | null = null

function audioElement(target: AudioSource): HTMLAudioElement | null {
  return target === 'original' ? original.value : rendered.value
}

function createAnalysisNode(element: HTMLAudioElement): AnalysisNode {
  if (!audioContext) {
    throw new Error('Audio context is not initialized')
  }
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  analyser.minDecibels = -90
  analyser.maxDecibels = -10
  analyser.smoothingTimeConstant = 0.78

  const source = audioContext.createMediaElementSource(element)
  source.connect(analyser)
  analyser.connect(audioContext.destination)

  return {
    analyser,
    source,
    timeData: new Uint8Array(analyser.fftSize),
    frequencyData: new Uint8Array(analyser.frequencyBinCount),
  }
}

function canvasContext(
  canvas: HTMLCanvasElement,
): { context: CanvasRenderingContext2D; width: number; height: number } | null {
  const context = canvas.getContext('2d')
  if (!context) return null

  const bounds = canvas.getBoundingClientRect()
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const scale = Math.max(1, window.devicePixelRatio || 1)
  const pixelWidth = Math.round(width * scale)
  const pixelHeight = Math.round(height * scale)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
  return { context, width, height }
}

function drawAmplitude(node: AnalysisNode, canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  const drawing = canvasContext(canvas)
  if (!drawing) return

  node.analyser.getByteTimeDomainData(node.timeData)
  const { context, width, height } = drawing
  const center = height / 2

  context.beginPath()
  context.strokeStyle = '#63ff9b'
  context.lineWidth = 1.35
  context.shadowColor = '#35f27d'
  context.shadowBlur = 5
  for (let index = 0; index < node.timeData.length; index += 1) {
    const x = (index / (node.timeData.length - 1)) * width
    const normalized = (node.timeData[index]! - 128) / 128
    const y = center - normalized * center * 0.84
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.stroke()
}

function drawSpectrum(node: AnalysisNode, canvas: HTMLCanvasElement | null) {
  if (!canvas || !audioContext) return
  const drawing = canvasContext(canvas)
  if (!drawing) return

  node.analyser.getByteFrequencyData(node.frequencyData)
  const { context, width, height } = drawing
  const barCount = Math.max(32, Math.floor(width / 5))
  const nyquist = audioContext.sampleRate / 2
  const minimumFrequency = 20
  const binFrequency = audioContext.sampleRate / node.analyser.fftSize
  const gap = 1
  const barWidth = width / barCount
  const gradient = context.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, '#1a8d52')
  gradient.addColorStop(0.62, '#45eb86')
  gradient.addColorStop(1, '#b6ffd0')
  context.fillStyle = gradient
  context.shadowColor = '#35f27d'
  context.shadowBlur = 3

  for (let bar = 0; bar < barCount; bar += 1) {
    const lowRatio = bar / barCount
    const highRatio = (bar + 1) / barCount
    const lowFrequency =
      minimumFrequency * Math.pow(nyquist / minimumFrequency, lowRatio)
    const highFrequency =
      minimumFrequency * Math.pow(nyquist / minimumFrequency, highRatio)
    const lowBin = Math.max(0, Math.floor(lowFrequency / binFrequency))
    const highBin = Math.min(
      node.frequencyData.length - 1,
      Math.max(lowBin, Math.ceil(highFrequency / binFrequency)),
    )
    let magnitude = 0
    for (let bin = lowBin; bin <= highBin; bin += 1) {
      magnitude = Math.max(magnitude, node.frequencyData[bin]!)
    }
    const normalized = magnitude / 255
    const barHeight = Math.max(1, normalized * height)
    context.fillRect(
      bar * barWidth,
      height - barHeight,
      Math.max(1, barWidth - gap),
      barHeight,
    )
  }
}

function drawVisualizers() {
  if (originalAnalysis) {
    drawAmplitude(originalAnalysis, originalAmplitude.value)
    drawSpectrum(originalAnalysis, originalSpectrum.value)
  }
  if (renderedAnalysis) {
    drawAmplitude(renderedAnalysis, renderedAmplitude.value)
    drawSpectrum(renderedAnalysis, renderedSpectrum.value)
  }
  animationFrame = window.requestAnimationFrame(drawVisualizers)
}

async function ensureAnalysis() {
  if (analysisError.value) return
  try {
    if (!window.AudioContext) {
      throw new Error('Web Audio API is not supported by this browser')
    }
    if (!audioContext) audioContext = new window.AudioContext()
    if (!originalAnalysis && original.value) {
      originalAnalysis = createAnalysisNode(original.value)
    }
    if (!renderedAnalysis && rendered.value) {
      renderedAnalysis = createAnalysisNode(rendered.value)
    }
    if (audioContext.state === 'suspended') await audioContext.resume()
    if (animationFrame === null) drawVisualizers()
  } catch {
    analysisError.value =
      'Live amplitude and spectrum analysis is unavailable; audio playback remains active.'
  }
}

function selectSource(target: AudioSource) {
  activeSource.value = target
  const other = target === 'original' ? rendered.value : original.value
  if (other && !other.paused) other.pause()
}

async function play(target: AudioSource) {
  const selected = audioElement(target)
  const other = target === 'original' ? rendered.value : original.value
  if (!selected) return

  const synchronizedTime = other && !other.paused ? other.currentTime : null
  selectSource(target)
  if (synchronizedTime !== null) selected.currentTime = synchronizedTime
  await ensureAnalysis()
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

function handleNativePlay(target: AudioSource) {
  selectSource(target)
  void ensureAnalysis()
}

function clearSource(target: AudioSource) {
  if (activeSource.value === target) activeSource.value = null
}

onBeforeUnmount(() => {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  originalAnalysis?.source.disconnect()
  originalAnalysis?.analyser.disconnect()
  renderedAnalysis?.source.disconnect()
  renderedAnalysis?.analyser.disconnect()
  originalAnalysis = null
  renderedAnalysis = null
  if (audioContext) void audioContext.close()
  audioContext = null
})
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
      <button
        class="button loop-playback-button"
        :class="loopPlayback ? 'button-primary' : 'button-ghost'"
        type="button"
        :aria-pressed="loopPlayback"
        title="Repeat the active audio file continuously"
        @click="loopPlayback = !loopPlayback"
      >
        Loop
      </button>
      <span>Switching A/B keeps the active playhead when possible.</span>
    </div>
    <div class="audio-players">
      <section
        class="audio-source-card"
        :class="{ active: activeSource === 'original' }"
        aria-label="Original audio analysis and playback"
      >
        <header class="audio-source-title">
          <span>A Â· Original</span>
          <span>{{ activeSource === 'original' ? 'Playing' : 'Ready' }}</span>
        </header>
        <div class="audio-visualizer-stack">
          <label>
            <span>Amplitude</span>
            <canvas
              ref="originalAmplitude"
              aria-label="Original audio amplitude waveform"
            />
          </label>
          <label>
            <span>Spectrum</span>
            <canvas
              ref="originalSpectrum"
              aria-label="Original audio frequency spectrum"
            />
          </label>
        </div>
        <audio
          ref="original"
          controls
          :loop="loopPlayback"
          preload="metadata"
          :src="originalUrl"
          @play="handleNativePlay('original')"
          @pause="clearSource('original')"
          @ended="clearSource('original')"
        />
      </section>
      <section
        class="audio-source-card"
        :class="{ active: activeSource === 'rendered' }"
        aria-label="Rendered audio analysis and playback"
      >
        <header class="audio-source-title">
          <span>B Â· Rendered</span>
          <span>{{ activeSource === 'rendered' ? 'Playing' : 'Ready' }}</span>
        </header>
        <div class="audio-visualizer-stack">
          <label>
            <span>Amplitude</span>
            <canvas
              ref="renderedAmplitude"
              aria-label="Rendered audio amplitude waveform"
            />
          </label>
          <label>
            <span>Spectrum</span>
            <canvas
              ref="renderedSpectrum"
              aria-label="Rendered audio frequency spectrum"
            />
          </label>
        </div>
        <audio
          ref="rendered"
          controls
          :loop="loopPlayback"
          preload="metadata"
          :src="renderedUrl"
          @play="handleNativePlay('rendered')"
          @pause="clearSource('rendered')"
          @ended="clearSource('rendered')"
        />
      </section>
    </div>
    <small v-if="analysisError" class="analysis-error">{{ analysisError }}</small>
  </section>
</template>
