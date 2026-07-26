<script setup lang="ts">
import { computed } from 'vue'

interface LimiterSettings {
  variant: 'SIMPLE' | 'BUS'
  inputGain: number
  ceiling: number
  threshold?: number
  dryWet?: number
  mode?: string
  softClip?: boolean
  softClipDrive?: number
  transientMode?: string
}

const props = defineProps<{
  settings: LimiterSettings
}>()

const inputMinimum = -60
const inputMaximum = 0
const outputMinimum = -60
const outputMaximum = 0
const plot = {
  left: 28,
  right: 248,
  top: 10,
  bottom: 88,
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

const normalized = computed(() => ({
  variant: props.settings.variant,
  inputGain: clamp(Number(props.settings.inputGain) || 0, -24, 31),
  ceiling: clamp(Number(props.settings.ceiling) || 0, -24, 0),
  threshold: clamp(Number(props.settings.threshold) || 0, -60, 0),
  dryWet: clamp(Number(props.settings.dryWet) || 0, 0, 100),
  mode: String(props.settings.mode || 'VCA').toUpperCase(),
  softClip: Boolean(props.settings.softClip),
  softClipDrive: clamp(Number(props.settings.softClipDrive) || 0, 0, 12),
  transientMode: String(props.settings.transientMode || 'CLEAN').toUpperCase(),
}))

function dbToAmplitude(db: number): number {
  return 10 ** (db / 20)
}

function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(1e-9, Math.abs(amplitude)))
}

function softClip(sample: number, ceiling: number, knee: number): number {
  const magnitude = Math.abs(sample)
  const kneeStart = ceiling * (1 - knee)
  if (magnitude <= kneeStart) return sample

  const range = ceiling - kneeStart
  const normalizedMagnitude = (magnitude - kneeStart) / range
  const shaped =
    kneeStart +
    (range * Math.tanh(normalizedMagnitude * 2)) / Math.tanh(2)
  return Math.sign(sample) * Math.min(shaped, ceiling)
}

function diodeClip(sample: number, ceiling: number): number {
  const drive = sample >= 0 ? 2.4 : 1.8
  const shaped =
    (ceiling * Math.tanh((Math.abs(sample) / ceiling) * drive)) /
    Math.tanh(drive)
  return Math.sign(sample) * Math.min(shaped, ceiling)
}

function simpleOutput(inputDb: number): number {
  const settings = normalized.value
  const gainedDb = inputDb + settings.inputGain
  const gained = dbToAmplitude(gainedDb)
  const compressedDb =
    gainedDb <= settings.threshold
      ? gainedDb
      : settings.threshold + (gainedDb - settings.threshold) / 20
  const ceiling = dbToAmplitude(settings.ceiling)
  const limited = Math.min(dbToAmplitude(compressedDb), ceiling)
  const shaped =
    settings.mode === 'DIODE'
      ? diodeClip(limited, ceiling)
      : softClip(limited, ceiling, settings.mode === 'OPTICAL' ? 0.35 : 0.2)
  const wet = settings.dryWet / 100
  const mixed = gained * (1 - wet) + shaped * wet
  return amplitudeToDb(Math.min(mixed, ceiling))
}

function busOutput(inputDb: number): number {
  const settings = normalized.value
  let sample = dbToAmplitude(inputDb + settings.inputGain)
  if (settings.softClip) {
    const knee =
      settings.transientMode === 'PUNCHY'
        ? 0.12
        : settings.transientMode === 'SMOOTH'
          ? 0.35
          : 0.2
    sample = softClip(
      sample * dbToAmplitude(settings.softClipDrive),
      1,
      knee,
    )
  }
  return amplitudeToDb(
    Math.min(sample, dbToAmplitude(settings.ceiling)),
  )
}

function outputFor(inputDb: number): number {
  return normalized.value.variant === 'BUS'
    ? busOutput(inputDb)
    : simpleOutput(inputDb)
}

function xFor(inputDb: number): number {
  return (
    plot.left +
    ((inputDb - inputMinimum) / (inputMaximum - inputMinimum)) *
      (plot.right - plot.left)
  )
}

function yFor(outputDb: number): number {
  const clamped = clamp(outputDb, outputMinimum, outputMaximum)
  return (
    plot.bottom -
    ((clamped - outputMinimum) / (outputMaximum - outputMinimum)) *
      (plot.bottom - plot.top)
  )
}

const tracePath = computed(() => {
  const samples = 240
  return Array.from({ length: samples + 1 }, (_, sample) => {
    const inputDb =
      inputMinimum + (sample / samples) * (inputMaximum - inputMinimum)
    return `${sample === 0 ? 'M' : 'L'}${xFor(inputDb).toFixed(2)} ${yFor(
      outputFor(inputDb),
    ).toFixed(2)}`
  }).join(' ')
})

const activationInput = computed(() =>
  clamp(
    normalized.value.variant === 'SIMPLE'
      ? normalized.value.threshold - normalized.value.inputGain
      : normalized.value.ceiling - normalized.value.inputGain,
    inputMinimum,
    inputMaximum,
  ),
)
</script>

<template>
  <figure class="limiter-scope" :data-variant="normalized.variant">
    <svg
      viewBox="0 0 260 112"
      role="img"
      :aria-label="`${normalized.variant === 'BUS' ? 'Mastering bus' : 'Simple'} limiter input-output transfer curve`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="limiter-phosphor-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="limiter-screen" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#0c2117" />
          <stop offset="72%" stop-color="#07130e" />
          <stop offset="100%" stop-color="#030806" />
        </radialGradient>
      </defs>

      <rect class="limiter-screen" x="1" y="1" width="258" height="104" rx="7" />
      <g class="limiter-grid" aria-hidden="true">
        <path d="M28 10V88 M83 10V88 M138 10V88 M193 10V88 M248 10V88" />
        <path d="M28 10H248 M28 29.5H248 M28 49H248 M28 68.5H248 M28 88H248" />
      </g>
      <path class="limiter-reference" d="M28 88L248 10" />
      <line
        class="limiter-activation"
        :x1="xFor(activationInput)"
        y1="10"
        :x2="xFor(activationInput)"
        y2="88"
      />
      <line
        class="limiter-ceiling"
        x1="28"
        :y1="yFor(normalized.ceiling)"
        x2="248"
        :y2="yFor(normalized.ceiling)"
      />
      <path class="limiter-trace-glow" :d="tracePath" />
      <path class="limiter-trace" :d="tracePath" />
      <circle
        class="limiter-activation-point"
        :cx="xFor(activationInput)"
        :cy="yFor(outputFor(activationInput))"
        r="2.3"
      />

      <g class="limiter-axis-labels" aria-hidden="true">
        <text x="25" y="100">-60</text>
        <text x="132" y="100">-30</text>
        <text x="244" y="100">0</text>
        <text x="219" y="109">IN dBFS</text>
        <text x="4" y="15">OUT</text>
      </g>
    </svg>

    <figcaption v-if="normalized.variant === 'SIMPLE'">
      <span>
        <strong>SIMPLE {{ normalized.mode }}</strong>
        G {{ normalized.inputGain.toFixed(1) }} dB &middot;
        T {{ normalized.threshold.toFixed(1) }} dB &middot;
        R 20.0:1
      </span>
      <span>
        C {{ normalized.ceiling.toFixed(1) }} dB &middot;
        MIX {{ normalized.dryWet.toFixed(0) }}%
      </span>
      <small>
        Static positive-magnitude curve; attack and release affect timing.
      </small>
    </figcaption>
    <figcaption v-else>
      <span>
        <strong>BUS {{ normalized.transientMode }}</strong>
        G {{ normalized.inputGain.toFixed(1) }} dB &middot;
        C {{ normalized.ceiling.toFixed(1) }} dBTP
      </span>
      <span>
        SOFT CLIP {{ normalized.softClip ? 'ON' : 'OFF' }}
        <template v-if="normalized.softClip">
          &middot; DRIVE {{ normalized.softClipDrive.toFixed(1) }} dB
        </template>
      </span>
      <small>
        Static transfer curve; lookahead, release, linking and ISP affect timing
        or detection.
      </small>
    </figcaption>
  </figure>
</template>

<style scoped>
.limiter-scope {
  display: grid;
  grid-template-rows: minmax(112px, 1fr) auto;
  gap: 5px;
  width: 100%;
  margin: 0;
  border: 1px solid #1d4933;
  border-radius: 8px;
  padding: 5px 6px 6px;
  background: #030806;
  box-shadow:
    inset 0 0 16px rgb(41 255 129 / 5%),
    0 0 10px rgb(12 66 39 / 16%);
}

.limiter-scope svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 112px;
}

.limiter-screen {
  fill: url('#limiter-screen');
  stroke: #173d2a;
}

.limiter-grid path {
  fill: none;
  stroke: rgb(61 151 98 / 18%);
  stroke-width: 0.65;
}

.limiter-reference {
  fill: none;
  stroke: rgb(133 178 148 / 30%);
  stroke-width: 0.8;
  stroke-dasharray: 4 3;
}

.limiter-activation,
.limiter-ceiling {
  stroke: #53dc83;
  stroke-width: 0.75;
  stroke-dasharray: 3 3;
}

.limiter-activation {
  opacity: 0.28;
}

.limiter-ceiling {
  opacity: 0.38;
}

.limiter-trace-glow,
.limiter-trace {
  fill: none;
  stroke: #72ff9d;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.limiter-trace-glow {
  opacity: 0.42;
  stroke-width: 4;
  filter: url('#limiter-phosphor-glow');
}

.limiter-trace {
  stroke-width: 1.35;
}

.limiter-activation-point {
  fill: #72ff9d;
  opacity: 0.9;
  filter: url('#limiter-phosphor-glow');
}

.limiter-axis-labels {
  fill: #417b55;
  font: 6px Consolas, 'Courier New', monospace;
}

.limiter-scope figcaption {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 8px;
  padding: 0 2px;
  color: #4f9d69;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 7px;
  letter-spacing: 0.02em;
}

.limiter-scope figcaption span {
  min-width: 0;
}

.limiter-scope figcaption strong {
  color: #70cf8d;
  font-weight: 700;
}

.limiter-scope figcaption > small {
  grid-column: 1 / -1;
  color: #37634a;
  font-size: 7px;
}
</style>
