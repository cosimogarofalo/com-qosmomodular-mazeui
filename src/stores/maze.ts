import { defineStore } from 'pinia'

import { mazeApi } from '@/services/mazeApi'
import type { HealthResponse, Processor } from '@/types/maze'

export type MazeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'offline'

export const useMazeStore = defineStore('maze', {
  state: () => ({
    status: 'idle' as MazeConnectionStatus,
    health: null as HealthResponse | null,
    processors: [] as Processor[],
    error: null as string | null,
  }),

  getters: {
    processorById: (state) => (id: string) =>
      state.processors.find((processor) => processor.id === id),
  },

  actions: {
    async connect() {
      if (this.status === 'connecting') return

      this.status = 'connecting'
      this.error = null

      try {
        const [health, catalog] = await Promise.all([
          mazeApi.health(),
          mazeApi.processors(),
        ])
        this.health = health
        this.processors = catalog.processors
        this.status = 'connected'
      } catch (error) {
        this.health = null
        this.processors = []
        this.status = 'offline'
        this.error = error instanceof Error ? error.message : 'Cannot connect to Maze REST'
      }
    },
  },
})
