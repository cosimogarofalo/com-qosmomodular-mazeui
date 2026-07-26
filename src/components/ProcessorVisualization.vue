<script setup lang="ts">
import CompressorTransferPreview from '@/components/CompressorTransferPreview.vue'
import EqFrequencyResponse, {
  type EqBand,
} from '@/components/EqFrequencyResponse.vue'
import LimiterTransferPreview from '@/components/LimiterTransferPreview.vue'
import TransferFunctionPreview from '@/components/TransferFunctionPreview.vue'
import type { ChainEffectDraft, Processor } from '@/types/maze'

const props = defineProps<{
  effect: ChainEffectDraft
  processor: Processor
  sampleRate?: number
}>()

function processorNumber(name: string, fallback: number): number {
  const contractDefault = props.processor.params.find((param) => param.name === name)
    ?.defaultValue
  const number = Number(
    props.effect.params[name]?.value ?? contractDefault ?? fallback,
  )
  return Number.isFinite(number) ? number : fallback
}

function processorBoolean(name: string, fallback: boolean): boolean {
  const contractDefault = props.processor.params.find((param) => param.name === name)
    ?.defaultValue
  return (
    String(
      props.effect.params[name]?.value ?? contractDefault ?? fallback,
    ).toLowerCase() === 'true'
  )
}

function processorString(name: string, fallback: string): string {
  const contractDefault = props.processor.params.find((param) => param.name === name)
    ?.defaultValue
  return String(props.effect.params[name]?.value ?? contractDefault ?? fallback)
}

function compressorCurves(): Array<{
  label: string
  threshold: number
  ratio: number
  knee: number
}> {
  if (props.processor.subType === 'MULTIBAND') {
    const bands = [
      ['LOW', 'low'],
      ['LOW MID', 'lowMid'],
      ['HIGH MID', 'highMid'],
      ['HIGH', 'high'],
    ] as const
    return bands.map(([label, prefix]) => ({
      label,
      threshold: processorNumber(`${prefix}Threshold`, -18),
      ratio: processorNumber(`${prefix}Ratio`, 2),
      knee: processorNumber(
        `${prefix}Knee`,
        processorNumber('knee', 6),
      ),
    }))
  }

  return [
    {
      label: props.processor.subType === 'BUS' ? 'BUS' : 'WIDEBAND',
      threshold: processorNumber('threshold', -18),
      ratio: processorNumber('ratio', 2),
      knee: processorNumber('knee', 6),
    },
  ]
}

function limiterSettings() {
  const bus = props.processor.subType === 'BUS'
  return {
    variant: bus ? ('BUS' as const) : ('SIMPLE' as const),
    inputGain: processorNumber('inputGain', 0),
    ceiling: processorNumber(bus ? 'ceiling' : 'outputCeiling', -1),
    threshold: processorNumber('threshold', -12),
    dryWet: processorNumber('dryWet', 100),
    mode: processorString('mode', 'VCA'),
    softClip: processorBoolean('softClip', false),
    softClipDrive: processorNumber('softClipDrive', 0),
    transientMode: processorString('transientMode', 'CLEAN'),
  }
}

function processorSlope(name: string, fallback = 2): number {
  const slope = Number.parseInt(processorString(name, `${fallback}P`), 10)
  return [1, 2, 4].includes(slope) ? slope : fallback
}

function tenBandSettings(): EqBand[] {
  const bands = [
    ['31', 31, 'LOW_SHELF'],
    ['62', 62, 'BELL'],
    ['125', 125, 'BELL'],
    ['250', 250, 'BELL'],
    ['500', 500, 'BELL'],
    ['1k', 1_000, 'BELL'],
    ['2k', 2_000, 'BELL'],
    ['4k', 4_000, 'BELL'],
    ['8k', 8_000, 'BELL'],
    ['16k', 16_000, 'HIGH_SHELF'],
  ] as const
  return bands.map(([label, frequency, type]) => ({
    label,
    type,
    enabled: true,
    frequency,
    gain: processorNumber(`band${label}`, 0),
    q: 1,
  }))
}

function parametricSettings(): EqBand[] {
  const bands: EqBand[] = [
    {
      label: 'HP',
      type: 'HIGH_PASS',
      enabled: processorBoolean('highPassEnabled', false),
      frequency: processorNumber('highPassFrequency', 20),
      gain: 0,
      slope: processorSlope('highPassSlope'),
    },
    {
      label: 'LS',
      type: 'LOW_SHELF',
      enabled: processorBoolean('lowShelfEnabled', false),
      frequency: processorNumber('lowShelfFrequency', 120),
      gain: processorNumber('lowShelfGain', 0),
    },
  ]
  for (let index = 1; index <= 4; index += 1) {
    bands.push({
      label: `B${index}`,
      type: 'BELL',
      enabled: processorBoolean(`bell${index}Enabled`, false),
      frequency: processorNumber(
        `bell${index}Frequency`,
        [160, 550, 2_200, 6_500][index - 1] || 1_000,
      ),
      gain: processorNumber(`bell${index}Gain`, 0),
      q: processorNumber(`bell${index}Q`, 1),
    })
  }
  bands.push(
    {
      label: 'HS',
      type: 'HIGH_SHELF',
      enabled: processorBoolean('highShelfEnabled', false),
      frequency: processorNumber('highShelfFrequency', 10_000),
      gain: processorNumber('highShelfGain', 0),
    },
    {
      label: 'LP',
      type: 'LOW_PASS',
      enabled: processorBoolean('lowPassEnabled', false),
      frequency: processorNumber('lowPassFrequency', 20_000),
      gain: 0,
      slope: processorSlope('lowPassSlope'),
    },
  )
  return bands
}

function dynamicSettings(): EqBand[] {
  return Array.from({ length: 6 }, (_, offset) => {
    const index = offset + 1
    return {
      label: `B${index}`,
      type: 'BELL' as const,
      enabled: processorBoolean(`band${index}Enabled`, false),
      frequency: processorNumber(
        `band${index}Frequency`,
        [80, 180, 450, 1_200, 3_500, 8_500][offset] || 1_000,
      ),
      gain: processorNumber(`band${index}Range`, 0),
      q: processorNumber(`band${index}Q`, 1),
    }
  })
}

function toneSettings(): EqBand[] {
  const bands: EqBand[] = [
    {
      label: 'BASS',
      type: 'LOW_SHELF',
      enabled: true,
      frequency: 302.04,
      gain: processorNumber('bass', 0),
    },
  ]
  if (props.processor.subType === 'T3_KNOB') {
    bands.push({
      label: 'MID',
      type: 'BELL',
      enabled: true,
      frequency: 1_208.16,
      gain: processorNumber('middle', 0),
      q: 1_208.16 / 4_832.64,
    })
  }
  bands.push({
    label: 'TREBLE',
    type: 'HIGH_SHELF',
    enabled: true,
    frequency: 4_063.75,
    gain: processorNumber('treble', 0),
  })
  return bands
}

function eqBands(): EqBand[] {
  if (props.processor.type === 'TONE') return toneSettings()
  if (props.processor.subType === 'TEN_BANDS') return tenBandSettings()
  if (props.processor.subType === 'DYNAMIC') return dynamicSettings()
  return parametricSettings()
}

function simpleSaturatorTone(): EqBand[] {
  return [
    {
      label: 'BASS',
      type: 'LOW_SHELF',
      enabled: true,
      frequency: 302.04,
      gain: processorNumber('bass', 0),
    },
    {
      label: 'TREBLE',
      type: 'HIGH_SHELF',
      enabled: true,
      frequency: 4_063.75,
      gain: processorNumber('treble', 0),
    },
  ]
}

function multibandSaturatorBands(): EqBand[] {
  const definitions = [
    ['LOW', 'low', 'CROSSOVER_LOW', 120, undefined],
    ['LOW MID', 'lowMid', 'CROSSOVER_BAND', 120, 800],
    ['HIGH MID', 'highMid', 'CROSSOVER_BAND', 800, 4_000],
    ['HIGH', 'high', 'CROSSOVER_HIGH', 4_000, undefined],
  ] as const
  return definitions.map(
    ([label, prefix, type, frequency, highFrequency]) => {
      const drive = processorNumber(`${prefix}Drive`, 0)
      const mix = processorNumber(`${prefix}Mix`, 0)
      const gain = processorNumber(`${prefix}Gain`, 0)
      return {
        label,
        type,
        enabled: true,
        frequency,
        highFrequency,
        gain,
        detail: `D ${drive.toFixed(1)} dB · M ${mix.toFixed(0)}% · G ${gain.toFixed(1)} dB`,
      }
    },
  )
}

function saturatorAlgorithm(): string {
  return processorString('algorithm', 'COSINE')
}

function saturatorAmount(): number {
  return processorNumber('saturation', 1)
}

function saturatorAsymmetry(): boolean {
  return processorBoolean('asymmetry', false)
}

function visualizationCount(): number {
  if (props.processor.type === 'COMPRESS') return compressorCurves().length
  if (props.processor.type === 'SATURATE') return 2
  return 1
}
</script>

<template>
  <div
    class="processor-visualizations"
    :data-count="visualizationCount()"
  >
    <template v-if="processor.type === 'COMPRESS'">
      <CompressorTransferPreview
        v-for="curve in compressorCurves()"
        :key="curve.label"
        :curves="[curve]"
      />
    </template>
    <LimiterTransferPreview
      v-else-if="processor.type === 'LIMIT'"
      :settings="limiterSettings()"
    />
    <EqFrequencyResponse
      v-else-if="processor.type === 'EQUALIZE' || processor.type === 'TONE'"
      :bands="eqBands()"
      :sample-rate="sampleRate"
      :input-gain="processor.type === 'TONE' || processor.subType === 'TEN_BANDS' ? 0 : processorNumber('inputGain', 0)"
      :output-gain="processor.type === 'TONE' || processor.subType === 'TEN_BANDS' ? 0 : processorNumber('outputGain', 0)"
      :dry-wet="processor.type === 'TONE' || processor.subType === 'TEN_BANDS' ? 100 : processorNumber('dryWet', 100)"
      :dynamic="processor.subType === 'DYNAMIC'"
    />
    <template v-else-if="processor.type === 'SATURATE'">
      <TransferFunctionPreview
        :algorithm="saturatorAlgorithm()"
        :saturation="saturatorAmount()"
        :asymmetry="saturatorAsymmetry()"
      />
      <EqFrequencyResponse
        v-if="processor.subType === 'MULTIBAND'"
        :bands="multibandSaturatorBands()"
        :sample-rate="sampleRate"
        :input-gain="processorNumber('inputGain', 0)"
        :output-gain="processorNumber('outputGain', 0)"
        :dry-wet="processorNumber('dryWet', 100)"
        parallel
        note="Linkwitz-Riley band response with post-band Gain. Drive and Mix change the nonlinear coloration and are shown in the band legend."
      />
      <EqFrequencyResponse
        v-else
        :bands="simpleSaturatorTone()"
        :sample-rate="sampleRate"
        :note="`Tone section in ${processorString('toneControlPosition', 'POST')} position; the nonlinear saturation stage is shown separately.`"
      />
    </template>
    <div v-else class="visualization-unavailable">
      No dedicated visualization is available for this processor yet.
    </div>
  </div>
</template>
