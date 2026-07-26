import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MazeApiError, mazeApi } from '@/services/mazeApi'
import { useWorkflowStore } from '@/stores/workflow'
import type {
  BoundChainRequest,
  ChainValidationResponse,
  JobStatusResponse,
} from '@/types/maze'

const request: BoundChainRequest = {
  chainYaml: 'chains: []\n',
  inputBindings: [{ chainIndex: 0, inputIndex: 0, inputId: 'input' }],
  outputBindings: [
    { chainIndex: 0, outputIndex: 0, fileName: 'render', format: 'WAV' },
  ],
  overwriteExisting: true,
}

const succeeded: JobStatusResponse = {
  jobId: 'job-1',
  status: 'succeeded',
  progress: null,
  message: 'Render completed',
  chainPath: null,
  outputPath: null,
  createdAt: '2026-07-26T10:00:00Z',
  startedAt: '2026-07-26T10:00:01Z',
  finishedAt: '2026-07-26T10:00:02Z',
  error: null,
}

describe('render workflow store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('preserves structured server validation failures at the draft revision', async () => {
    const validation: ChainValidationResponse = {
      valid: false,
      errors: [{ code: 'OUTPUT_COLLISION', message: 'Exists', path: '$.outputBindings[0]' }],
      warnings: [],
    }
    vi.spyOn(mazeApi, 'validateChain').mockRejectedValue(
      new MazeApiError(409, 'OUTPUT_COLLISION', 'Exists', validation),
    )
    const store = useWorkflowStore()

    await expect(store.validate(request, 7)).resolves.toBe(false)
    expect(store.validation).toEqual(validation)
    expect(store.validationRevision).toBe(7)
    expect(store.isValidatedFor(7)).toBe(false)
  })

  it('discards an automatic validation response after the draft changes', async () => {
    let resolveValidation!: (value: ChainValidationResponse) => void
    vi.spyOn(mazeApi, 'validateChain').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve
        }),
    )
    const store = useWorkflowStore()
    const pending = store.validate(request, 3)

    store.invalidate(4)
    resolveValidation({ valid: true, errors: [], warnings: [] })
    await pending

    expect(store.validation).toBeNull()
    expect(store.validationRevision).toBe(-1)
    expect(store.validating).toBe(false)
  })

  it('stops polling at success and loads every ordered output', async () => {
    vi.spyOn(mazeApi, 'job').mockResolvedValue(succeeded)
    vi.spyOn(mazeApi, 'jobLogs').mockResolvedValue({
      jobId: 'job-1',
      lines: ['queued', 'completed'],
    })
    vi.spyOn(mazeApi, 'jobOutputs').mockResolvedValue({
      jobId: 'job-1',
      status: 'succeeded',
      outputs: [
        {
          index: 0,
          chainName: 'First',
          path: 'hidden-server-path',
          fileName: 'first.wav',
          format: 'WAV',
          sizeBytes: 100,
          available: true,
          downloadUrl: '/api/jobs/job-1/outputs/0',
          contentUrl: '/api/jobs/job-1/outputs/0/content',
        },
        {
          index: 1,
          chainName: 'Second',
          path: 'hidden-server-path',
          fileName: 'second.wav',
          format: 'WAV',
          sizeBytes: 200,
          available: true,
          downloadUrl: '/api/jobs/job-1/outputs/1',
          contentUrl: '/api/jobs/job-1/outputs/1/content',
        },
      ],
    })
    const store = useWorkflowStore()

    await store.pollJob('job-1')

    expect(store.polling).toBe(false)
    expect(store.job?.status).toBe('succeeded')
    expect(store.jobLogs).toEqual(['queued', 'completed'])
    expect(store.outputs.map((output) => output.fileName)).toEqual([
      'first.wav',
      'second.wav',
    ])
  })

  it('submits the validated snapshot and retains its original media URL', async () => {
    vi.spyOn(mazeApi, 'renderChain').mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      createdAt: '2026-07-26T10:00:00Z',
      statusUrl: '/api/jobs/job-1',
    })
    const store = useWorkflowStore()
    const poll = vi.spyOn(store, 'pollJob').mockResolvedValue()

    await expect(
      store.render(request, 8, '/api/audio/inputs/input/content'),
    ).resolves.toBe(true)

    expect(mazeApi.renderChain).toHaveBeenCalledWith(request)
    expect(store.job?.status).toBe('queued')
    expect(store.originalUrl).toBe('/api/audio/inputs/input/content')
    expect(poll).toHaveBeenCalledWith('job-1')
  })

  it('cancels an active job and keeps an understandable terminal state', async () => {
    vi.spyOn(mazeApi, 'deleteJob').mockResolvedValue()
    const store = useWorkflowStore()
    store.job = { ...succeeded, status: 'running', finishedAt: null }

    await expect(store.deleteCurrentJob()).resolves.toBe(true)
    expect(store.job?.status).toBe('cancelled')
    expect(store.job?.message).toContain('cancelled')
    expect(store.polling).toBe(false)
  })
})
