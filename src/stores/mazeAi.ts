import { defineStore } from 'pinia'

import { mazeAiApi } from '@/services/mazeAiApi'
import type {
  MazeAiCapabilitiesResponse,
  MazeAiContentHint,
  MazeAiGenerationResult,
  MazeAiHealthResponse,
  MazeAiJobStatusResponse,
  MazeAiSemanticEdit,
} from '@/types/mazeAi'

const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])
const SUPPORTED_SCHEMA_VERSION = 1

export type MazeAiConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'incompatible'
  | 'offline'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function compatibilityIssues(
  health: MazeAiHealthResponse,
  capabilities: MazeAiCapabilitiesResponse,
  uiVersion: string,
  mazeVersion: string | undefined,
): string[] {
  const issues: string[] = []

  if (health.service !== 'mazeai') {
    issues.push(`Unexpected service identity ${health.service}`)
  }
  if (!health.ready || !capabilities.generationReady) {
    issues.push('MazeAI generation is not ready')
  }
  if (
    health.schemaVersion !== SUPPORTED_SCHEMA_VERSION ||
    capabilities.schemaVersion !== SUPPORTED_SCHEMA_VERSION
  ) {
    issues.push(
      `MazeUI requires MazeAI contract schema ${SUPPORTED_SCHEMA_VERSION}`,
    )
  }
  if (health.version !== capabilities.mazeAiVersion) {
    issues.push('MazeAI health and capability versions disagree')
  }
  if (health.version !== uiVersion) {
    issues.push(
      `MazeAI ${health.version} is not compatible with MazeUI ${uiVersion}`,
    )
  }
  if (!mazeVersion) {
    issues.push('Maze REST must be connected for the compatibility gate')
  } else if (mazeVersion !== uiVersion) {
    issues.push(`Maze REST ${mazeVersion} is not compatible with MazeUI ${uiVersion}`)
  }
  if (!capabilities.contentHints.includes('AUTO')) {
    issues.push('MazeAI does not expose automatic content routing')
  }
  if (!capabilities.semanticEditModes.includes('KEEP')) {
    issues.push('MazeAI does not expose the safe KEEP semantic policy')
  }
  return issues
}

export const useMazeAiStore = defineStore('maze-ai', {
  state: () => ({
    status: 'idle' as MazeAiConnectionStatus,
    health: null as MazeAiHealthResponse | null,
    capabilities: null as MazeAiCapabilitiesResponse | null,
    compatibility: [] as string[],
    goal: '',
    contentHint: 'AUTO' as MazeAiContentHint,
    semanticEdit: 'KEEP' as MazeAiSemanticEdit,
    submitting: false,
    cancelling: false,
    polling: false,
    pollGeneration: 0,
    job: null as MazeAiJobStatusResponse | null,
    logs: [] as string[],
    logsTruncated: false,
    result: null as MazeAiGenerationResult | null,
    error: null as string | null,
    proposalAccepted: false,
    acceptedRevision: null as number | null,
  }),

  getters: {
    isActive: (state) =>
      state.job?.state === 'QUEUED' || state.job?.state === 'RUNNING',
    isTerminal: (state) =>
      state.job ? TERMINAL_STATES.has(state.job.state) : false,
    generationReady: (state) =>
      state.status === 'ready' &&
      state.health?.ready === true &&
      state.capabilities?.generationReady === true,
  },

  actions: {
    async connect(uiVersion: string, mazeVersion: string | undefined) {
      if (this.status === 'connecting') return
      this.status = 'connecting'
      this.error = null
      this.compatibility = []

      try {
        const [health, capabilities] = await Promise.all([
          mazeAiApi.health(),
          mazeAiApi.capabilities(),
        ])
        this.health = health
        this.capabilities = capabilities
        this.compatibility = compatibilityIssues(
          health,
          capabilities,
          uiVersion,
          mazeVersion,
        )
        this.status =
          this.compatibility.length === 0 ? 'ready' : 'incompatible'
      } catch (error) {
        this.health = null
        this.capabilities = null
        this.compatibility = []
        this.status = 'offline'
        this.error = errorMessage(error, 'Cannot connect to MazeAI REST')
      }
    },

    reevaluateCompatibility(
      uiVersion: string,
      mazeVersion: string | undefined,
    ) {
      if (!this.health || !this.capabilities) return
      this.compatibility = compatibilityIssues(
        this.health,
        this.capabilities,
        uiVersion,
        mazeVersion,
      )
      this.status =
        this.compatibility.length === 0 ? 'ready' : 'incompatible'
    },

    async generate(inputId: string): Promise<boolean> {
      if (!this.generationReady || this.submitting || this.isActive) {
        return false
      }
      const goal = this.goal.trim()
      if (!inputId || !goal) return false

      this.stopPolling()
      this.submitting = true
      this.error = null
      this.result = null
      this.logs = []
      this.logsTruncated = false
      this.proposalAccepted = false
      this.acceptedRevision = null

      try {
        const accepted = await mazeAiApi.createChainJob({
          inputId,
          goal,
          contentHint: this.contentHint,
          semanticEdit: this.semanticEdit,
          transcript: null,
        })
        this.job = {
          chainJobId: accepted.chainJobId,
          state: accepted.state,
          phase: 'QUEUED',
          progressPercent: 0,
          message: 'Chain generation queued',
          createdAt: accepted.createdAt,
          startedAt: null,
          finishedAt: null,
          error: null,
        }
        void this.pollJob(accepted.chainJobId)
        return true
      } catch (error) {
        this.error = errorMessage(error, 'Cannot submit the MazeAI chain job')
        return false
      } finally {
        this.submitting = false
      }
    },

    async refreshJob(
      chainJobId: string,
      generation?: number,
    ): Promise<boolean> {
      const [job, logs] = await Promise.all([
        mazeAiApi.chainJob(chainJobId),
        mazeAiApi.chainJobLogs(chainJobId),
      ])
      if (generation !== undefined && generation !== this.pollGeneration) {
        return false
      }

      this.job = job
      this.logs = logs.lines
      this.logsTruncated = logs.truncated

      if (job.state === 'SUCCEEDED') {
        const result = await mazeAiApi.chainJobResult(chainJobId)
        if (generation !== undefined && generation !== this.pollGeneration) {
          return false
        }
        this.result = result
      } else if (job.state === 'FAILED') {
        this.error = job.error?.message || 'MazeAI chain generation failed'
      } else if (job.state === 'CANCELLED') {
        this.error = null
      }
      return true
    },

    async pollJob(
      chainJobId: string,
      intervalMilliseconds = 750,
      maximumAttempts = 400,
    ) {
      const generation = ++this.pollGeneration
      this.polling = true
      let attempts = 0

      while (
        generation === this.pollGeneration &&
        attempts < maximumAttempts
      ) {
        attempts += 1
        try {
          if (!(await this.refreshJob(chainJobId, generation))) break
        } catch (error) {
          if (generation === this.pollGeneration) {
            this.error = errorMessage(error, 'Cannot refresh the MazeAI chain job')
          }
          break
        }

        if (!this.job || TERMINAL_STATES.has(this.job.state)) break
        await wait(Math.max(250, intervalMilliseconds))
      }

      if (
        generation === this.pollGeneration &&
        this.job &&
        !TERMINAL_STATES.has(this.job.state) &&
        attempts >= maximumAttempts
      ) {
        this.error = 'MazeAI job polling reached its five-minute UI limit'
      }
      if (generation === this.pollGeneration) this.polling = false
    },

    stopPolling() {
      this.pollGeneration += 1
      this.polling = false
    },

    async cancel(): Promise<boolean> {
      if (!this.job || !this.isActive || this.cancelling) return false
      const snapshot = this.job
      this.cancelling = true
      this.error = null
      this.stopPolling()

      try {
        await mazeAiApi.deleteChainJob(snapshot.chainJobId)
        await this.refreshJob(snapshot.chainJobId)
        return true
      } catch (error) {
        this.job = {
          ...snapshot,
          state: 'CANCELLED',
          phase: 'CANCELLED',
          message: 'MazeAI chain job cancelled',
          finishedAt: snapshot.finishedAt || new Date().toISOString(),
        }
        this.error = errorMessage(error, 'Cannot confirm MazeAI cancellation')
        return false
      } finally {
        this.cancelling = false
      }
    },

    markAccepted(revision: number) {
      this.proposalAccepted = true
      this.acceptedRevision = revision
    },

    clearResult() {
      this.stopPolling()
      this.job = null
      this.logs = []
      this.logsTruncated = false
      this.result = null
      this.error = null
      this.proposalAccepted = false
      this.acceptedRevision = null
    },
  },
})
