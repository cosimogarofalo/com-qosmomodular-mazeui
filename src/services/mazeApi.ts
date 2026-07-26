import type {
  AudioInput,
  AudioInputListResponse,
  BoundChainRequest,
  ChainValidationResponse,
  HealthResponse,
  JobLogsResponse,
  JobOutputsResponse,
  JobStatusResponse,
  JobSubmittedResponse,
  ProcessorListResponse,
} from '@/types/maze'

const apiBase = (import.meta.env.VITE_MAZE_API_URL || '/api').replace(/\/$/, '')

export class MazeApiError extends Error {
  readonly status: number
  readonly code: string
  readonly validation?: ChainValidationResponse

  constructor(
    status: number,
    code: string,
    message: string,
    validation?: ChainValidationResponse,
  ) {
    super(message)
    this.name = 'MazeApiError'
    this.status = status
    this.code = code
    this.validation = validation
  }
}

function isValidationResponse(value: unknown): value is ChainValidationResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ChainValidationResponse>
  return (
    typeof candidate.valid === 'boolean' &&
    Array.isArray(candidate.errors) &&
    Array.isArray(candidate.warnings)
  )
}

async function responseError(response: Response): Promise<MazeApiError> {
  const text = await response.text()
  let body: unknown

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (isValidationResponse(body)) {
    const first = body.errors[0]
    return new MazeApiError(
      response.status,
      first?.code || 'CHAIN_VALIDATION_FAILED',
      first?.message || `Maze rejected the chain with HTTP ${response.status}`,
      body,
    )
  }

  if (body && typeof body === 'object') {
    const payload = body as Record<string, unknown>
    const code = typeof payload.error === 'string' ? payload.error : 'MAZE_HTTP_ERROR'
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : `Maze REST returned HTTP ${response.status}`
    return new MazeApiError(response.status, code, message)
  }

  return new MazeApiError(
    response.status,
    'MAZE_HTTP_ERROR',
    text || `Maze REST returned HTTP ${response.status}`,
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw await responseError(response)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function absoluteApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!/^https?:\/\//i.test(apiBase)) return path
  return new URL(path, apiBase).toString()
}

export const mazeApi = {
  health(): Promise<HealthResponse> {
    return request('/health')
  },

  processors(): Promise<ProcessorListResponse> {
    return request('/processors')
  },

  audioInputs(): Promise<AudioInputListResponse> {
    return request('/audio/inputs')
  },

  audioInput(inputId: string): Promise<AudioInput> {
    return request(`/audio/inputs/${encodeURIComponent(inputId)}`)
  },

  uploadAudio(file: File): Promise<AudioInput> {
    const form = new FormData()
    form.append('file', file, file.name)
    return request('/audio/inputs', {
      method: 'POST',
      body: form,
    })
  },

  validateChain(requestBody: BoundChainRequest): Promise<ChainValidationResponse> {
    return request('/chains/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  },

  renderChain(requestBody: BoundChainRequest): Promise<JobSubmittedResponse> {
    return request('/jobs/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  },

  job(jobId: string): Promise<JobStatusResponse> {
    return request(`/jobs/${encodeURIComponent(jobId)}`)
  },

  jobLogs(jobId: string): Promise<JobLogsResponse> {
    return request(`/jobs/${encodeURIComponent(jobId)}/logs`)
  },

  jobOutputs(jobId: string): Promise<JobOutputsResponse> {
    return request(`/jobs/${encodeURIComponent(jobId)}/outputs`)
  },

  deleteJob(jobId: string): Promise<void> {
    return request(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
  },

  mediaUrl(path: string): string {
    return absoluteApiUrl(path)
  },
}
