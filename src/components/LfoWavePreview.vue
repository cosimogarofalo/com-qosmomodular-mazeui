<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  wave: string
}>()

const normalizedWave = computed(() =>
  String(props.wave || 'UNIPOLAR_SINE').trim().toUpperCase(),
)
const bipolar = computed(() => normalizedWave.value.startsWith('BIPOLAR_'))
const domainLabel = computed(() =>
  bipolar.value ? '−0.5 … +0.5 · zero centered' : '0 … 1 · offset +0.5',
)
const displayName = computed(() =>
  normalizedWave.value.replace(/_/g, ' '),
)

function primitive(phase: number, wave: string, sample: number): number {
  if (wave.includes('TRIANGLE')) {
    if (phase <= 0.25) return 0.5 + 2 * phase
    if (phase <= 0.75) return 1.5 - 2 * phase
    return 2 * phase - 1.5
  }
  if (wave.includes('SAW')) return 1 - phase
  if (wave.includes('RAMP')) return phase
  if (wave.includes('SQUARE')) return phase <= 0.5 ? 1 : 0
  if (wave.includes('PULSE')) return phase <= 0.08 ? 1 : 0
  if (wave.includes('EXPONENTIAL')) return phase * phase
  if (wave.includes('LOGARITHMIC')) return Math.sqrt(phase)
  if (wave.includes('NOISE')) {
    const noise = Math.sin((sample + 1) * 12.9898) * 43758.5453
    return noise - Math.floor(noise)
  }
  if (wave.includes('CURVE')) {
    return 0.5 - Math.cos(Math.PI * phase) / 2
  }
  return 0.5 * (1 + Math.sin(2 * Math.PI * phase))
}

const tracePath = computed(() => {
  const left = 13
  const right = 247
  const top = 10
  const bottom = 68
  const samples = 192
  const cycles = 2

  return Array.from({ length: samples + 1 }, (_, sample) => {
    const progress = sample / samples
    const cyclePosition = progress * cycles
    const phase = cyclePosition - Math.floor(cyclePosition)
    const amplitude = Math.min(
      1,
      Math.max(0, primitive(phase, normalizedWave.value, sample)),
    )
    const x = left + progress * (right - left)
    const y = bottom - amplitude * (bottom - top)
    return `${sample === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
})
</script>

<template>
  <figure class="lfo-scope" :data-wave="normalizedWave">
    <svg
      viewBox="0 0 260 82"
      role="img"
      :aria-label="`${displayName} LFO waveform, ${domainLabel}`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="lfo-phosphor-glow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="lfo-screen" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#0c2117" />
          <stop offset="72%" stop-color="#07130e" />
          <stop offset="100%" stop-color="#030806" />
        </radialGradient>
      </defs>

      <rect class="scope-screen" x="1" y="1" width="258" height="80" rx="7" />
      <g class="scope-grid" aria-hidden="true">
        <path d="M13 10V68 M71.5 10V68 M130 10V68 M188.5 10V68 M247 10V68" />
        <path d="M13 10H247 M13 24.5H247 M13 39H247 M13 53.5H247 M13 68H247" />
      </g>
      <line class="scope-axis" x1="13" y1="39" x2="247" y2="39" />
      <path class="scope-trace-glow" :d="tracePath" />
      <path class="scope-trace" :d="tracePath" />
    </svg>
    <figcaption>
      <span>{{ displayName }}</span>
      <span>{{ domainLabel }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.lfo-scope {
  display: grid;
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

.lfo-scope svg {
  display: block;
  width: 100%;
  height: 82px;
}

.scope-screen {
  fill: url('#lfo-screen');
  stroke: #173d2a;
}

.scope-grid path {
  fill: none;
  stroke: rgb(61 151 98 / 18%);
  stroke-width: 0.65;
}

.scope-axis {
  stroke: rgb(106 255 156 / 35%);
  stroke-width: 0.8;
  stroke-dasharray: 3 3;
}

.scope-trace-glow,
.scope-trace {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.scope-trace-glow {
  stroke: rgb(57 255 126 / 48%);
  stroke-width: 4;
  filter: url('#lfo-phosphor-glow');
}

.scope-trace {
  stroke: #72ff9d;
  stroke-width: 1.35;
}

.lfo-scope figcaption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
  color: #4f9d69;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 8px;
  letter-spacing: 0.035em;
}

.lfo-scope figcaption span:first-child {
  color: #69c987;
}
</style>
