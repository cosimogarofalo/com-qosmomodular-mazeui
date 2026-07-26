<script setup lang="ts">
import { computed } from 'vue'

export interface EqBand {
  label: string
  type: 'BELL' | 'LOW_SHELF' | 'HIGH_SHELF' | 'HIGH_PASS' | 'LOW_PASS'
  enabled: boolean
  frequency: number
  gain: number
  q?: number
  slope?: number
}

interface Complex {
  re: number
  im: number
}

interface FilterCoefficients {
  feedforward: number[]
  feedback: number[]
}

const props = withDefaults(
  defineProps<{
    bands: EqBand[]
    sampleRate?: number
    inputGain?: number
    outputGain?: number
    dryWet?: number
    dynamic?: boolean
  }>(),
  {
    sampleRate: 48_000,
    inputGain: 0,
    outputGain: 0,
    dryWet: 100,
    dynamic: false,
  },
)

const colors = [
  '#72ff9d',
  '#48dfff',
  '#ffc95a',
  '#ff7fa6',
  '#ad8cff',
  '#67e6bf',
  '#ff9d5c',
  '#7da7ff',
  '#d7ff69',
  '#ff6f69',
]
const minimumFrequency = 20
const minimumDb = -24
const maximumDb = 24
const plot = {
  left: 38,
  right: 706,
  top: 12,
  bottom: 196,
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

const normalizedSampleRate = computed(() =>
  clamp(Number(props.sampleRate) || 48_000, 8_000, 384_000),
)
const maximumFrequency = computed(() =>
  Math.min(20_000, normalizedSampleRate.value * 0.45),
)
const normalizedBands = computed(() =>
  props.bands.map((band) => ({
    ...band,
    enabled: Boolean(band.enabled),
    frequency: clamp(
      Number(band.frequency) || minimumFrequency,
      minimumFrequency,
      maximumFrequency.value,
    ),
    gain: clamp(Number(band.gain) || 0, -24, 24),
    q: clamp(Number(band.q) || 1, 0.2, 24),
    slope: [1, 2, 4].includes(Number(band.slope))
      ? Number(band.slope)
      : 2,
  })),
)

function complexAdd(left: Complex, right: Complex): Complex {
  return { re: left.re + right.re, im: left.im + right.im }
}

function complexMultiply(left: Complex, right: Complex): Complex {
  return {
    re: left.re * right.re - left.im * right.im,
    im: left.re * right.im + left.im * right.re,
  }
}

function complexScale(value: Complex, scale: number): Complex {
  return { re: value.re * scale, im: value.im * scale }
}

function complexDivide(numerator: Complex, denominator: Complex): Complex {
  const magnitude = denominator.re ** 2 + denominator.im ** 2
  return {
    re:
      (numerator.re * denominator.re + numerator.im * denominator.im) /
      magnitude,
    im:
      (numerator.im * denominator.re - numerator.re * denominator.im) /
      magnitude,
  }
}

function complexMagnitude(value: Complex): number {
  return Math.hypot(value.re, value.im)
}

function convolve(left: number[], right: number[]): number[] {
  const output = Array.from(
    { length: left.length + right.length - 1 },
    () => 0,
  )
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      output[leftIndex + rightIndex] +=
        left[leftIndex] * right[rightIndex]
    }
  }
  return output
}

function shelfCoefficients(
  high: boolean,
  frequency: number,
  gainDb: number,
): FilterCoefficients {
  const gain = 10 ** (gainDb / 20)
  const tangent = Math.tan((Math.PI * frequency) / normalizedSampleRate.value)
  const squareRootGain = Math.sqrt(gain)
  const b1 = high
    ? squareRootGain * tangent + gain
    : gain * tangent + squareRootGain
  const b0 = high
    ? squareRootGain * tangent - gain
    : gain * tangent - squareRootGain
  const a1 = high
    ? squareRootGain * tangent + 1
    : tangent + squareRootGain
  const a0 = high
    ? squareRootGain * tangent - 1
    : tangent - squareRootGain
  const scale = b1 / a1
  return {
    feedforward: [scale, (scale * b0) / b1],
    feedback: [a0 / a1],
  }
}

function bellCoefficients(
  frequency: number,
  gainDb: number,
  q: number,
): FilterCoefficients {
  const gain = 10 ** (gainDb / 20)
  const bandwidth = clamp(
    frequency / q,
    1,
    normalizedSampleRate.value * 0.45,
  )
  const centerOmega =
    (2 * Math.PI * frequency) / normalizedSampleRate.value
  const bandwidthTangent = Math.tan(
    (Math.PI * bandwidth) / normalizedSampleRate.value,
  )
  const centerCosine = Math.cos(centerOmega)
  const squareRootGain = Math.sqrt(gain)
  const b2 = gain * bandwidthTangent + squareRootGain
  const b1 = -2 * squareRootGain * centerCosine
  const b0 = -gain * bandwidthTangent + squareRootGain
  const a2 = bandwidthTangent + squareRootGain
  const a1 = -2 * squareRootGain * centerCosine
  const a0 = -bandwidthTangent + squareRootGain
  const scale = b2 / a2
  return {
    feedforward: [
      scale,
      (scale * b1) / b2,
      (scale * b0) / b2,
    ],
    feedback: [a1 / a2, a0 / a2],
  }
}

function passCoefficients(
  high: boolean,
  frequency: number,
  order: number,
): FilterCoefficients {
  const tangent = Math.tan((Math.PI * frequency) / normalizedSampleRate.value)
  const beta = (1 - tangent) / (1 + tangent)
  const numeratorSign = high ? -1 : 1
  const numeratorBase = high ? 1 + beta : 1 - beta

  if (order === 1) {
    return {
      feedforward: [numeratorBase / 2, (numeratorSign * numeratorBase) / 2],
      feedback: [-beta],
    }
  }

  const orderForPoles = order === 4 ? 4 : 2
  const polePair = (index: number) => {
    const normalizedPole = (2 * index - 1) / orderForPoles - 1
    const gamma = (Math.PI / 4) * normalizedPole
    const pole = Math.abs(Math.tan(gamma))
    const normalization = 1 / (2 * Math.cos(gamma))
    const a2 = 1 + beta ** 2 * pole ** 2
    return {
      normalization,
      denominator: [
        1,
        (-2 * beta * (1 + pole ** 2)) / a2,
        (beta ** 2 + pole ** 2) / a2,
      ],
      a2,
    }
  }
  const numerator = [
    1,
    numeratorSign * 2,
    1,
  ]
  const first = polePair(1)
  const second = polePair(2)

  if (orderForPoles === 2) {
    const scale =
      first.normalization * second.normalization * numeratorBase ** 2 / first.a2
    return {
      feedforward: numerator.map((coefficient) => coefficient * scale),
      feedback: first.denominator.slice(1),
    }
  }

  const third = polePair(3)
  const fourth = polePair(4)
  const scale =
    first.normalization *
    second.normalization *
    third.normalization *
    fourth.normalization *
    (numeratorBase ** 2 / first.a2) *
    (numeratorBase ** 2 / second.a2)
  return {
    feedforward: convolve(numerator, numerator).map(
      (coefficient) => coefficient * scale,
    ),
    feedback: convolve(first.denominator, second.denominator).slice(1),
  }
}

function coefficientsFor(band: (typeof normalizedBands.value)[number]) {
  if (band.type === 'LOW_SHELF') {
    return shelfCoefficients(false, band.frequency, band.gain)
  }
  if (band.type === 'HIGH_SHELF') {
    return shelfCoefficients(true, band.frequency, band.gain)
  }
  if (band.type === 'HIGH_PASS') {
    return passCoefficients(true, band.frequency, band.slope)
  }
  if (band.type === 'LOW_PASS') {
    return passCoefficients(false, band.frequency, band.slope)
  }
  return bellCoefficients(band.frequency, band.gain, band.q)
}

function filterResponse(
  coefficients: FilterCoefficients,
  frequency: number,
): Complex {
  const omega =
    (2 * Math.PI * frequency) / normalizedSampleRate.value
  const delay = (index: number): Complex => ({
    re: Math.cos(-omega * index),
    im: Math.sin(-omega * index),
  })
  let numerator = { re: 0, im: 0 }
  let denominator = { re: 1, im: 0 }
  coefficients.feedforward.forEach((coefficient, index) => {
    numerator = complexAdd(
      numerator,
      complexScale(delay(index), coefficient),
    )
  })
  coefficients.feedback.forEach((coefficient, index) => {
    denominator = complexAdd(
      denominator,
      complexScale(delay(index + 1), coefficient),
    )
  })
  return complexDivide(numerator, denominator)
}

function bandResponse(
  band: (typeof normalizedBands.value)[number],
  frequency: number,
): Complex {
  return band.enabled
    ? filterResponse(coefficientsFor(band), frequency)
    : { re: 1, im: 0 }
}

function totalResponse(frequency: number): Complex {
  let wet = {
    re: 10 ** (clamp(Number(props.inputGain) || 0, -24, 24) / 20),
    im: 0,
  }
  normalizedBands.value.forEach((band) => {
    wet = complexMultiply(wet, bandResponse(band, frequency))
  })
  const wetAmount = clamp(Number(props.dryWet) || 0, 0, 100) / 100
  const mixed = complexAdd(
    { re: 1 - wetAmount, im: 0 },
    complexScale(wet, wetAmount),
  )
  return complexScale(
    mixed,
    10 ** (clamp(Number(props.outputGain) || 0, -24, 24) / 20),
  )
}

function responseDb(response: Complex): number {
  return 20 * Math.log10(Math.max(1e-9, complexMagnitude(response)))
}

function xFor(frequency: number): number {
  const ratio =
    Math.log(frequency / minimumFrequency) /
    Math.log(maximumFrequency.value / minimumFrequency)
  return plot.left + ratio * (plot.right - plot.left)
}

function yFor(db: number): number {
  const normalizedDb = clamp(db, minimumDb, maximumDb)
  return (
    plot.bottom -
    ((normalizedDb - minimumDb) / (maximumDb - minimumDb)) *
      (plot.bottom - plot.top)
  )
}

function frequencyForSample(sample: number, samples: number): number {
  return (
    minimumFrequency *
    (maximumFrequency.value / minimumFrequency) ** (sample / samples)
  )
}

function pathFor(response: (frequency: number) => Complex): string {
  const samples = 360
  return Array.from({ length: samples + 1 }, (_, sample) => {
    const frequency = frequencyForSample(sample, samples)
    return `${sample === 0 ? 'M' : 'L'}${xFor(frequency).toFixed(2)} ${yFor(
      responseDb(response(frequency)),
    ).toFixed(2)}`
  }).join(' ')
}

const totalPath = computed(() => pathFor(totalResponse))
const bandPaths = computed(() =>
  normalizedBands.value.map((band) =>
    pathFor((frequency) => bandResponse(band, frequency)),
  ),
)
const bandNodes = computed(() =>
  normalizedBands.value.map((band) => ({
    x: xFor(band.frequency),
    y: yFor(responseDb(bandResponse(band, band.frequency))),
  })),
)
const frequencyTicks = computed(() =>
  [20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000].filter(
    (frequency) => frequency <= maximumFrequency.value,
  ),
)

function frequencyLabel(frequency: number): string {
  if (frequency >= 1000) {
    return `${Number((frequency / 1000).toFixed(1))}k`
  }
  return String(Math.round(frequency))
}
</script>

<template>
  <figure
    class="eq-scope"
    :data-band-count="normalizedBands.length"
    :data-dynamic="dynamic"
  >
    <svg
      viewBox="0 0 720 230"
      role="img"
      :aria-label="`${dynamic ? 'Dynamic EQ maximum range' : 'Equalizer'} frequency response`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="eq-phosphor-glow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="eq-screen" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#0c2117" />
          <stop offset="72%" stop-color="#07130e" />
          <stop offset="100%" stop-color="#030806" />
        </radialGradient>
      </defs>

      <rect class="eq-screen" x="1" y="1" width="718" height="222" rx="8" />
      <g class="eq-grid" aria-hidden="true">
        <line
          v-for="frequency in frequencyTicks"
          :key="`grid-${frequency}`"
          :x1="xFor(frequency)"
          y1="12"
          :x2="xFor(frequency)"
          y2="196"
        />
        <path d="M38 12H706 M38 58H706 M38 104H706 M38 150H706 M38 196H706" />
      </g>
      <line class="eq-zero-line" x1="38" :y1="yFor(0)" x2="706" :y2="yFor(0)" />

      <g
        v-for="(band, index) in normalizedBands"
        :key="band.label"
        class="eq-band"
        :class="{ disabled: !band.enabled }"
        :data-label="band.label"
        :data-enabled="band.enabled"
      >
        <path
          class="eq-band-trace"
          :d="bandPaths[index]"
          :style="{ stroke: colors[index % colors.length] }"
        />
        <circle
          class="eq-band-node-glow"
          :cx="bandNodes[index]?.x"
          :cy="bandNodes[index]?.y"
          r="5"
          :style="{ fill: colors[index % colors.length] }"
        />
        <circle
          class="eq-band-node"
          :cx="bandNodes[index]?.x"
          :cy="bandNodes[index]?.y"
          r="2.8"
          :style="{ fill: colors[index % colors.length] }"
        />
        <text
          class="eq-band-label"
          :x="bandNodes[index]?.x"
          :y="Math.max(10, (bandNodes[index]?.y || 0) - 7)"
          :style="{ fill: colors[index % colors.length] }"
        >
          {{ band.label }}
        </text>
      </g>

      <path class="eq-total-glow" :d="totalPath" />
      <path class="eq-total-trace" :d="totalPath" />

      <g class="eq-axis-labels" aria-hidden="true">
        <text
          v-for="frequency in frequencyTicks"
          :key="`label-${frequency}`"
          :x="xFor(frequency)"
          y="210"
          text-anchor="middle"
        >
          {{ frequencyLabel(frequency) }}
        </text>
        <text x="4" y="17">+24</text>
        <text x="15" :y="yFor(0) + 2">0</text>
        <text x="4" y="198">-24</text>
        <text x="665" y="220">Hz</text>
        <text x="4" y="112">dB</text>
      </g>
    </svg>

    <figcaption>
      <span>
        <i class="eq-total-key" />
        <strong>TOTAL</strong>
        {{ normalizedSampleRate }} Hz
      </span>
      <span>
        IN {{ Number(inputGain).toFixed(1) }} dB &middot;
        OUT {{ Number(outputGain).toFixed(1) }} dB &middot;
        MIX {{ Number(dryWet).toFixed(0) }}%
      </span>
      <small v-if="dynamic">
        Curves show maximum Range; threshold, attack, release and audio level
        determine the instantaneous movement.
      </small>
      <small v-else>
        Colored traces are individual bands; the bright trace is their combined
        response. Final nonlinear ceiling is not shown.
      </small>
    </figcaption>
  </figure>
</template>

<style scoped>
.eq-scope {
  display: grid;
  grid-template-rows: minmax(180px, 1fr) auto;
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

.eq-scope svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.eq-screen {
  fill: url('#eq-screen');
  stroke: #173d2a;
}

.eq-grid line,
.eq-grid path {
  fill: none;
  stroke: rgb(61 151 98 / 16%);
  stroke-width: 0.65;
}

.eq-zero-line {
  stroke: rgb(128 208 153 / 42%);
  stroke-width: 0.9;
}

.eq-band-trace {
  fill: none;
  opacity: 0.47;
  stroke-width: 1;
  stroke-linecap: round;
}

.eq-band.disabled {
  opacity: 0.16;
}

.eq-band-node-glow {
  opacity: 0.28;
  filter: url('#eq-phosphor-glow');
}

.eq-band-node {
  stroke: #07130e;
  stroke-width: 0.8;
}

.eq-band-label {
  font: 6px Consolas, 'Courier New', monospace;
  text-anchor: middle;
}

.eq-total-glow,
.eq-total-trace {
  fill: none;
  stroke: #8bffae;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.eq-total-glow {
  opacity: 0.4;
  stroke-width: 5;
  filter: url('#eq-phosphor-glow');
}

.eq-total-trace {
  stroke-width: 1.55;
}

.eq-axis-labels {
  fill: #417b55;
  font: 6px Consolas, 'Courier New', monospace;
}

.eq-scope figcaption {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 10px;
  padding: 0 3px;
  color: #4f9d69;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 7px;
}

.eq-scope figcaption span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eq-scope figcaption strong {
  color: #70cf8d;
}

.eq-total-key {
  width: 12px;
  height: 2px;
  background: #8bffae;
  box-shadow: 0 0 4px #72ff9d;
}

.eq-scope figcaption small {
  grid-column: 1 / -1;
  color: #37634a;
  font-size: 7px;
}
</style>
