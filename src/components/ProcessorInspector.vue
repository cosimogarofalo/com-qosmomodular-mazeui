<script setup lang="ts">
import CompressorTransferPreview from '@/components/CompressorTransferPreview.vue'
import LfoWavePreview from '@/components/LfoWavePreview.vue'
import ProcessorGlyph from '@/components/ProcessorGlyph.vue'
import TransferFunctionPreview from '@/components/TransferFunctionPreview.vue'
import type {
  ChainEffectDraft,
  ParameterValue,
  Processor,
  ProcessorParam,
} from '@/types/maze'

const props = defineProps<{
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

function isLfoWave(param: ProcessorParam): boolean {
  return param.name.toLowerCase() === 'lfowave'
}

function isSaturationAlgorithm(
  processor: Processor,
  param: ProcessorParam,
): boolean {
  return processor.type === 'SATURATE' && param.name.toLowerCase() === 'algorithm'
}

function saturationAmount(
  effect: ChainEffectDraft,
  processor: Processor,
): number {
  const fallback = processor.params.find((param) => param.name === 'saturation')
    ?.defaultValue
  const amount = Number(effect.params.saturation?.value ?? fallback ?? 1)
  return Number.isFinite(amount) ? amount : 1
}

function saturationAsymmetry(effect: ChainEffectDraft): boolean {
  return String(effect.params.asymmetry?.value ?? false).toLowerCase() === 'true'
}

function processorNumber(
  effect: ChainEffectDraft,
  processor: Processor,
  name: string,
  fallback: number,
): number {
  const contractDefault = processor.params.find((param) => param.name === name)
    ?.defaultValue
  const number = Number(effect.params[name]?.value ?? contractDefault ?? fallback)
  return Number.isFinite(number) ? number : fallback
}

function compressorCurves(
  effect: ChainEffectDraft,
  processor: Processor,
): Array<{ label: string; threshold: number; ratio: number; knee: number }> {
  if (processor.subType === 'MULTIBAND') {
    const bands = [
      ['LOW', 'low'],
      ['LOW MID', 'lowMid'],
      ['HIGH MID', 'highMid'],
      ['HIGH', 'high'],
    ] as const
    return bands.map(([label, prefix]) => ({
      label,
      threshold: processorNumber(
        effect,
        processor,
        `${prefix}Threshold`,
        -18,
      ),
      ratio: processorNumber(effect, processor, `${prefix}Ratio`, 2),
      knee: processorNumber(
        effect,
        processor,
        `${prefix}Knee`,
        processorNumber(effect, processor, 'knee', 6),
      ),
    }))
  }

  return [
    {
      label: processor.subType === 'BUS' ? 'BUS' : 'WIDEBAND',
      threshold: processorNumber(effect, processor, 'threshold', -18),
      ratio: processorNumber(effect, processor, 'ratio', 2),
      knee: processorNumber(effect, processor, 'knee', 6),
    },
  ]
}

function controllerValue(
  effect: ChainEffectDraft,
  controller: string,
  controllerOverride?: { name: string; value: ParameterValue },
): ParameterValue {
  return controllerOverride?.name === controller
    ? controllerOverride.value
    : effect.params[controller]?.value
}

function allowedOptions(
  effect: ChainEffectDraft,
  param: ProcessorParam,
  controllerOverride?: { name: string; value: ParameterValue },
): string[] {
  if (!param.optionsBy) {
    return param.options
  }
  const selected = controllerValue(effect, param.optionsBy, controllerOverride)
  return param.optionsFor?.[String(selected)] ?? param.options
}

function isVisible(effect: ChainEffectDraft, param: ProcessorParam): boolean {
  if (!param.visibleBy) {
    return true
  }
  const selected = controllerValue(effect, param.visibleBy)
  return param.visibleFor?.includes(String(selected)) ?? true
}

function visibleParams(effect: ChainEffectDraft, processor: Processor): ProcessorParam[] {
  return processor.params.filter((param) => isVisible(effect, param))
}

function value(effect: ChainEffectDraft, param: ProcessorParam): ParameterValue {
  return effect.params[param.name]?.value ?? null
}

function regionCount(effect: ChainEffectDraft, param: ProcessorParam): number {
  return effect.params[param.name]?.regions.length || 0
}

function numericStep(param: ProcessorParam): number {
  if (typeof param.step === 'number' && Number.isFinite(param.step) && param.step > 0) {
    return param.step
  }
  if (param.type?.toLowerCase() === 'integer' || param.name === 'dryWet') {
    return 1
  }
  return 0.01
}

function rangeController(param: ProcessorParam): string | null {
  if (param.rangeBy) {
    return param.rangeBy
  }
  return param.name === 'inputLevel' ? 'inputType' : null
}

function allowedRange(
  effect: ChainEffectDraft,
  param: ProcessorParam,
  controllerOverride?: { name: string; value: ParameterValue },
): { min: number | null; max: number | null } {
  let min = param.min
  let max = param.max
  const controller = rangeController(param)
  if (!controller) {
    return { min, max }
  }
  const controllerValue =
    controllerOverride?.name === controller
      ? controllerOverride.value
      : effect.params[controller]?.value
  const contractRange = param.ranges?.[String(controllerValue)]
  if (typeof contractRange?.min === 'number') {
    min = contractRange.min
  }
  if (typeof contractRange?.max === 'number') {
    max = contractRange.max
  }

  // Compatibility with a catalog cached from a Maze REST version that
  // predates dependent ranges.
  if (!contractRange && param.name === 'inputLevel') {
    if (controllerValue === 'ATT') {
      return { min: -127, max: 0 }
    }
    if (controllerValue === 'AMP') {
      return { min: 0, max: 31 }
    }
  }
  return { min, max }
}

function numericValue(
  effect: ChainEffectDraft,
  param: ProcessorParam,
  rawValue: string,
  controllerOverride?: { name: string; value: ParameterValue },
): number {
  let parsed = Number(rawValue)
  if (param.type?.toLowerCase() === 'integer' || numericStep(param) === 1) {
    parsed = Math.round(parsed)
  }
  const range = allowedRange(effect, param, controllerOverride)
  if (typeof range.min === 'number') {
    parsed = Math.max(range.min, parsed)
  }
  if (typeof range.max === 'number') {
    parsed = Math.min(range.max, parsed)
  }
  return parsed
}

function updateText(effect: ChainEffectDraft, param: ProcessorParam, event: Event) {
  const nextValue = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit(
    'update',
    param.name,
    isNumeric(param) ? numericValue(effect, param, nextValue) : nextValue,
  )
  normalizeDependents(effect, param.name, nextValue)
}

function normalizeDependents(
  effect: ChainEffectDraft,
  controllerName: string,
  controllerValue: ParameterValue,
) {
  for (const dependent of props.processor?.params ?? []) {
    if (isNumeric(dependent) && rangeController(dependent) === controllerName) {
      const currentValue = effect.params[dependent.name]?.value
      const currentNumber = Number(currentValue)
      if (!Number.isFinite(currentNumber)) {
        continue
      }
      const normalized = numericValue(effect, dependent, String(currentNumber), {
        name: controllerName,
        value: controllerValue,
      })
      if (normalized !== currentNumber) {
        emit('update', dependent.name, normalized)
      }
    }

    if (dependent.optionsBy === controllerName) {
      const options = allowedOptions(effect, dependent, {
        name: controllerName,
        value: controllerValue,
      })
      const currentValue = String(effect.params[dependent.name]?.value)
      if (!options.includes(currentValue) && options.length > 0) {
        const defaultValue = String(dependent.defaultValue)
        emit(
          'update',
          dependent.name,
          options.includes(defaultValue) ? defaultValue : options[0],
        )
      }
    }
  }
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

      <CompressorTransferPreview
        v-if="processor.type === 'COMPRESS'"
        :curves="compressorCurves(effect, processor)"
      />

      <div class="parameter-list">
        <label
          v-for="param in visibleParams(effect, processor)"
          :key="param.name"
          class="parameter-control"
        >
          <TransferFunctionPreview
            v-if="isSaturationAlgorithm(processor, param)"
            :algorithm="String(value(effect, param) || 'COSINE')"
            :saturation="saturationAmount(effect, processor)"
            :asymmetry="saturationAsymmetry(effect)"
          />

          <LfoWavePreview
            v-if="isLfoWave(param)"
            :wave="String(value(effect, param) || 'UNIPOLAR_SINE')"
          />

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
            @change="updateText(effect, param, $event)"
          >
            <option
              v-for="option in param.options"
              :key="option"
              :value="option"
              :disabled="!allowedOptions(effect, param).includes(option)"
            >
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
              :step="numericStep(param)"
              :value="value(effect, param)"
              @input="updateText(effect, param, $event)"
            />
            <input
              type="number"
              :min="param.min ?? undefined"
              :max="param.max ?? undefined"
              :step="numericStep(param)"
              :value="value(effect, param)"
              @change="updateText(effect, param, $event)"
            />
          </div>

          <input
            v-else
            type="text"
            :value="value(effect, param)"
            @change="updateText(effect, param, $event)"
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
