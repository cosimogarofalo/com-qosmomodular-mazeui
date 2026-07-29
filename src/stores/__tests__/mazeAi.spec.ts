import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mazeAiApi } from '@/services/mazeAiApi'
import { compatibilityIssues, useMazeAiStore } from '@/stores/mazeAi'
import {
  mazeAiCapabilities,
  mazeAiHealth,
} from './mazeAiTestFixture'

describe('MazeAI connection and generation store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('opens generation only when UI, Maze and MazeAI versions pass the gate', () => {
    expect(
      compatibilityIssues(mazeAiHealth, mazeAiCapabilities, '0.8.0', '0.8.0'),
    ).toEqual([])
    expect(
      compatibilityIssues(mazeAiHealth, mazeAiCapabilities, '0.8.0', '0.9.0'),
    ).toContain('Maze REST 0.9.0 is not compatible with MazeUI 0.8.0')
  })

  it('submits the selected managed input and keeps the proposal out of the chain store', async () => {
    vi.spyOn(mazeAiApi, 'health').mockResolvedValue(mazeAiHealth)
    vi.spyOn(mazeAiApi, 'capabilities').mockResolvedValue(mazeAiCapabilities)
    vi.spyOn(mazeAiApi, 'createChainJob').mockResolvedValue({
      chainJobId: 'chain-job-1',
      state: 'QUEUED',
      createdAt: '2026-07-29T10:00:00Z',
      statusUrl: '/api/chain-jobs/chain-job-1',
    })
    const store = useMazeAiStore()
    await store.connect('0.8.0', '0.8.0')
    vi.spyOn(store, 'pollJob').mockResolvedValue()
    store.goal = '  improve the spoken voice  '

    await expect(store.generate('managed-input')).resolves.toBe(true)

    expect(mazeAiApi.createChainJob).toHaveBeenCalledWith({
      inputId: 'managed-input',
      goal: 'improve the spoken voice',
      contentHint: 'AUTO',
      semanticEdit: 'KEEP',
      transcript: null,
    })
    expect(store.job?.chainJobId).toBe('chain-job-1')
    expect(store.result).toBeNull()
    expect(store.proposalAccepted).toBe(false)
  })
})
