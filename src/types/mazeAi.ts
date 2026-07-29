export type MazeAiContentHint =
  | 'AUTO'
  | 'SPEECH'
  | 'MUSIC'
  | 'MIXED'
  | 'UNKNOWN'

export type MazeAiSemanticEdit = 'KEEP' | 'ATTENUATE' | 'REMOVE'
export type MazeAiTimelineMode = 'AUDIO_ONLY' | 'EXTERNALLY_REFERENCED'
export type MazeAiJobState =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export interface MazeAiApiError {
  code: string
  message: string
  fieldPath: string | null
}

export interface MazeAiHealthResponse {
  service: string
  version: string
  schemaVersion: number
  ready: boolean
}

export interface MazeAiCapabilitiesResponse {
  schemaVersion: number
  mazeAiVersion: string
  generationReady: boolean
  audioFormats: string[]
  contentHints: MazeAiContentHint[]
  semanticEditModes: MazeAiSemanticEdit[]
  analyzers: string[]
  transcriptCapabilities: string[]
  processorCatalogFingerprint: string
}

export interface MazeAiTimedWord {
  text: string
  startFrame: number
  endFrame: number
  confidence: number
}

export interface MazeAiTimedTranscript {
  schemaVersion: number
  sourceSha256: string
  sampleRate: number
  channels: number
  totalFrames: number
  timelineMode: MazeAiTimelineMode
  words: MazeAiTimedWord[]
}

export interface MazeAiGenerationRequest {
  inputId: string
  goal: string
  contentHint: MazeAiContentHint
  semanticEdit: MazeAiSemanticEdit
  transcript: MazeAiTimedTranscript | null
}

export interface MazeAiJobAcceptedResponse {
  chainJobId: string
  state: MazeAiJobState
  createdAt: string
  statusUrl: string
}

export interface MazeAiJobStatusResponse {
  chainJobId: string
  state: MazeAiJobState
  phase: string
  progressPercent: number | null
  message: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  error: MazeAiApiError | null
}

export interface MazeAiJobLogsResponse {
  chainJobId: string
  lines: string[]
  truncated: boolean
}

export interface MazeAiResultSource {
  inputId: string
  fileName: string
  sha256: string
  sampleRate: number
  channels: number
  totalFrames: number
  durationMs: number
}

export interface MazeAiContentClassification {
  classifier: string
  type: string
  confidence: number
  routing: string
  probabilities: Record<string, number>
  evidence: Record<string, number>
  summary: string
}

export interface MazeAiGlobalAnalysis {
  analyzer: string
  status: string
  metrics: Record<string, number>
  summary: string
}

export interface MazeAiAnalysisGrid {
  sampleRate: number
  frameSize: number
  hopSize: number
  sourceFrames: number
}

export interface MazeAiAnalysisRegion {
  label: string
  startFrame: number
  endFrame: number
  confidence: number
  metrics: Record<string, number>
}

export interface MazeAiRegionalAnalysis {
  analyzer: string
  schemaVersion: number
  status: string
  grid: MazeAiAnalysisGrid
  regions: MazeAiAnalysisRegion[]
  metrics: Record<string, number>
  summary: string
}

export interface MazeAiAnalysis {
  contentClassification: MazeAiContentClassification
  global: MazeAiGlobalAnalysis[]
  regional: MazeAiRegionalAnalysis[]
}

export interface MazeAiParamRegion {
  startFrame: number
  endFrame: number
  value: string
  confidence: number | null
}

export interface MazeAiProposedParam {
  name: string
  value: string
  regions: MazeAiParamRegion[]
}

export interface MazeAiProposedEffect {
  processorId: string
  enabled: boolean
  params: MazeAiProposedParam[]
  rationale: string
}

export interface MazeAiProposal {
  chainName: string
  effects: MazeAiProposedEffect[]
}

export interface MazeAiGenerationResult {
  schemaVersion: number
  mazeAiVersion: string
  source: MazeAiResultSource
  processorCatalogFingerprint: string
  analysis: MazeAiAnalysis
  proposal: MazeAiProposal
  canonicalYaml: string
  warnings: string[]
}
