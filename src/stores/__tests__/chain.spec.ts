import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useChainStore } from '@/stores/chain'
import type { Processor } from '@/types/maze'

const compressor: Processor = {
  id: 'PR-DYN-SI-CO-01',
  name: 'Compressor',
  type: 'COMPRESS',
  subType: 'SIMPLE',
  genre: 'FIXED',
  inputType: 'STEREO',
  outputType: 'STEREO',
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
    },
  ],
}

describe('chain store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adds a processor with defaults and serializes a Maze chain', () => {
    const store = useChainStore()
    store.draft.inputPath = 'C:/audio-in/source.wav'
    store.draft.outputPath = 'C:/audio-out/result.wav'

    store.addProcessor(compressor)

    expect(store.draft.effects[0]?.params.threshold).toBe(-18)
    expect(store.yaml).toContain('- id: PR-DYN-SI-CO-01')
    expect(store.yaml).toContain('value: "-18"')
  })

  it('keeps bypassed processors in the draft but omits them from Maze YAML', () => {
    const store = useChainStore()
    store.addProcessor(compressor)
    store.toggleEffect(store.draft.effects[0]!.key)

    expect(store.draft.effects).toHaveLength(1)
    expect(store.yaml).not.toContain('PR-DYN-SI-CO-01')
  })
})
