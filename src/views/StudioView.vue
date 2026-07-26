<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import BottomDock from '@/components/BottomDock.vue'
import ChainCanvas from '@/components/ChainCanvas.vue'
import ProcessorInspector from '@/components/ProcessorInspector.vue'
import ProcessorLibrary from '@/components/ProcessorLibrary.vue'
import RenderTransport from '@/components/RenderTransport.vue'
import { deriveTopology } from '@/services/chainTopology'
import { mazeApi } from '@/services/mazeApi'
import { useChainStore } from '@/stores/chain'
import { useMazeStore } from '@/stores/maze'
import { useWorkflowStore } from '@/stores/workflow'
import type { OutputFormat, ParameterValue, Processor } from '@/types/maze'

const maze = useMazeStore()
const chain = useChainStore()
const workflow = useWorkflowStore()
const autoValidate = ref(false)
let autoValidationTimer: ReturnType<typeof setTimeout> | null = null

const selectedProcessor = computed(() => {
  const effect = chain.selectedEffect
  return effect ? maze.processorById(effect.processorId) : undefined
})
const selectedInput = computed(() => maze.inputById(chain.draft.inputId))
const topology = computed(() =>
  deriveTopology(selectedInput.value, chain.draft.effects, maze.processors),
)
const originalUrl = computed(() =>
  selectedInput.value ? mazeApi.mediaUrl(selectedInput.value.contentUrl) : '',
)
const outputDisplayName = computed(() => {
  const name = chain.draft.outputBaseName.trim()
  if (!name) return ''
  if (/\.(wav|wave|aif|aiff)$/i.test(name)) return name
  return `${name}.${chain.draft.outputFormat === 'WAV' ? 'wav' : 'aiff'}`
})
const sourceBindingsValid = computed(() => {
  if (!selectedInput.value) return false
  return chain.draft.effects
    .filter((effect) => effect.enabled)
    .every((effect) => {
      const processor = maze.processorById(effect.processorId)
      if (!processor || processor.sourceBinding !== 'REQUIRED') return true
      return processor.params
        .filter((param) => param.sourceDerived)
        .every(
          (param) =>
            effect.params[param.name]?.source?.inputId === selectedInput.value?.id &&
            effect.params[param.name]?.source?.sha256 === selectedInput.value?.sha256,
        )
    })
})
const renderReason = computed(() => {
  if (maze.status !== 'connected') return 'Maze REST must be connected'
  if (!selectedInput.value) return 'Select or upload a managed input'
  if (!chain.hasRenderableShape) return 'Add an enabled processor and a safe output name'
  if (!topology.value.compatible) return 'Resolve incompatible mono/stereo stages'
  if (!sourceBindingsValid.value) return 'Refresh the source binding for this input'
  if (!workflow.isValidatedFor(chain.revision)) {
    return workflow.validation && !workflow.validation.valid
      ? 'Resolve the latest validation errors'
      : 'Validate the current bound draft first'
  }
  if (workflow.isActive) return 'A render job is already active'
  return 'Ready to render'
})
const canRender = computed(
  () => renderReason.value === 'Ready to render' && !workflow.submitting,
)

onMounted(() => maze.connect())
onBeforeUnmount(() => {
  clearAutoValidation()
  workflow.stopPolling()
})
watch(
  () => chain.revision,
  (revision) => {
    workflow.invalidate(revision)
    scheduleAutoValidation()
  },
)
watch(
  () => maze.status,
  () => scheduleAutoValidation(),
)

function clearAutoValidation() {
  if (autoValidationTimer === null) return
  globalThis.clearTimeout(autoValidationTimer)
  autoValidationTimer = null
}

function scheduleAutoValidation() {
  clearAutoValidation()
  if (
    !autoValidate.value ||
    maze.status !== 'connected' ||
    !chain.hasRenderableShape ||
    !topology.value.compatible ||
    !sourceBindingsValid.value
  ) {
    return
  }

  const revision = chain.revision
  autoValidationTimer = globalThis.setTimeout(async () => {
    autoValidationTimer = null
    if (
      !autoValidate.value ||
      revision !== chain.revision ||
      maze.status !== 'connected'
    ) {
      return
    }
    await validateDraft()
  }, 650)
}

function toggleAutoValidate() {
  autoValidate.value = !autoValidate.value
  if (autoValidate.value) scheduleAutoValidation()
  else clearAutoValidation()
}

function addProcessor(processor: Processor) {
  chain.addProcessor(processor, selectedInput.value)
}

function updateParameter(name: string, value: ParameterValue) {
  if (!chain.selectedEffectKey) return
  chain.setParameter(chain.selectedEffectKey, name, value)
}

async function validateDraft() {
  clearAutoValidation()
  await workflow.validate(chain.request, chain.revision)
}

async function renderDraft() {
  if (!canRender.value) return
  await workflow.render(chain.request, chain.revision, originalUrl.value)
}

function selectInput(inputId: string) {
  chain.bindInput(maze.inputById(inputId) || null, maze.processors)
}

async function uploadInput(file: File) {
  const uploaded = await maze.uploadInput(file)
  if (uploaded) chain.bindInput(uploaded, maze.processors)
}

function newChain() {
  chain.reset()
}
</script>

<template>
  <div class="studio-shell">
    <AppHeader
      :maze-status="maze.status"
      :maze-version="maze.health?.version"
      :chain-name="chain.draft.name"
      :dirty="chain.dirty"
      :auto-validate="autoValidate"
      @reconnect="maze.connect"
      @new-chain="newChain"
      @validate="validateDraft"
      @toggle-auto-validate="toggleAutoValidate"
    />

    <main class="studio-grid">
      <ProcessorLibrary
        :processors="maze.processors"
        :loading="maze.status === 'idle' || maze.status === 'connecting'"
        :error="maze.error"
        :current-topology="topology.output"
        :input-selected="Boolean(selectedInput)"
        @add="addProcessor"
        @retry="maze.connect"
      />

      <div class="center-workspace">
        <ChainCanvas
          :effects="chain.draft.effects"
          :processors="maze.processors"
          :selected-key="chain.selectedEffectKey"
          :input-name="selectedInput?.fileName || ''"
          :output-name="outputDisplayName"
          :topology-stages="topology.stages"
          @select="chain.selectEffect"
          @move="chain.moveEffect"
          @remove="chain.removeEffect"
        />

        <BottomDock
          :effects="chain.draft.effects"
          :processors="maze.processors"
          :yaml="chain.yaml"
          :validation="workflow.validation"
          :validation-error="workflow.validationError"
          :validating="workflow.validating"
          :job="workflow.job"
          :job-logs="workflow.jobLogs"
          :outputs="workflow.outputs"
          :job-error="workflow.jobError"
          :job-busy="workflow.deleting"
          :original-url="workflow.originalUrl"
          @validate="validateDraft"
          @delete-job="workflow.deleteCurrentJob"
          @clear-job="workflow.clearJob"
        />
      </div>

      <ProcessorInspector
        :effect="chain.selectedEffect"
        :processor="selectedProcessor"
        @update="updateParameter"
        @toggle="chain.selectedEffectKey && chain.toggleEffect(chain.selectedEffectKey)"
        @remove="chain.selectedEffectKey && chain.removeEffect(chain.selectedEffectKey)"
      />
    </main>

    <RenderTransport
      :inputs="maze.audioInputs"
      :selected-input-id="chain.draft.inputId"
      :inputs-loading="maze.inputsLoading"
      :uploading="maze.uploadBusy"
      :audio-error="maze.audioError"
      :chain-name="chain.draft.name"
      :output-base-name="chain.draft.outputBaseName"
      :output-format="chain.draft.outputFormat"
      :can-render="canRender"
      :render-reason="renderReason"
      :rendering="workflow.submitting"
      @select-input="selectInput"
      @upload="uploadInput"
      @update-chain-name="chain.setName"
      @update-output-name="chain.setOutputBaseName"
      @update-output-format="(format: OutputFormat) => chain.setOutputFormat(format)"
      @render="renderDraft"
    />
  </div>
</template>
