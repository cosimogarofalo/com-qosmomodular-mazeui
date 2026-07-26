import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MazeApiError, mazeApi } from '@/services/mazeApi'
import { useMazeStore } from '@/stores/maze'

describe('Maze connection and managed audio store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('reports an offline REST service clearly', async () => {
    vi.spyOn(mazeApi, 'health').mockRejectedValue(new Error('Connection refused'))
    vi.spyOn(mazeApi, 'processors').mockResolvedValue({ processors: [] })
    vi.spyOn(mazeApi, 'audioInputs').mockResolvedValue({ inputs: [] })
    const store = useMazeStore()

    await store.connect()

    expect(store.status).toBe('offline')
    expect(store.error).toBe('Connection refused')
    expect(store.processors).toEqual([])
    expect(store.audioInputs).toEqual([])
  })

  it('keeps a stable upload collision message for the transport', async () => {
    vi.spyOn(mazeApi, 'uploadAudio').mockRejectedValue(
      new MazeApiError(
        409,
        'AUDIO_INPUT_COLLISION',
        'Managed audio input already exists: voice.wav',
      ),
    )
    const store = useMazeStore()
    const file = { name: 'voice.wav' } as File

    await expect(store.uploadInput(file)).resolves.toBeNull()
    expect(store.audioError).toBe('Managed audio input already exists: voice.wav')
    expect(store.uploadBusy).toBe(false)
  })
})
