export type ParameterValue = string | number | boolean | null
export type AudioTopology = 'MONO' | 'STEREO'
export type OutputFormat = 'WAV' | 'AIFF'
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface ParamRegion {
  startFrame: number
  endFrame: number
  value: string
  confidence?: number | null
}

export interface ParameterSourceProvenance {
  inputId: string
  sha256: string
}

export interface ParameterDraft {
  value: ParameterValue
  regions: ParamRegion[]
  source?: ParameterSourceProvenance
}

export interface ProcessorParam {
  name: string
  type: string | null
  min: number | null
  max: number | null
  step?: number | null
  rangeBy?: string | null
  ranges?: Record<string, { min?: number | null; max?: number | null }>
  defaultValue: ParameterValue
  unit: string | null
  options: string[]
  description: string | null
  regional: boolean
  sourceDerived: boolean
}

export interface Processor {
  id: string
  name: string
  type: string
  subType: string
  genre: string
  inputTypes: string[]
  outputType: string
  sourceBinding: string
  description: string
  useWhen: string[]
  perceivedEffect: string
  category: string
  position: string
  params: ProcessorParam[]
}

export interface ProcessorListResponse {
  processors: Processor[]
}

export interface AudioInput {
  id: string
  fileName: string
  format: OutputFormat
  sizeBytes: number
  sampleRate: number
  channels: number
  totalFrames: number
  durationSeconds: number
  sha256: string
  contentUrl: string
}

export interface AudioInputListResponse {
  inputs: AudioInput[]
}

export interface InputBinding {
  chainIndex: number
  inputIndex: number
  inputId: string
}

export interface OutputBinding {
  chainIndex: number
  outputIndex: number
  fileName: string
  format: OutputFormat
}

export interface BoundChainRequest {
  chainYaml: string
  inputBindings: InputBinding[]
  outputBindings: OutputBinding[]
  overwriteExisting: boolean
}

export interface ValidationIssue {
  code: string
  message: string
  path: string
}

export interface ChainValidationResponse {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface JobSubmittedResponse {
  jobId: string
  status: JobState
  createdAt: string
  statusUrl: string
}

export interface JobStatusResponse {
  jobId: string
  status: JobState
  progress: number | null
  message: string | null
  chainPath: string | null
  outputPath: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export interface JobLogsResponse {
  jobId: string
  lines: string[]
}

export interface JobOutput {
  index: number
  chainName: string
  path: string
  fileName: string
  format: OutputFormat
  sizeBytes: number | null
  available: boolean
  downloadUrl: string
  contentUrl: string
}

export interface JobOutputsResponse {
  jobId: string
  status: JobState
  outputs: JobOutput[]
}

export interface ChainEffectDraft {
  key: string
  processorId: string
  enabled: boolean
  params: Record<string, ParameterDraft>
}

export interface ChainDraft {
  name: string
  inputId: string
  outputBaseName: string
  outputFormat: OutputFormat
  overwriteExisting: boolean
  effects: ChainEffectDraft[]
}
