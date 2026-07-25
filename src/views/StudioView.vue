<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import BottomDock from '@/components/BottomDock.vue'
import ChainCanvas from '@/components/ChainCanvas.vue'
import ProcessorInspector from '@/components/ProcessorInspector.vue'
import ProcessorLibrary from '@/components/ProcessorLibrary.vue'
import { mazeApi } from '@/services/mazeApi'
import { useChainStore } from '@/stores/chain'
import { useMazeStore } from '@/stores/maze'
import type { ChainValidationResponse, ParameterValue, Processor } from '@/types/maze'

const maze = useMazeStore()
const chain = useChainStore()
const validation = ref<ChainValidationResponse | null>(null)
const validating = ref(false)

const selectedProcessor = computed(() => {
  const effect = chain.selectedEffect
  return effect ? maze.processorById(effect.processorId) : undefined
})

onMounted(() => maze.connect())

function addProcessor(processor: Processor) {
  chain.addProcessor(processor)
  validation.value = null
}

function updateParameter(name: string, value: ParameterValue) {
  if (!chain.selectedEffectKey) return
  chain.setParameter(chain.selectedEffectKey, name, value)
  validation.value = null
}

async function validateDraft() {
  validating.value = true
  try {
    validation.value = await mazeApi.validateChain(chain.yaml)
  } catch (error) {
    validation.value = {
      valid: false,
      errors: [
        {
          code: 'MAZE_UNREACHABLE',
          message: error instanceof Error ? error.message : 'Cannot validate the chain',
          path: '$',
        },
      ],
      warnings: [],
    }
  } finally {
    validating.value = false
  }
}

function newChain() {
  chain.reset()
  validation.value = null
}
</script>

<template>
  <div class="studio-shell">
    <AppHeader
      :maze-status="maze.status"
      :maze-version="maze.health?.version"
      :chain-name="chain.draft.name"
      :dirty="chain.dirty"
      @reconnect="maze.connect"
      @new-chain="newChain"
      @validate="validateDraft"
    />

    <main class="studio-grid">
      <ProcessorLibrary
        :processors="maze.processors"
        :loading="maze.status === 'idle' || maze.status === 'connecting'"
        :error="maze.error"
        @add="addProcessor"
        @retry="maze.connect"
      />

      <div class="center-workspace">
        <ChainCanvas
          :effects="chain.draft.effects"
          :processors="maze.processors"
          :selected-key="chain.selectedEffectKey"
          :input-path="chain.draft.inputPath"
          :output-path="chain.draft.outputPath"
          @select="chain.selectEffect"
          @move="chain.moveEffect"
          @remove="chain.removeEffect"
        />

        <BottomDock
          :effects="chain.draft.effects"
          :processors="maze.processors"
          :yaml="chain.yaml"
          :validation="validation"
          :validating="validating"
          @validate="validateDraft"
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

    <footer class="transport-bar">
      <label>
        <span>Input file</span>
        <input
          v-model="chain.draft.inputPath"
          type="text"
          placeholder="C:/…/audio-in/source.wav"
          @input="chain.dirty = true"
        />
      </label>
      <label>
        <span>Chain name</span>
        <input v-model="chain.draft.name" type="text" @input="chain.dirty = true" />
      </label>
      <label>
        <span>Output file</span>
        <input
          v-model="chain.draft.outputPath"
          type="text"
          placeholder="C:/…/audio-out/render.wav"
          @input="chain.dirty = true"
        />
      </label>
      <button
        class="button render-button"
        type="button"
        disabled
        title="Render will be enabled when chain persistence is implemented"
      >
        ▶ Render chain
      </button>
    </footer>
  </div>
</template>
