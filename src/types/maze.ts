export type ParameterValue = string | number | boolean | null

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface ProcessorParam {
  name: string
  type: string | null
  min: number | null
  max: number | null
  defaultValue: ParameterValue
  unit: string | null
  options: string[]
  description: string | null
}

export interface Processor {
  id: string
  name: string
  type: string
  subType: string
  genre: string
  inputType: string
  outputType: string
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
  status: string
  statusUrl: string
}

export interface ChainEffectDraft {
  key: string
  processorId: string
  enabled: boolean
  params: Record<string, ParameterValue>
}

export interface ChainDraft {
  name: string
  inputPath: string
  outputPath: string
  effects: ChainEffectDraft[]
}
