import { defineStore } from 'pinia'

import type {
  AudioInput,
  BoundChainRequest,
  ChainDraft,
  ChainEffectDraft,
  OutputFormat,
  ParameterDraft,
  ParameterValue,
  Processor,
} from '@/types/maze'

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function defaultDraft(): ChainDraft {
  return {
    name: 'New chain',
    inputId: '',
    outputBaseName: 'maze-render',
    outputFormat: 'WAV',
    effects: [],
  }
}

function sourceDerivedValue(
  paramName: string,
  fallback: ParameterValue,
  input: AudioInput,
): ParameterValue {
  const values: Record<string, ParameterValue> = {
    analysisSourceSha256: input.sha256,
    analysisSampleRate: input.sampleRate,
    analysisChannels: input.channels,
    analysisTotalFrames: input.totalFrames,
    analysisSchemaVersion: 1,
  }
  return values[paramName] ?? fallback
}

function parameterDraft(
  processor: Processor,
  paramName: string,
  input?: AudioInput | null,
): ParameterDraft {
  const param = processor.params.find((candidate) => candidate.name === paramName)!
  const source = param.sourceDerived && input
    ? { inputId: input.id, sha256: input.sha256 }
    : undefined
  return {
    value:
      param.sourceDerived && input
        ? sourceDerivedValue(param.name, param.defaultValue, input)
        : param.defaultValue,
    regions: [],
    source,
  }
}

function appendParameterYaml(
  lines: string[],
  name: string,
  draft: ParameterDraft,
) {
  lines.push(`            - name: ${yamlString(name)}`)
  lines.push(`              value: ${yamlString(String(draft.value ?? ''))}`)
  if (draft.regions.length === 0) return

  lines.push('              regions:')
  for (const region of draft.regions) {
    lines.push(`                - startFrame: ${region.startFrame}`)
    lines.push(`                  endFrame: ${region.endFrame}`)
    lines.push(`                  value: ${yamlString(region.value)}`)
    if (Object.prototype.hasOwnProperty.call(region, 'confidence')) {
      lines.push(
        `                  confidence: ${region.confidence === null ? 'null' : region.confidence}`,
      )
    }
  }
}

export function isSafeOutputName(value: string, format: OutputFormat): boolean {
  const candidate = value.trim()
  if (
    !candidate ||
    candidate === '.' ||
    candidate === '..' ||
    /[\\/<>"|?*\u0000-\u001f]/.test(candidate)
  ) {
    return false
  }

  const lower = candidate.toLowerCase()
  const isWav = lower.endsWith('.wav') || lower.endsWith('.wave')
  const isAiff = lower.endsWith('.aif') || lower.endsWith('.aiff')
  if (isWav) return format === 'WAV'
  if (isAiff) return format === 'AIFF'
  return true
}

export const useChainStore = defineStore('chain', {
  state: () => ({
    draft: defaultDraft(),
    selectedEffectKey: null as string | null,
    dirty: false,
    nextKey: 1,
    revision: 0,
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
        `        - name: ${yamlString('managed-input-0')}`,
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
            for (const [name, parameter] of params) {
              appendParameterYaml(lines, name, parameter)
            }
          }
        }
      }

      lines.push('      outputs:')
      lines.push(`        - name: ${yamlString('managed-output-0')}`)
      return `${lines.join('\n')}\n`
    },

    request(): BoundChainRequest {
      return {
        chainYaml: this.yaml,
        inputBindings: [
          {
            chainIndex: 0,
            inputIndex: 0,
            inputId: this.draft.inputId,
          },
        ],
        outputBindings: [
          {
            chainIndex: 0,
            outputIndex: 0,
            fileName: this.draft.outputBaseName.trim(),
            format: this.draft.outputFormat,
          },
        ],
      }
    },

    hasRenderableShape(state): boolean {
      return (
        Boolean(state.draft.inputId) &&
        isSafeOutputName(state.draft.outputBaseName, state.draft.outputFormat) &&
        state.draft.effects.some((effect) => effect.enabled)
      )
    },
  },

  actions: {
    changed() {
      this.dirty = true
      this.revision += 1
    },

    addProcessor(processor: Processor, input?: AudioInput | null) {
      const params = Object.fromEntries(
        processor.params.map((param) => [
          param.name,
          parameterDraft(processor, param.name, input),
        ]),
      )
      const effect: ChainEffectDraft = {
        key: `effect-${this.nextKey++}`,
        processorId: processor.id,
        enabled: true,
        params,
      }
      this.draft.effects.push(effect)
      this.selectedEffectKey = effect.key
      this.changed()
    },

    selectEffect(key: string | null) {
      this.selectedEffectKey = key
    },

    setParameter(key: string, name: string, value: ParameterValue) {
      const effect = this.draft.effects.find((candidate) => candidate.key === key)
      if (!effect) return
      const parameter = effect.params[name]
      if (!parameter) return
      parameter.value = value
      this.changed()
    },

    setRegions(key: string, name: string, regions: ParameterDraft['regions']) {
      const effect = this.draft.effects.find((candidate) => candidate.key === key)
      const parameter = effect?.params[name]
      if (!parameter) return
      parameter.regions = regions.map((region) => ({ ...region }))
      this.changed()
    },

    toggleEffect(key: string) {
      const effect = this.draft.effects.find((candidate) => candidate.key === key)
      if (!effect) return
      effect.enabled = !effect.enabled
      this.changed()
    },

    moveEffect(key: string, direction: -1 | 1) {
      const index = this.draft.effects.findIndex((effect) => effect.key === key)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= this.draft.effects.length) return
      const [effect] = this.draft.effects.splice(index, 1)
      this.draft.effects.splice(destination, 0, effect)
      this.changed()
    },

    removeEffect(key: string) {
      const index = this.draft.effects.findIndex((effect) => effect.key === key)
      if (index < 0) return
      this.draft.effects.splice(index, 1)
      if (this.selectedEffectKey === key) this.selectedEffectKey = null
      this.changed()
    },

    setName(name: string) {
      this.draft.name = name
      this.changed()
    },

    setOutputBaseName(name: string) {
      this.draft.outputBaseName = name
      this.changed()
    },

    setOutputFormat(format: OutputFormat) {
      this.draft.outputFormat = format
      this.changed()
    },

    bindInput(input: AudioInput | null, processors: Processor[]) {
      this.draft.inputId = input?.id || ''
      const byId = new Map(processors.map((processor) => [processor.id, processor]))

      for (const effect of this.draft.effects) {
        const processor = byId.get(effect.processorId)
        if (!processor || processor.sourceBinding !== 'REQUIRED') continue
        for (const param of processor.params.filter((candidate) => candidate.sourceDerived)) {
          const draft = effect.params[param.name]
          if (!draft) continue
          draft.value = input
            ? sourceDerivedValue(param.name, param.defaultValue, input)
            : param.defaultValue
          draft.source = input
            ? { inputId: input.id, sha256: input.sha256 }
            : undefined
        }
      }
      this.changed()
    },

    replaceDraft(draft: ChainDraft) {
      this.draft = {
        ...draft,
        effects: draft.effects.map((effect) => ({
          ...effect,
          params: Object.fromEntries(
            Object.entries(effect.params).map(([name, parameter]) => [
              name,
              {
                ...parameter,
                regions: parameter.regions.map((region) => ({ ...region })),
                source: parameter.source ? { ...parameter.source } : undefined,
              },
            ]),
          ),
        })),
      }
      this.selectedEffectKey = null
      this.nextKey = this.draft.effects.length + 1
      this.changed()
    },

    reset() {
      this.draft = defaultDraft()
      this.selectedEffectKey = null
      this.dirty = false
      this.nextKey = 1
      this.revision += 1
    },
  },
})
