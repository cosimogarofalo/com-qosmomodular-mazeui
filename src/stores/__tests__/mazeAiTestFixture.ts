import fixtureJson from '@/mazeAiGeneratedChain.fixture.json'
import type { AudioInput, Processor, ProcessorParam } from '@/types/maze'
import type {
  MazeAiCapabilitiesResponse,
  MazeAiGenerationResult,
  MazeAiHealthResponse,
} from '@/types/mazeAi'

export const mazeAiResult = fixtureJson as unknown as MazeAiGenerationResult

function parameter(
  name: string,
  defaultValue: ProcessorParam['defaultValue'],
  options: string[] = [],
  sourceDerived = false,
  regional = false,
): ProcessorParam {
  return {
    name,
    type: typeof defaultValue,
    min: typeof defaultValue === 'number' ? -100 : null,
    max: typeof defaultValue === 'number' ? 100 : null,
    defaultValue,
    unit: null,
    options,
    description: name,
    regional,
    sourceDerived,
  }
}

const processorBase: Omit<Processor, 'id' | 'name' | 'type' | 'sourceBinding' | 'params'> = {
  subType: 'BASIC',
  genre: 'FIXED',
  inputTypes: ['MONO', 'STEREO'],
  outputType: 'PRESERVE',
  description: 'MazeAI fixture processor',
  useWhen: [],
  perceivedEffect: 'fixture',
  category: 'fixture',
  position: 'middle',
}

export const voiceProcessor: Processor = {
  ...processorBase,
  id: 'PR-VOI-BA-VE-01',
  name: 'Voice Enhancer',
  type: 'VOICE_ENHANCE',
  sourceBinding: 'REQUIRED',
  params: [
    parameter('analysisSourceSha256', '0'.repeat(64), [], true),
    parameter('analysisSampleRate', 0, [], true),
    parameter('analysisChannels', 0, [], true),
    parameter('analysisTotalFrames', 0, [], true),
    parameter('analysisSchemaVersion', 1, [], true),
    parameter('falseStartMode', 'KEEP', ['KEEP', 'REMOVE']),
    parameter('falseStartAction', 'KEEP', ['KEEP', 'REMOVE'], false, true),
    parameter('voiceGainDb', 0),
  ],
}

export const toneProcessor: Processor = {
  ...processorBase,
  id: 'PR-FLT-2K-TO-01',
  name: 'Tone',
  type: 'TONE',
  sourceBinding: 'NONE',
  params: [
    parameter('bass', 0),
    parameter('treble', 0),
  ],
}

export const mazeAiProcessors = [voiceProcessor, toneProcessor]

export const mazeAiInput: AudioInput = {
  id: mazeAiResult.source.inputId,
  fileName: mazeAiResult.source.fileName,
  format: 'WAV',
  sizeBytes: 8_192,
  sampleRate: mazeAiResult.source.sampleRate,
  channels: mazeAiResult.source.channels,
  totalFrames: mazeAiResult.source.totalFrames,
  durationSeconds: mazeAiResult.source.durationMs / 1_000,
  sha256: mazeAiResult.source.sha256,
  contentUrl: `/api/audio/inputs/${mazeAiResult.source.inputId}/content`,
}

export const mazeAiHealth: MazeAiHealthResponse = {
  service: 'mazeai',
  version: mazeAiResult.mazeAiVersion,
  schemaVersion: 1,
  ready: true,
}

export const mazeAiCapabilities: MazeAiCapabilitiesResponse = {
  schemaVersion: 1,
  mazeAiVersion: mazeAiResult.mazeAiVersion,
  generationReady: true,
  audioFormats: ['WAV', 'AIFF'],
  contentHints: ['AUTO', 'SPEECH', 'MUSIC', 'MIXED', 'UNKNOWN'],
  semanticEditModes: ['KEEP', 'ATTENUATE', 'REMOVE'],
  analyzers: ['content-type', 'false-start'],
  transcriptCapabilities: ['SOURCE_BOUND_TIMED'],
  processorCatalogFingerprint: mazeAiResult.processorCatalogFingerprint,
}
