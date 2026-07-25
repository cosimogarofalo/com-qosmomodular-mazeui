<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Processor } from '@/types/maze'

const props = defineProps<{
  processors: Processor[]
  loading: boolean
  error?: string | null
}>()

defineEmits<{
  add: [processor: Processor]
  retry: []
}>()

const query = ref('')

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
          type="button"
          :title="processor.description"
          @click="$emit('add', processor)"
        >
          <span class="processor-icon">∿</span>
          <span class="processor-copy">
            <strong>{{ processor.name }}</strong>
            <small>{{ processor.id }}</small>
          </span>
          <span class="add-glyph">+</span>
        </button>
      </section>
    </div>
  </aside>
</template>
