import type {
  AudioInput,
  ChainDraft,
  ParameterDraft,
  ParameterValue,
  Processor,
} from '@/types/maze'
import type { MazeAiGenerationResult } from '@/types/mazeAi'

function sourceDerivedValue(
  name: string,
  fallback: ParameterValue,
  result: MazeAiGenerationResult,
): ParameterValue {
  const values: Record<string, ParameterValue> = {
    analysisSourceSha256: result.source.sha256,
    analysisSampleRate: result.source.sampleRate,
    analysisChannels: result.source.channels,
    analysisTotalFrames: result.source.totalFrames,
    analysisSchemaVersion: 1,
  }
  return values[name] ?? fallback
}

function defaultParameters(
  processor: Processor,
  result: MazeAiGenerationResult,
): Record<string, ParameterDraft> {
  return Object.fromEntries(
    processor.params.map((param) => [
      param.name,
      {
        value: param.sourceDerived
          ? sourceDerivedValue(param.name, param.defaultValue, result)
          : param.defaultValue,
        regions: [],
        source: param.sourceDerived
          ? {
              inputId: result.source.inputId,
              sha256: result.source.sha256,
            }
          : undefined,
      },
    ]),
  )
}

export function proposalCompatibilityIssues(
  result: MazeAiGenerationResult,
  processors: Processor[],
  input: AudioInput | undefined,
  expectedCatalogFingerprint: string | undefined,
  expectedMazeAiVersion: string | undefined,
): string[] {
  const issues: string[] = []
  const byId = new Map(processors.map((processor) => [processor.id, processor]))

  if (result.schemaVersion !== 1) {
    issues.push(`Unsupported proposal schema ${result.schemaVersion}`)
  }
  if (
    expectedMazeAiVersion &&
    result.mazeAiVersion !== expectedMazeAiVersion
  ) {
    issues.push(
      `Proposal version ${result.mazeAiVersion} differs from MazeAI ${expectedMazeAiVersion}`,
    )
  }
  if (
    expectedCatalogFingerprint &&
    result.processorCatalogFingerprint !== expectedCatalogFingerprint
  ) {
    issues.push('The MazeAI processor catalog changed after generation')
  }
  if (!input || input.id !== result.source.inputId) {
    issues.push('Select the managed input used to generate this proposal')
  } else if (
    input.sha256 !== result.source.sha256 ||
    input.sampleRate !== result.source.sampleRate ||
    input.channels !== result.source.channels ||
    input.totalFrames !== result.source.totalFrames
  ) {
    issues.push('The selected managed input no longer matches the analyzed source')
  }

  for (const effect of result.proposal.effects) {
    const processor = byId.get(effect.processorId)
    if (!processor) {
      issues.push(`Processor ${effect.processorId} is absent from Maze REST`)
      continue
    }
    const parameterNames = new Set(processor.params.map((param) => param.name))
    for (const parameter of effect.params) {
      if (!parameterNames.has(parameter.name)) {
        issues.push(
          `Parameter ${effect.processorId}.${parameter.name} is absent from Maze REST`,
        )
      }
    }
  }
  return issues
}

export function proposalToChainDraft(
  result: MazeAiGenerationResult,
  currentDraft: ChainDraft,
  processors: Processor[],
): ChainDraft {
  const byId = new Map(processors.map((processor) => [processor.id, processor]))

  return {
    name: result.proposal.chainName,
    inputId: result.source.inputId,
    outputBaseName: currentDraft.outputBaseName,
    outputFormat: currentDraft.outputFormat,
    overwriteExisting: currentDraft.overwriteExisting,
    effects: result.proposal.effects.map((proposed, index) => {
      const processor = byId.get(proposed.processorId)
      if (!processor) {
        throw new Error(
          `Cannot accept unknown Maze processor ${proposed.processorId}`,
        )
      }
      const definitions = new Map(
        processor.params.map((param) => [param.name, param]),
      )
      const params = defaultParameters(processor, result)

      for (const parameter of proposed.params) {
        const definition = definitions.get(parameter.name)
        if (!definition) {
          throw new Error(
            `Cannot accept unknown parameter ${proposed.processorId}.${parameter.name}`,
          )
        }
        params[parameter.name] = {
          value: parameter.value,
          regions: parameter.regions.map((region) => ({
            startFrame: region.startFrame,
            endFrame: region.endFrame,
            value: region.value,
            confidence: region.confidence,
          })),
          source: definition.sourceDerived
            ? {
                inputId: result.source.inputId,
                sha256: result.source.sha256,
              }
            : undefined,
        }
      }

      return {
        key: `effect-${index + 1}`,
        processorId: proposed.processorId,
        enabled: proposed.enabled,
        params,
      }
    }),
  }
}
