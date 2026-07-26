<script setup lang="ts">
import { computed, ref } from 'vue'

import ProcessorGlyph from '@/components/ProcessorGlyph.vue'
import type { AudioTopology, Processor } from '@/types/maze'

const props = defineProps<{
  processors: Processor[]
  loading: boolean
  error?: string | null
  currentTopology: AudioTopology | null
  inputSelected: boolean
}>()

defineEmits<{
  add: [processor: Processor]
  retry: []
}>()

const query = ref('')

function availabilityReason(processor: Processor): string | null {
  if (!props.currentTopology) return 'Select an input first'
  if (!processor.inputTypes.includes(props.currentTopology)) {
    return `Requires ${processor.inputTypes.join(' or ')} input`
  }
  if (processor.sourceBinding === 'REQUIRED' && !props.inputSelected) {
    return 'Requires a managed source binding'
  }
  return null
}

const categories = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const filtered = normalizedQuery
    ? props.processors.filter((processor) =>
        [processor.name, processor.id, processor.type, processor.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : props.processors

  return Object.entries(
    filtered.reduce<Record<string, Processor[]>>((groups, processor) => {
      const key = processor.type || 'OTHER'
      ;(groups[key] ||= []).push(processor)
      return groups
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right))
})
</script>

<template>
  <aside class="panel processor-library">
    <div class="panel-heading">
      <span>Processors</span>
      <span class="count-pill">{{ processors.length }}</span>
    </div>

    <label class="search-box">
      <span aria-hidden="true">⌕</span>
      <input v-model="query" type="search" placeholder="Search processors…" />
    </label>

    <div v-if="loading" class="empty-panel">Connecting to Maze…</div>
    <div v-else-if="error" class="empty-panel error-panel">
      <strong>Maze REST is offline</strong>
      <span>{{ error }}</span>
      <button class="button button-ghost" type="button" @click="$emit('retry')">Retry</button>
    </div>
    <div v-else-if="categories.length === 0" class="empty-panel">
      No processors found.
    </div>

    <div v-else class="processor-groups">
      <section v-for="[category, items] in categories" :key="category" class="processor-group">
        <header>
          <span>{{ category }}</span>
          <span class="count-pill">{{ items.length }}</span>
        </header>
        <button
          v-for="processor in items"
          :key="processor.id"
          class="processor-row"
          :class="{ unavailable: availabilityReason(processor) }"
          type="button"
          :disabled="Boolean(availabilityReason(processor))"
          :title="availabilityReason(processor) || processor.description"
          @click="$emit('add', processor)"
        >
          <span class="processor-icon">
            <ProcessorGlyph :type="processor.type" />
          </span>
          <span class="processor-copy">
            <strong>{{ processor.name }}</strong>
            <small>
              {{ availabilityReason(processor) || processor.inputTypes.join(' / ') }}
            </small>
          </span>
          <span class="add-glyph">+</span>
        </button>
      </section>
    </div>
  </aside>
</template>
