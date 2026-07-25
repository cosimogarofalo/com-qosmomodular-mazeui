import type {
  ChainValidationResponse,
  HealthResponse,
  JobSubmittedResponse,
  ProcessorListResponse,
} from '@/types/maze'

const apiBase = (import.meta.env.VITE_MAZE_API_URL || '/api').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Maze REST returned HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const mazeApi = {
  health(): Promise<HealthResponse> {
    return request('/health')
  },

  processors(): Promise<ProcessorListResponse> {
    return request('/processors')
  },

  validateChain(chainYaml: string): Promise<ChainValidationResponse> {
    return request('/chains/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainYaml }),
    })
  },

  renderChainPath(chainPath: string): Promise<JobSubmittedResponse> {
    return request('/jobs/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainPath }),
    })
  },
}
