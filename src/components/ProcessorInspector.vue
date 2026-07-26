<script setup lang="ts">
import ProcessorGlyph from '@/components/ProcessorGlyph.vue'
import type {
  ChainEffectDraft,
  ParameterValue,
  Processor,
  ProcessorParam,
} from '@/types/maze'

defineProps<{
  effect?: ChainEffectDraft
  processor?: Processor
}>()

const emit = defineEmits<{
  update: [name: string, value: ParameterValue]
  toggle: []
  remove: []
}>()

function isBoolean(param: ProcessorParam): boolean {
  return typeof param.defaultValue === 'boolean'
}

function isNumeric(param: ProcessorParam): boolean {
  return typeof param.min === 'number' && typeof param.max === 'number'
}

function value(effect: ChainEffectDraft, param: ProcessorParam): ParameterValue {
  return effect.params[param.name]?.value ?? null
}

function regionCount(effect: ChainEffectDraft, param: ProcessorParam): number {
  return effect.params[param.name]?.regions.length || 0
}

function updateText(param: ProcessorParam, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('update', param.name, isNumeric(param) ? Number(value) : value)
}

function updateBoolean(param: ProcessorParam, event: Event) {
  emit('update', param.name, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <aside class="panel inspector-panel">
    <div class="panel-heading">Selected processor</div>

    <div v-if="!effect || !processor" class="empty-panel inspector-empty">
      Select a processor in the chain to edit its parameters.
    </div>

    <template v-else>
      <header class="inspector-header">
        <div class="processor-icon large">
          <ProcessorGlyph :type="processor.type" />
        </div>
        <div>
          <strong>{{ processor.name }}</strong>
          <small>{{ processor.id }}</small>
        </div>
        <button
          class="power-button"
          :class="{ active: effect.enabled }"
          type="button"
          title="Toggle processor"
          @click="$emit('toggle')"
        >
          ◉
        </button>
      </header>

      <p class="processor-description">{{ processor.description }}</p>

      <div v-if="processor.sourceBinding === 'REQUIRED'" class="source-binding-notice">
        <strong>Source-bound processor</strong>
        <span>
          Fingerprint fields follow the selected managed input. Regional frame data is
          preserved but edited outside this UI.
        </span>
      </div>

      <div class="parameter-list">
        <label v-for="param in processor.params" :key="param.name" class="parameter-control">
          <span class="parameter-label">
            <span>{{ param.name }}</span>
            <span class="parameter-flags">
              <small v-if="param.regional" class="region-badge">
                Regional · {{ regionCount(effect, param) }}
              </small>
              <small v-if="param.sourceDerived" class="source-badge">Source</small>
              <small v-if="param.unit">{{ param.unit }}</small>
            </span>
          </span>

          <input
            v-if="param.sourceDerived"
            type="text"
            :value="value(effect, param)"
            readonly
            title="Derived from the selected managed input"
          />

          <select
            v-else-if="param.options?.length"
            :value="value(effect, param)"
            @change="updateText(param, $event)"
          >
            <option v-for="option in param.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>

          <input
            v-else-if="isBoolean(param)"
            class="toggle-control"
            type="checkbox"
            :checked="Boolean(value(effect, param))"
            @change="updateBoolean(param, $event)"
          />

          <div v-else-if="isNumeric(param)" class="number-control">
            <input
              type="range"
              :min="param.min ?? undefined"
              :max="param.max ?? undefined"
              :step="0.01"
              :value="value(effect, param)"
              @input="updateText(param, $event)"
            />
            <input
              type="number"
              :min="param.min ?? undefined"
              :max="param.max ?? undefined"
              :step="0.01"
              :value="value(effect, param)"
              @change="updateText(param, $event)"
            />
          </div>

          <input
            v-else
            type="text"
            :value="value(effect, param)"
            @change="updateText(param, $event)"
          />

          <small v-if="param.regional" class="regional-note">
            Existing source-frame regions are kept unchanged during serialization.
          </small>
          <small v-if="param.description" class="parameter-description">
            {{ param.description }}
          </small>
        </label>
      </div>

      <button class="button danger-button" type="button" @click="$emit('remove')">
        Remove processor
      </button>
    </template>
  </aside>
</template>
