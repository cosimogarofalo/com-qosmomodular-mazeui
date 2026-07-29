import type {
  MazeAiApiError as MazeAiApiErrorEnvelope,
  MazeAiCapabilitiesResponse,
  MazeAiGenerationRequest,
  MazeAiGenerationResult,
  MazeAiHealthResponse,
  MazeAiJobAcceptedResponse,
  MazeAiJobLogsResponse,
  MazeAiJobStatusResponse,
} from '@/types/mazeAi'

const apiBase = (import.meta.env.VITE_MAZEAI_API_URL || '/mazeai-api').replace(
  /\/$/,
  '',
)

export class MazeAiApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldPath: string | null

  constructor(
    status: number,
    code: string,
    message: string,
    fieldPath: string | null = null,
  ) {
    super(message)
    this.name = 'MazeAiApiError'
    this.status = status
    this.code = code
    this.fieldPath = fieldPath
  }
}

function isErrorEnvelope(value: unknown): value is MazeAiApiErrorEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MazeAiApiErrorEnvelope>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

async function responseError(response: Response): Promise<MazeAiApiError> {
  const text = await response.text()
  let body: unknown

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (isErrorEnvelope(body)) {
    return new MazeAiApiError(
      response.status,
      body.code,
      body.message,
      body.fieldPath ?? null,
    )
  }

  return new MazeAiApiError(
    response.status,
    'MAZEAI_HTTP_ERROR',
    text || `MazeAI REST returned HTTP ${response.status}`,
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

export const mazeAiApi = {
  health(): Promise<MazeAiHealthResponse> {
    return request('/health')
  },

  capabilities(): Promise<MazeAiCapabilitiesResponse> {
    return request('/capabilities')
  },

  createChainJob(
    requestBody: MazeAiGenerationRequest,
  ): Promise<MazeAiJobAcceptedResponse> {
    return request('/chain-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  },

  chainJob(chainJobId: string): Promise<MazeAiJobStatusResponse> {
    return request(`/chain-jobs/${encodeURIComponent(chainJobId)}`)
  },

  chainJobResult(chainJobId: string): Promise<MazeAiGenerationResult> {
    return request(`/chain-jobs/${encodeURIComponent(chainJobId)}/result`)
  },

  chainJobLogs(chainJobId: string): Promise<MazeAiJobLogsResponse> {
    return request(`/chain-jobs/${encodeURIComponent(chainJobId)}/logs`)
  },

  deleteChainJob(chainJobId: string): Promise<void> {
    return request(`/chain-jobs/${encodeURIComponent(chainJobId)}`, {
      method: 'DELETE',
    })
  },
}
