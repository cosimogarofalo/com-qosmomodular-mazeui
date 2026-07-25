<script setup lang="ts">
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
        <div class="processor-icon large">∿</div>
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

      <div class="parameter-list">
        <label v-for="param in processor.params" :key="param.name" class="parameter-control">
          <span class="parameter-label">
            <span>{{ param.name }}</span>
            <small v-if="param.unit">{{ param.unit }}</small>
          </span>

          <select
            v-if="param.options?.length"
            :value="effect.params[param.name]"
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
            :checked="Boolean(effect.params[param.name])"
            @change="updateBoolean(param, $event)"
          />

          <div v-else-if="isNumeric(param)" class="number-control">
            <input
              type="range"
              :min="param.min ?? undefined"
              :max="param.max ?? undefined"
              :step="0.01"
              :value="effect.params[param.name]"
              @input="updateText(param, $event)"
            />
            <input
              type="number"
              :min="param.min ?? undefined"
              :max="param.max ?? undefined"
              :step="0.01"
              :value="effect.params[param.name]"
              @change="updateText(param, $event)"
            />
          </div>

          <input
            v-else
            type="text"
            :value="effect.params[param.name]"
            @change="updateText(param, $event)"
          />

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
