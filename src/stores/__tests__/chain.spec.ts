import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useChainStore } from '@/stores/chain'
import { isSafeOutputName } from '@/stores/chain'
import type { AudioInput, Processor } from '@/types/maze'

const compressor: Processor = {
  id: 'PR-DYN-SI-CO-01',
  name: 'Compressor',
  type: 'COMPRESS',
  subType: 'SIMPLE',
  genre: 'FIXED',
  inputTypes: ['MONO', 'STEREO'],
  outputType: 'PRESERVE',
  sourceBinding: 'NONE',
  description: 'Test compressor',
  useWhen: [],
  perceivedEffect: 'controlled',
  category: 'dynamics',
  position: 'middle',
  params: [
    {
      name: 'threshold',
      type: null,
      min: -80,
      max: 0,
      defaultValue: -18,
      unit: 'dBFS',
      options: [],
      description: 'Compression threshold',
      regional: false,
      sourceDerived: false,
    },
  ],
}

const voice: Processor = {
  ...compressor,
  id: 'PR-VOI-BA-VE-01',
  name: 'Voice Enhancer',
  type: 'VOICE_ENHANCE',
  sourceBinding: 'REQUIRED',
  params: [
    {
      name: 'analysisSourceSha256',
      type: null,
      min: null,
      max: null,
      defaultValue: '0'.repeat(64),
      unit: 'sha256',
      options: [],
      description: 'Source hash',
      regional: false,
      sourceDerived: true,
    },
    {
      name: 'breathReductionDb',
      type: null,
      min: -18,
      max: 0,
      defaultValue: 0,
      unit: 'dB',
      options: [],
      description: 'Regional breath reduction',
      regional: true,
      sourceDerived: false,
    },
  ],
}

const input: AudioInput = {
  id: 'managed-input-id',
  fileName: 'voice.wav',
  format: 'WAV',
  sizeBytes: 4096,
  sampleRate: 48_000,
  channels: 1,
  totalFrames: 96_000,
  durationSeconds: 2,
  sha256: 'a'.repeat(64),
  contentUrl: '/api/audio/inputs/managed-input-id/content',
}

describe('chain store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adds defaults and serializes an indexed, bound Maze chain', () => {
    const store = useChainStore()
    store.bindInput(input, [compressor])
    store.setOutputBaseName('result')

    store.addProcessor(compressor)

    expect(store.draft.effects[0]?.params.threshold?.value).toBe(-18)
    expect(store.yaml).toContain('- id: PR-DYN-SI-CO-01')
    expect(store.yaml).toContain('value: "-18"')
    expect(store.yaml).toContain('name: "managed-input-0"')
    expect(store.yaml).not.toContain('C:/')
    expect(store.request.inputBindings).toEqual([
      { chainIndex: 0, inputIndex: 0, inputId: input.id },
    ])
    expect(store.request.outputBindings).toEqual([
      { chainIndex: 0, outputIndex: 0, fileName: 'result', format: 'WAV' },
    ])
  })

  it('keeps bypassed processors in the draft but omits them from Maze YAML', () => {
    const store = useChainStore()
    store.addProcessor(compressor)
    store.toggleEffect(store.draft.effects[0]!.key)

    expect(store.draft.effects).toHaveLength(1)
    expect(store.yaml).not.toContain('PR-DYN-SI-CO-01')
  })

  it('binds source-derived values and preserves regional frame data', () => {
    const store = useChainStore()
    store.bindInput(input, [voice])
    store.addProcessor(voice, input)
    const effect = store.draft.effects[0]!
    store.setRegions(effect.key, 'breathReductionDb', [
      {
        startFrame: 120,
        endFrame: 480,
        value: '-4.5',
        confidence: 0.91,
      },
    ])

    expect(effect.params.analysisSourceSha256).toEqual({
      value: input.sha256,
      regions: [],
      source: { inputId: input.id, sha256: input.sha256 },
    })
    expect(store.yaml).toContain(`value: "${input.sha256}"`)
    expect(store.yaml).toContain('startFrame: 120')
    expect(store.yaml).toContain('endFrame: 480')
    expect(store.yaml).toContain('confidence: 0.91')
  })

  it('rejects unsafe and mismatched output names locally', () => {
    expect(isSafeOutputName('../escape', 'WAV')).toBe(false)
    expect(isSafeOutputName('render.aiff', 'WAV')).toBe(false)
    expect(isSafeOutputName('render.wav', 'WAV')).toBe(true)
    expect(isSafeOutputName('render', 'AIFF')).toBe(true)
  })
})
