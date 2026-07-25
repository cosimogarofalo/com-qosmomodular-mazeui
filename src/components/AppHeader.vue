<script setup lang="ts">
import type { MazeConnectionStatus } from '@/stores/maze'

defineProps<{
  mazeStatus: MazeConnectionStatus
  mazeVersion?: string
  chainName: string
  dirty: boolean
}>()

defineEmits<{
  reconnect: []
  newChain: []
  validate: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="brand-block">
      <div class="brand-mark" aria-hidden="true">M</div>
      <div>
        <strong>MAZE</strong>
        <span>Chain Editor</span>
      </div>
    </div>

    <div class="chain-title">
      <span>{{ chainName }}</span>
      <small v-if="dirty">Unsaved</small>
    </div>

    <div class="header-actions">
      <button class="connection-button" type="button" @click="$emit('reconnect')">
        <span class="status-dot" :class="`is-${mazeStatus}`" />
        Maze {{ mazeStatus }}
        <small v-if="mazeVersion">{{ mazeVersion }}</small>
      </button>
      <button class="button button-ghost" type="button" @click="$emit('newChain')">
        New
      </button>
      <button class="button button-primary" type="button" @click="$emit('validate')">
        Validate
      </button>
    </div>
  </header>
</template>
