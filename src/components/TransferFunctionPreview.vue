<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  algorithm: string
  saturation: number
  asymmetry: boolean
}>()

const normalizedAlgorithm = computed(() => {
  const value = String(props.algorithm || 'COSINE').trim().toUpperCase()
  if (value === '1' || value === 'NEPERO') return 'EXPONENTIAL'
  if (value === '2' || value === 'INVERSEPOWER') return 'INVERSE_POWER'
  if (value === '0') return 'COSINE'
  return value
})
const saturation = computed(() =>
  Math.min(4, Math.max(1, Number(props.saturation) || 1)),
)
const asymmetryAmount = computed(() => (props.asymmetry ? 1 : 0))

function transfer(input: number): number {
  const amount = saturation.value
  const asymmetry = asymmetryAmount.value
  const activateAsymmetry = amount === 1 ? 0 : 1

  if (normalizedAlgorithm.value === 'EXPONENTIAL') {
    if (input >= 0) {
      const base =
        (1 - asymmetry * activateAsymmetry) * Math.E +
        asymmetry * activateAsymmetry * Math.PI
      return 1 - Math.pow(base, -(1.2 * amount * input))
    }
    return Math.exp(1.2 * amount * input) - 1
  }

  if (normalizedAlgorithm.value === 'INVERSE_POWER') {
    if (input >= 0) return 0.99 * Math.pow(input, 1 / amount)
    return (
      -(0.99 - 0.29 * asymmetry * activateAsymmetry) *
      Math.pow(-input, 1 / amount)
    )
  }

  if (input >= 0) {
    return Math.cos((amount * input * Math.PI) / 1.4 / 4 - Math.PI / 2)
  }
  return Math.cos(
    (amount * input * Math.PI) /
      (1.4 + 0.5 * asymmetry * activateAsymmetry) /
      4 -
      Math.PI / 2,
  )
}

const tracePath = computed(() => {
  const left = 13
  const right = 247
  const top = 10
  const bottom = 68
  const samples = 256

  return Array.from({ length: samples + 1 }, (_, sample) => {
    const progress = sample / samples
    const input = progress * 2 - 1
    const output = Math.min(1, Math.max(-1, transfer(input)))
    const x = left + progress * (right - left)
    const y = bottom - ((output + 1) / 2) * (bottom - top)
    return `${sample === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
})
</script>

<template>
  <figure class="transfer-scope" :data-algorithm="normalizedAlgorithm">
    <svg
      viewBox="0 0 260 82"
      role="img"
      :aria-label="`${normalizedAlgorithm.replace(/_/g, ' ')} saturation transfer function`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="transfer-phosphor-glow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="transfer-screen" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#0c2117" />
          <stop offset="72%" stop-color="#07130e" />
          <stop offset="100%" stop-color="#030806" />
        </radialGradient>
      </defs>

      <rect class="transfer-screen" x="1" y="1" width="258" height="80" rx="7" />
      <g class="transfer-grid" aria-hidden="true">
        <path d="M13 10V68 M71.5 10V68 M130 10V68 M188.5 10V68 M247 10V68" />
        <path d="M13 10H247 M13 24.5H247 M13 39H247 M13 53.5H247 M13 68H247" />
      </g>
      <path class="transfer-reference" d="M13 68L247 10" />
      <line class="transfer-axis" x1="13" y1="39" x2="247" y2="39" />
      <line class="transfer-axis" x1="130" y1="10" x2="130" y2="68" />
      <path class="transfer-trace-glow" :d="tracePath" />
      <path class="transfer-trace" :d="tracePath" />
    </svg>
    <figcaption>
      <span>{{ normalizedAlgorithm.replace(/_/g, ' ') }}</span>
      <span>
        sat {{ saturation.toFixed(2) }} &middot;
        {{ asymmetry ? 'asymmetric' : 'symmetric' }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.transfer-scope {
  display: grid;
  grid-template-rows: minmax(82px, 1fr) auto;
  gap: 5px;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 1px solid #1d4933;
  border-radius: 8px;
  padding: 5px 6px 6px;
  background: #030806;
  box-shadow:
    inset 0 0 16px rgb(41 255 129 / 5%),
    0 0 10px rgb(12 66 39 / 16%);
}

.transfer-scope svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 82px;
}

.transfer-screen {
  fill: url('#transfer-screen');
  stroke: #173d2a;
}

.transfer-grid path {
  fill: none;
  stroke: rgb(61 151 98 / 18%);
  stroke-width: 0.65;
}

.transfer-axis {
  stroke: rgb(106 255 156 / 35%);
  stroke-width: 0.8;
  stroke-dasharray: 3 3;
}

.transfer-reference {
  fill: none;
  stroke: rgb(133 178 148 / 32%);
  stroke-width: 0.8;
  stroke-dasharray: 4 3;
}

.transfer-trace-glow,
.transfer-trace {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.transfer-trace-glow {
  stroke: rgb(57 255 126 / 48%);
  stroke-width: 4;
  filter: url('#transfer-phosphor-glow');
}

.transfer-trace {
  stroke: #72ff9d;
  stroke-width: 1.35;
}

.transfer-scope figcaption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
  color: #4f9d69;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 8px;
  letter-spacing: 0.035em;
}

.transfer-scope figcaption span:first-child {
  color: #69c987;
}
</style>
