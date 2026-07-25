import { defineStore } from 'pinia'

import type {
  ChainDraft,
  ChainEffectDraft,
  ParameterValue,
  Processor,
} from '@/types/maze'

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function defaultDraft(): ChainDraft {
  return {
    name: 'New chain',
    inputPath: '',
    outputPath: '',
    effects: [],
  }
}

export const useChainStore = defineStore('chain', {
  state: () => ({
    draft: defaultDraft(),
    selectedEffectKey: null as string | null,
    dirty: false,
    nextKey: 1,
  }),

  getters: {
    selectedEffect(state): ChainEffectDraft | undefined {
      return state.draft.effects.find((effect) => effect.key === state.selectedEffectKey)
    },

    yaml(state): string {
      const lines = [
        'chains:',
        `  - name: ${yamlString(state.draft.name)}`,
        '    flow:',
        '      inputs:',
        `        - name: ${yamlString(state.draft.inputPath)}`,
        '      effects:',
      ]

      const enabledEffects = state.draft.effects.filter((effect) => effect.enabled)
      if (enabledEffects.length === 0) {
        lines.push('        []')
      } else {
        for (const effect of enabledEffects) {
          lines.push(`        - id: ${effect.processorId}`)
          lines.push('          params:')
          const params = Object.entries(effect.params)
          if (params.length === 0) {
            lines.push('            []')
          } else {
            for (const [name, value] of params) {
              lines.push(`            - name: ${name}`)
              lines.push(`              value: ${yamlString(String(value ?? ''))}`)
            }
          }
        }
      }

      lines.push('      outputs:')
      lines.push(`        - name: ${yamlString(state.draft.outputPath)}`)
      return `${lines.join('\n')}\n`
    },
  },

  actions: {
    addProcessor(processor: Processor) {
      const params = Object.fromEntries(
        processor.params.map((param) => [param.name, param.defaultValue]),
      )
      const effect: ChainEffectDraft = {
        key: `effect-${this.nextKey++}`,
        processorId: processor.id,
        enabled: true,
        params,
      }
      this.draft.effects.push(effect)
      this.selectedEffectKey = effect.key
      this.dirty = true
    },

    selectEffect(key: string | null) {
      this.selectedEffectKey = key
    },

    setParameter(key: string, name: string, value: ParameterValue) {
      const effect = this.draft.effects.find((candidate) => candidate.key === key)
      if (!effect) return
      effect.params[name] = value
      this.dirty = true
    },

    toggleEffect(key: string) {
      const effect = this.draft.effects.find((candidate) => candidate.key === key)
      if (!effect) return
      effect.enabled = !effect.enabled
      this.dirty = true
    },

    moveEffect(key: string, direction: -1 | 1) {
      const index = this.draft.effects.findIndex((effect) => effect.key === key)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= this.draft.effects.length) return
      const [effect] = this.draft.effects.splice(index, 1)
      this.draft.effects.splice(destination, 0, effect)
      this.dirty = true
    },

    removeEffect(key: string) {
      const index = this.draft.effects.findIndex((effect) => effect.key === key)
      if (index < 0) return
      this.draft.effects.splice(index, 1)
      if (this.selectedEffectKey === key) this.selectedEffectKey = null
      this.dirty = true
    },

    reset() {
      this.draft = defaultDraft()
      this.selectedEffectKey = null
      this.dirty = false
      this.nextKey = 1
    },
  },
})
