import { defineStore } from 'pinia'

import { MazeApiError, mazeApi } from '@/services/mazeApi'
import type {
  BoundChainRequest,
  ChainValidationResponse,
  JobOutput,
  JobStatusResponse,
} from '@/types/maze'

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled'])

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

export const useWorkflowStore = defineStore('workflow', {
  state: () => ({
    validation: null as ChainValidationResponse | null,
    validationRevision: -1,
    validationGeneration: 0,
    validating: false,
    validationError: null as string | null,
    submitting: false,
    job: null as JobStatusResponse | null,
    jobLogs: [] as string[],
    outputs: [] as JobOutput[],
    originalUrl: '',
    originalChannels: 1,
    renderedChannels: 1,
    jobError: null as string | null,
    polling: false,
    deleting: false,
    pollGeneration: 0,
  }),

  getters: {
    isTerminal: (state) =>
      state.job ? TERMINAL_STATES.has(state.job.status) : false,
    isActive: (state) =>
      state.job?.status === 'queued' || state.job?.status === 'running',
    isValidatedFor: (state) => (revision: number) =>
      state.validationRevision === revision && state.validation?.valid === true,
  },

  actions: {
    invalidate(revision: number) {
      if (this.validationRevision === revision) return
      this.validation = null
      this.validationRevision = -1
      this.validationError = null
      this.validationGeneration += 1
      this.validating = false
    },

    async validate(request: BoundChainRequest, revision: number): Promise<boolean> {
      const generation = ++this.validationGeneration
      this.validating = true
      this.validationError = null
      try {
        const validation = await mazeApi.validateChain(request)
        if (generation !== this.validationGeneration) return false
        this.validation = validation
        this.validationRevision = revision
        return this.validation.valid
      } catch (error) {
        if (generation !== this.validationGeneration) return false
        if (error instanceof MazeApiError && error.validation) {
          this.validation = error.validation
          this.validationRevision = revision
        } else {
          this.validation = null
          this.validationRevision = -1
        }
        this.validationError = message(error, 'Cannot validate the chain')
        return false
      } finally {
        if (generation === this.validationGeneration) this.validating = false
      }
    },

    async render(
      request: BoundChainRequest,
      revision: number,
      originalUrl: string,
      originalChannels: number,
      renderedChannels: number,
    ): Promise<boolean> {
      this.stopPolling()
      this.submitting = true
      this.jobError = null
      this.outputs = []
      this.jobLogs = []
      try {
        const submitted = await mazeApi.renderChain(request)
        this.job = {
          jobId: submitted.jobId,
          status: submitted.status,
          progress: null,
          message: 'Render queued',
          chainPath: null,
          outputPath: null,
          createdAt: submitted.createdAt,
          startedAt: null,
          finishedAt: null,
          error: null,
        }
        this.originalUrl = originalUrl
        this.originalChannels = originalChannels === 2 ? 2 : 1
        this.renderedChannels = renderedChannels === 2 ? 2 : 1
        void this.pollJob(submitted.jobId)
        return true
      } catch (error) {
        if (error instanceof MazeApiError && error.validation) {
          this.validation = error.validation
          this.validationRevision = revision
          this.validationError = error.message
        }
        this.jobError = message(error, 'Cannot submit the render job')
        return false
      } finally {
        this.submitting = false
      }
    },

    async refreshJob(jobId: string, generation?: number): Promise<boolean> {
      const [status, logs] = await Promise.all([
        mazeApi.job(jobId),
        mazeApi.jobLogs(jobId),
      ])
      if (generation !== undefined && generation !== this.pollGeneration) {
        return false
      }
      this.job = status
      this.jobLogs = logs.lines

      if (status.status === 'succeeded') {
        const response = await mazeApi.jobOutputs(jobId)
        if (generation !== undefined && generation !== this.pollGeneration) {
          return false
        }
        this.outputs = response.outputs
      }
      return true
    },

    async pollJob(jobId: string, intervalMilliseconds = 1000) {
      const generation = ++this.pollGeneration
      this.polling = true

      while (generation === this.pollGeneration) {
        try {
          if (!(await this.refreshJob(jobId, generation))) break
        } catch (error) {
          if (generation === this.pollGeneration) {
            this.jobError = message(error, 'Cannot refresh the render job')
          }
          break
        }

        if (!this.job || TERMINAL_STATES.has(this.job.status)) break
        await wait(Math.max(250, intervalMilliseconds))
      }

      if (generation === this.pollGeneration) this.polling = false
    },

    stopPolling() {
      this.pollGeneration += 1
      this.polling = false
    },

    async deleteCurrentJob(): Promise<boolean> {
      if (!this.job) return false
      const snapshot = this.job
      this.deleting = true
      this.jobError = null
      this.stopPolling()
      try {
        await mazeApi.deleteJob(snapshot.jobId)
        this.job = {
          ...snapshot,
          status: 'cancelled',
          message:
            snapshot.status === 'queued' || snapshot.status === 'running'
              ? 'Job cancelled and removed from Maze'
              : 'Job removed from Maze',
          finishedAt: snapshot.finishedAt || new Date().toISOString(),
        }
        this.outputs = []
        return true
      } catch (error) {
        this.jobError = message(error, 'Cannot cancel or delete the render job')
        return false
      } finally {
        this.deleting = false
      }
    },

    clearJob() {
      this.stopPolling()
      this.job = null
      this.jobLogs = []
      this.outputs = []
      this.originalUrl = ''
      this.originalChannels = 1
      this.renderedChannels = 1
      this.jobError = null
    },
  },
})
