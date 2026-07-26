import type {
  AudioInput,
  AudioTopology,
  ChainEffectDraft,
  Processor,
} from '@/types/maze'

export interface TopologyStage {
  effectKey: string
  input: AudioTopology
  output: AudioTopology
  compatible: boolean
}

export interface TopologyResult {
  input: AudioTopology | null
  output: AudioTopology | null
  stages: TopologyStage[]
  compatible: boolean
}

export function topologyForInput(input?: AudioInput | null): AudioTopology | null {
  if (input?.channels === 1) return 'MONO'
  if (input?.channels === 2) return 'STEREO'
  return null
}

export function acceptsTopology(
  processor: Processor,
  topology: AudioTopology | null,
): boolean {
  return topology !== null && processor.inputTypes.includes(topology)
}

export function processorOutputTopology(
  processor: Processor,
  input: AudioTopology,
): AudioTopology {
  return processor.outputType === 'PRESERVE'
    ? input
    : (processor.outputType as AudioTopology)
}

export function deriveTopology(
  input: AudioInput | null | undefined,
  effects: ChainEffectDraft[],
  processors: Processor[],
): TopologyResult {
  const sourceTopology = topologyForInput(input)
  let current = sourceTopology
  let compatible = sourceTopology !== null
  const byId = new Map(processors.map((processor) => [processor.id, processor]))
  const stages: TopologyStage[] = []

  for (const effect of effects) {
    if (!effect.enabled) continue
    const processor = byId.get(effect.processorId)
    if (!processor || current === null) {
      compatible = false
      continue
    }

    const stageCompatible = acceptsTopology(processor, current)
    const output = stageCompatible
      ? processorOutputTopology(processor, current)
      : current
    stages.push({
      effectKey: effect.key,
      input: current,
      output,
      compatible: stageCompatible,
    })
    compatible &&= stageCompatible
    if (stageCompatible) current = output
  }

  return {
    input: sourceTopology,
    output: current,
    stages,
    compatible,
  }
}
