<script setup lang="ts">
import { computed } from 'vue'

import ProcessorGlyph from '@/components/ProcessorGlyph.vue'
import type { TopologyStage } from '@/services/chainTopology'
import { processorTone } from '@/services/processorVisuals'
import type { ChainEffectDraft, Processor } from '@/types/maze'

const props = defineProps<{
  effects: ChainEffectDraft[]
  processors: Processor[]
  selectedKey: string | null
  inputName: string
  outputName: string
  topologyStages: TopologyStage[]
}>()

defineEmits<{
  select: [key: string]
  move: [key: string, direction: -1 | 1]
  remove: [key: string]
}>()

const processorsById = computed(
  () => new Map(props.processors.map((processor) => [processor.id, processor])),
)
const topologyByKey = computed(
  () => new Map(props.topologyStages.map((stage) => [stage.effectKey, stage])),
)

function displayName(name: string, fallback: string): string {
  return name || fallback
}

function nodeTone(processor?: Processor): string {
  return processorTone(processor?.type || '')
}
</script>

<template>
  <section class="panel canvas-panel">
    <div class="panel-heading canvas-heading">
      <span>Chain canvas</span>
      <span class="canvas-mode">Linear routing</span>
    </div>

    <div class="canvas-grid">
      <div class="chain-track">
        <article class="chain-node io-node">
          <small>Input</small>
          <div class="wave-glyph">▥</div>
          <strong>{{ displayName(inputName, 'Select input') }}</strong>
        </article>

        <template v-for="(effect, index) in effects" :key="effect.key">
          <div class="connector" />
          <article
            class="chain-node effect-node"
            :class="[
              `tone-${nodeTone(processorsById.get(effect.processorId))}`,
              {
                selected: effect.key === selectedKey,
                disabled: !effect.enabled,
                incompatible: topologyByKey.get(effect.key)?.compatible === false,
              },
            ]"
            tabindex="0"
            @click="$emit('select', effect.key)"
            @keydown.enter="$emit('select', effect.key)"
          >
            <div class="node-title">
              <span class="node-led" />
              <button
                type="button"
                title="Remove processor"
                @click.stop="$emit('remove', effect.key)"
              >
                ×
              </button>
            </div>
            <strong>{{ processorsById.get(effect.processorId)?.name || effect.processorId }}</strong>
            <small>{{ effect.processorId }}</small>
            <small v-if="topologyByKey.get(effect.key)" class="topology-badge">
              {{ topologyByKey.get(effect.key)?.input }}
              →
              {{ topologyByKey.get(effect.key)?.output }}
            </small>
            <div class="node-visual">
              <ProcessorGlyph :type="processorsById.get(effect.processorId)?.type || ''" />
            </div>
            <div class="node-order">
              <button
                type="button"
                :disabled="index === 0"
                title="Move left"
                @click.stop="$emit('move', effect.key, -1)"
              >
                ←
              </button>
              <span>{{ index + 1 }}</span>
              <button
                type="button"
                :disabled="index === effects.length - 1"
                title="Move right"
                @click.stop="$emit('move', effect.key, 1)"
              >
                →
              </button>
            </div>
          </article>
        </template>

        <div v-if="effects.length === 0" class="empty-chain">
          <span>+</span>
          Add a processor from the library
        </div>

        <div class="connector" />
        <article class="chain-node io-node">
          <small>Output</small>
          <div class="wave-glyph">▥</div>
          <strong>{{ displayName(outputName, 'Select output') }}</strong>
        </article>
      </div>
    </div>
  </section>
</template>
