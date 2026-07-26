<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AudioComparison from '@/components/AudioComparison.vue'
import ProcessorVisualization from '@/components/ProcessorVisualization.vue'
import { mazeApi } from '@/services/mazeApi'
import type {
  ChainEffectDraft,
  ChainValidationResponse,
  JobOutput,
  JobStatusResponse,
  Processor,
} from '@/types/maze'

const props = defineProps<{
  effects: ChainEffectDraft[]
  processors: Processor[]
  yaml: string
  validation: ChainValidationResponse | null
  validationError: string | null
  validating: boolean
  job: JobStatusResponse | null
  jobLogs: string[]
  outputs: JobOutput[]
  jobError: string | null
  jobBusy: boolean
  originalUrl: string
  selectedEffect?: ChainEffectDraft
  selectedProcessor?: Processor
  sampleRate?: number
}>()

defineEmits<{
  validate: []
  deleteJob: []
  clearJob: []
}>()

type DockTab =
  | 'overview'
  | 'processor'
  | 'yaml'
  | 'validation'
  | 'job'
  | 'outputs'
const activeTab = ref<DockTab>('overview')
const tabs: DockTab[] = [
  'overview',
  'processor',
  'yaml',
  'validation',
  'job',
  'outputs',
]
const selectedOutputIndex = ref(0)

const processorsById = computed(
  () => new Map(props.processors.map((processor) => [processor.id, processor])),
)
const selectedOutput = computed(
  () =>
    props.outputs.find((output) => output.index === selectedOutputIndex.value) ||
    props.outputs[0],
)

watch(
  () => props.job?.jobId,
  () => {
    selectedOutputIndex.value = 0
    if (props.job) activeTab.value = 'job'
  },
)
watch(
  () => props.outputs.length,
  (length) => {
    if (length > 0) activeTab.value = 'outputs'
  },
)
watch(
  () => props.validation,
  (validation) => {
    if (validation && activeTab.value !== 'processor') {
      activeTab.value = 'validation'
    }
  },
)
watch(
  () => props.jobError,
  (error) => {
    if (error && !props.validation) activeTab.value = 'job'
  },
)

function bytes(value: number | null): string {
  if (value === null) return 'size unavailable'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}
</script>

<template>
  <section class="panel bottom-dock">
    <nav class="dock-tabs" aria-label="Chain details">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
        <span v-if="tab === 'outputs' && outputs.length">({{ outputs.length }})</span>
      </button>
      <button class="validate-link" type="button" @click="$emit('validate')">
        {{ validating ? 'Validating…' : 'Validate bound draft' }}
      </button>
    </nav>

    <div v-if="activeTab === 'overview'" class="dock-content overview-content">
      <div v-if="effects.length === 0" class="empty-panel">The chain has no processors yet.</div>
      <table v-else>
        <thead>
          <tr>
            <th>#</th>
            <th>Processor</th>
            <th>ID</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(effect, index) in effects" :key="effect.key">
            <td>{{ index + 1 }}</td>
            <td>{{ processorsById.get(effect.processorId)?.name || effect.processorId }}</td>
            <td>{{ effect.processorId }}</td>
            <td :class="effect.enabled ? 'status-enabled' : 'status-disabled'">
              {{ effect.enabled ? 'Enabled' : 'Bypassed' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="activeTab === 'processor'" class="dock-content processor-content">
      <div v-if="!selectedEffect || !selectedProcessor" class="empty-panel">
        Select a processor in the chain to inspect its visualization.
      </div>
      <template v-else>
        <header class="processor-visualization-heading">
          <div>
            <strong>{{ selectedProcessor.name }}</strong>
            <small>{{ selectedProcessor.id }}</small>
          </div>
          <span>
            Adjust its parameters in the inspector; this view updates in real time.
          </span>
        </header>
        <ProcessorVisualization
          :effect="selectedEffect"
          :processor="selectedProcessor"
          :sample-rate="sampleRate"
        />
      </template>
    </div>

    <div v-else-if="activeTab === 'yaml'" class="dock-content yaml-content">
      <pre>{{ yaml }}</pre>
    </div>

    <div v-else-if="activeTab === 'validation'" class="dock-content validation-content">
      <div v-if="!validation" class="empty-panel">
        <strong v-if="validationError" class="inline-error">{{ validationError }}</strong>
        <span>Validate the managed input/output bindings and current YAML against Maze.</span>
      </div>
      <div v-else-if="validation.valid" class="validation-success">
        <strong>Bound chain is valid</strong>
        <span>{{ validation.warnings.length }} warning(s)</span>
        <ul v-if="validation.warnings.length">
          <li v-for="issue in validation.warnings" :key="`${issue.code}-${issue.path}`">
            <code>{{ issue.path }}</code> {{ issue.message }}
          </li>
        </ul>
      </div>
      <div v-else class="validation-errors">
        <strong>{{ validation.errors.length }} validation error(s)</strong>
        <ul>
          <li v-for="issue in validation.errors" :key="`${issue.code}-${issue.path}`">
            <code>{{ issue.path }}</code> {{ issue.message }}
          </li>
        </ul>
      </div>
    </div>

    <div v-else-if="activeTab === 'job'" class="dock-content job-content">
      <div v-if="!job" class="empty-panel">
        <strong v-if="jobError" class="inline-error">{{ jobError }}</strong>
        <span>No render job in this browser session.</span>
      </div>
      <template v-else>
        <header class="job-summary">
          <div>
            <span class="job-status" :class="`is-${job.status}`">{{ job.status }}</span>
            <strong>{{ job.message || 'Maze render job' }}</strong>
            <small>{{ job.jobId }}</small>
          </div>
          <div class="job-actions">
            <button
              class="button button-ghost"
              type="button"
              :disabled="jobBusy"
              @click="$emit('deleteJob')"
            >
              {{ job.status === 'queued' || job.status === 'running' ? 'Cancel' : 'Delete' }}
            </button>
            <button class="button button-ghost" type="button" @click="$emit('clearJob')">
              Clear view
            </button>
          </div>
        </header>
        <p v-if="job.error || jobError" class="inline-error">
          {{ job.error || jobError }}
        </p>
        <pre class="job-logs">{{ jobLogs.length ? jobLogs.join('\n') : 'Waiting for job logs…' }}</pre>
      </template>
    </div>

    <div v-else class="dock-content outputs-content">
      <div v-if="outputs.length === 0" class="empty-panel">
        Rendered outputs appear here when the job succeeds.
      </div>
      <template v-else>
        <div class="output-toolbar">
          <label>
            <span>Rendered output</span>
            <select v-model.number="selectedOutputIndex">
              <option v-for="output in outputs" :key="output.index" :value="output.index">
                {{ output.index + 1 }} · {{ output.fileName }} · {{ bytes(output.sizeBytes) }}
              </option>
            </select>
          </label>
          <a
            v-for="output in outputs"
            :key="`download-${output.index}`"
            class="button button-ghost download-link"
            :href="mazeApi.mediaUrl(output.downloadUrl)"
            download
          >
            Download {{ output.index + 1 }}
          </a>
        </div>
        <AudioComparison
          v-if="selectedOutput && originalUrl"
          :original-url="originalUrl"
          :rendered-url="mazeApi.mediaUrl(selectedOutput.contentUrl)"
        />
      </template>
    </div>
  </section>
</template>
