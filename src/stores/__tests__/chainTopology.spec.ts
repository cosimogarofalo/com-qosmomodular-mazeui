import { describe, expect, it } from 'vitest'

import { deriveTopology } from '@/services/chainTopology'
import type { AudioInput, ChainEffectDraft, Processor } from '@/types/maze'

const monoInput: AudioInput = {
  id: 'mono',
  fileName: 'mono.wav',
  format: 'WAV',
  sizeBytes: 100,
  sampleRate: 48_000,
  channels: 1,
  totalFrames: 48_000,
  durationSeconds: 1,
  sha256: 'a'.repeat(64),
  contentUrl: '/api/audio/inputs/mono/content',
}

function processor(
  id: string,
  inputTypes: string[],
  outputType: string,
): Processor {
  return {
    id,
    name: id,
    type: 'TEST',
    subType: 'TEST',
    genre: 'FIXED',
    inputTypes,
    outputType,
    sourceBinding: 'NONE',
    description: '',
    useWhen: [],
    perceivedEffect: '',
    category: 'test',
    position: 'middle',
    params: [],
  }
}

function effect(key: string, processorId: string, enabled = true): ChainEffectDraft {
  return { key, processorId, enabled, params: {} }
}

describe('chain topology', () => {
  it('keeps PRESERVE stages in the native mono topology', () => {
    const gain = processor('gain', ['MONO', 'STEREO'], 'PRESERVE')
    const result = deriveTopology(monoInput, [effect('one', 'gain')], [gain])

    expect(result.compatible).toBe(true)
    expect(result.output).toBe('MONO')
    expect(result.stages[0]).toMatchObject({
      input: 'MONO',
      output: 'MONO',
      compatible: true,
    })
  })

  it('marks the stereo-only Imager contract incompatible with mono', () => {
    const imager = processor('imager', ['STEREO'], 'STEREO')
    const result = deriveTopology(monoInput, [effect('one', 'imager')], [imager])

    expect(result.compatible).toBe(false)
    expect(result.stages[0]?.compatible).toBe(false)
  })

  it('ignores bypassed stages when deriving downstream topology', () => {
    const imager = processor('imager', ['STEREO'], 'STEREO')
    const gain = processor('gain', ['MONO', 'STEREO'], 'PRESERVE')
    const result = deriveTopology(
      monoInput,
      [effect('one', 'imager', false), effect('two', 'gain')],
      [imager, gain],
    )

    expect(result.compatible).toBe(true)
    expect(result.stages).toHaveLength(1)
    expect(result.stages[0]?.effectKey).toBe('two')
  })
})
