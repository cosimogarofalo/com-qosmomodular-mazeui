import { defineStore } from 'pinia'

import { mazeApi } from '@/services/mazeApi'
import type { AudioInput, HealthResponse, Processor } from '@/types/maze'

export type MazeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'offline'

export const useMazeStore = defineStore('maze', {
  state: () => ({
    status: 'idle' as MazeConnectionStatus,
    health: null as HealthResponse | null,
    processors: [] as Processor[],
    audioInputs: [] as AudioInput[],
    inputsLoading: false,
    uploadBusy: false,
    audioError: null as string | null,
    error: null as string | null,
  }),

  getters: {
    processorById: (state) => (id: string) =>
      state.processors.find((processor) => processor.id === id),
    inputById: (state) => (id: string) =>
      state.audioInputs.find((input) => input.id === id),
  },

  actions: {
    async connect() {
      if (this.status === 'connecting') return

      this.status = 'connecting'
      this.error = null

      try {
        const [health, catalog, audio] = await Promise.all([
          mazeApi.health(),
          mazeApi.processors(),
          mazeApi.audioInputs(),
        ])
        this.health = health
        this.processors = catalog.processors
        this.audioInputs = audio.inputs
        this.status = 'connected'
      } catch (error) {
        this.health = null
        this.processors = []
        this.audioInputs = []
        this.status = 'offline'
        this.error = error instanceof Error ? error.message : 'Cannot connect to Maze REST'
      }
    },

    async refreshInputs() {
      this.inputsLoading = true
      this.audioError = null
      try {
        const response = await mazeApi.audioInputs()
        this.audioInputs = response.inputs
      } catch (error) {
        this.audioError =
          error instanceof Error ? error.message : 'Cannot load managed audio inputs'
      } finally {
        this.inputsLoading = false
      }
    },

    async uploadInput(file: File): Promise<AudioInput | null> {
      this.uploadBusy = true
      this.audioError = null
      try {
        const uploaded = await mazeApi.uploadAudio(file)
        const existing = this.audioInputs.findIndex((input) => input.id === uploaded.id)
        if (existing >= 0) this.audioInputs.splice(existing, 1, uploaded)
        else this.audioInputs.push(uploaded)
        this.audioInputs.sort((left, right) =>
          left.fileName.localeCompare(right.fileName, undefined, { sensitivity: 'base' }),
        )
        return uploaded
      } catch (error) {
        this.audioError =
          error instanceof Error ? error.message : 'Cannot upload the selected audio file'
        return null
      } finally {
        this.uploadBusy = false
      }
    },
  },
})
