<script setup lang="ts">
import CompressorTransferPreview from '@/components/CompressorTransferPreview.vue'
import LimiterTransferPreview from '@/components/LimiterTransferPreview.vue'
import type { ChainEffectDraft, Processor } from '@/types/maze'

const props = defineProps<{
  effect: ChainEffectDraft
  processor: Processor
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
</script>

<template>
  <div
    class="processor-visualizations"
    :data-count="processor.type === 'COMPRESS' ? compressorCurves().length : 1"
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
    <div v-else class="visualization-unavailable">
      No dedicated visualization is available for this processor yet.
    </div>
  </div>
</template>
