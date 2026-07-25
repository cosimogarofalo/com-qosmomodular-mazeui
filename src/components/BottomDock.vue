<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  ChainEffectDraft,
  ChainValidationResponse,
  Processor,
} from '@/types/maze'

const props = defineProps<{
  effects: ChainEffectDraft[]
  processors: Processor[]
  yaml: string
  validation: ChainValidationResponse | null
  validating: boolean
}>()

defineEmits<{
  validate: []
}>()

type DockTab = 'overview' | 'yaml' | 'validation'
const activeTab = ref<DockTab>('overview')
const tabs: DockTab[] = ['overview', 'yaml', 'validation']

const processorsById = computed(
  () => new Map(props.processors.map((processor) => [processor.id, processor])),
)
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
      </button>
      <button class="validate-link" type="button" @click="$emit('validate')">
        {{ validating ? 'Validating…' : 'Validate draft' }}
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

    <div v-else-if="activeTab === 'yaml'" class="dock-content yaml-content">
      <pre>{{ yaml }}</pre>
    </div>

    <div v-else class="dock-content validation-content">
      <div v-if="!validation" class="empty-panel">Validate the current draft against Maze.</div>
      <div v-else-if="validation.valid" class="validation-success">
        <strong>Chain is valid</strong>
        <span>{{ validation.warnings.length }} warning(s)</span>
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
  </section>
</template>
