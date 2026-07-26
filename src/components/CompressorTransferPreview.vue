<script setup lang="ts">
import { computed } from 'vue'

interface CompressorCurve {
  label: string
  threshold: number
  ratio: number
  knee: number
}

const props = defineProps<{
  curves: CompressorCurve[]
}>()

const colors = ['#72ff9d', '#42d77b', '#a4ffc1', '#2eaf67']
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

const normalizedCurves = computed(() =>
  props.curves.map((curve) => ({
    label: curve.label,
    threshold: Math.min(0, Math.max(-60, Number(curve.threshold) || 0)),
    ratio: Math.min(20, Math.max(1, Number(curve.ratio) || 1)),
    knee: Math.min(24, Math.max(0, Number(curve.knee) || 0)),
  })),
)

function compressionGainDb(
  inputDb: number,
  thresholdDb: number,
  ratio: number,
  kneeDb: number,
): number {
  if (kneeDb <= 0) {
    return inputDb <= thresholdDb
      ? 0
      : (1 / ratio - 1) * (inputDb - thresholdDb)
  }

  const lowerKneeDb = thresholdDb - kneeDb / 2
  const upperKneeDb = thresholdDb + kneeDb / 2
  if (inputDb <= lowerKneeDb) return 0
  if (inputDb >= upperKneeDb) {
    return (1 / ratio - 1) * (inputDb - thresholdDb)
  }
  const distanceIntoKnee = inputDb - lowerKneeDb
  return (
    ((1 / ratio - 1) * distanceIntoKnee * distanceIntoKnee) /
    (2 * kneeDb)
  )
}

function xFor(inputDb: number): number {
  return (
    plot.left +
    ((inputDb - inputMinimum) / (inputMaximum - inputMinimum)) *
      (plot.right - plot.left)
  )
}

function yFor(outputDb: number): number {
  const clamped = Math.min(outputMaximum, Math.max(outputMinimum, outputDb))
  return (
    plot.bottom -
    ((clamped - outputMinimum) / (outputMaximum - outputMinimum)) *
      (plot.bottom - plot.top)
  )
}

function outputFor(inputDb: number, curve: CompressorCurve): number {
  return (
    inputDb +
    compressionGainDb(inputDb, curve.threshold, curve.ratio, curve.knee)
  )
}

function pathFor(curve: CompressorCurve): string {
  const samples = 240
  return Array.from({ length: samples + 1 }, (_, sample) => {
    const inputDb =
      inputMinimum + (sample / samples) * (inputMaximum - inputMinimum)
    const x = xFor(inputDb)
    const y = yFor(outputFor(inputDb, curve))
    return `${sample === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}
</script>

<template>
  <figure class="compressor-scope" :data-curve-count="normalizedCurves.length">
    <svg
      viewBox="0 0 260 112"
      role="img"
      :aria-label="`${normalizedCurves.length === 1 ? normalizedCurves[0]?.label : 'Multiband'} compressor input-output transfer curve`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="compressor-phosphor-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="compressor-screen" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#0c2117" />
          <stop offset="72%" stop-color="#07130e" />
          <stop offset="100%" stop-color="#030806" />
        </radialGradient>
      </defs>

      <rect class="compressor-screen" x="1" y="1" width="258" height="104" rx="7" />
      <g class="compressor-grid" aria-hidden="true">
        <path d="M28 10V88 M83 10V88 M138 10V88 M193 10V88 M248 10V88" />
        <path d="M28 10H248 M28 29.5H248 M28 49H248 M28 68.5H248 M28 88H248" />
      </g>
      <path class="compressor-reference" d="M28 88L248 10" />

      <g
        v-for="(curve, index) in normalizedCurves"
        :key="curve.label"
        class="compressor-curve"
        :data-label="curve.label"
      >
        <line
          class="compressor-threshold"
          :x1="xFor(curve.threshold)"
          y1="10"
          :x2="xFor(curve.threshold)"
          y2="88"
          :style="{ stroke: colors[index % colors.length] }"
        />
        <path
          class="compressor-trace-glow"
          :d="pathFor(curve)"
          :style="{ stroke: colors[index % colors.length] }"
        />
        <path
          class="compressor-trace"
          :d="pathFor(curve)"
          :style="{ stroke: colors[index % colors.length] }"
        />
        <circle
          class="compressor-knee-point"
          :cx="xFor(curve.threshold)"
          :cy="yFor(outputFor(curve.threshold, curve))"
          r="2.3"
          :style="{ fill: colors[index % colors.length] }"
        />
      </g>

      <g class="compressor-axis-labels" aria-hidden="true">
        <text x="25" y="100">-60</text>
        <text x="132" y="100">-30</text>
        <text x="244" y="100">0</text>
        <text x="219" y="109">IN dBFS</text>
        <text x="4" y="15">OUT</text>
      </g>
    </svg>

    <figcaption>
      <span
        v-for="(curve, index) in normalizedCurves"
        :key="`legend-${curve.label}`"
        class="compressor-legend"
      >
        <i :style="{ background: colors[index % colors.length] }" />
        <strong>{{ curve.label }}</strong>
        T {{ curve.threshold.toFixed(1) }} dB &middot;
        R {{ curve.ratio.toFixed(1) }}:1 &middot;
        K {{ curve.knee.toFixed(1) }} dB
      </span>
      <small>Static transfer curve; attack and release affect timing.</small>
    </figcaption>
  </figure>
</template>

<style scoped>
.compressor-scope {
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

.compressor-scope svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 112px;
}

.compressor-screen {
  fill: url('#compressor-screen');
  stroke: #173d2a;
}

.compressor-grid path {
  fill: none;
  stroke: rgb(61 151 98 / 18%);
  stroke-width: 0.65;
}

.compressor-reference {
  fill: none;
  stroke: rgb(133 178 148 / 30%);
  stroke-width: 0.8;
  stroke-dasharray: 4 3;
}

.compressor-threshold {
  opacity: 0.28;
  stroke-width: 0.75;
  stroke-dasharray: 3 3;
}

.compressor-trace-glow,
.compressor-trace {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.compressor-trace-glow {
  opacity: 0.42;
  stroke-width: 4;
  filter: url('#compressor-phosphor-glow');
}

.compressor-trace {
  stroke-width: 1.35;
}

.compressor-knee-point {
  opacity: 0.9;
  filter: url('#compressor-phosphor-glow');
}

.compressor-axis-labels {
  fill: #417b55;
  font: 6px Consolas, 'Courier New', monospace;
}

.compressor-scope figcaption {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 8px;
  padding: 0 2px;
  color: #4f9d69;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 7px;
  letter-spacing: 0.02em;
}

.compressor-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.compressor-legend i {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  box-shadow: 0 0 5px currentcolor;
}

.compressor-legend strong {
  color: #70cf8d;
  font-weight: 700;
}

.compressor-scope figcaption > small {
  grid-column: 1 / -1;
  color: #37634a;
  font-size: 7px;
}
</style>
