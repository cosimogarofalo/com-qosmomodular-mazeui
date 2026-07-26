<script setup lang="ts">
import { computed } from 'vue'

import {
  processorTone,
  processorVisualType,
} from '@/services/processorVisuals'

const props = defineProps<{
  type: string
}>()

const visual = computed(() => processorVisualType(props.type))
const tone = computed(() => processorTone(props.type))
</script>

<template>
  <svg
    class="processor-glyph"
    :class="`tone-${tone}`"
    :data-visual="visual"
    viewBox="0 0 64 44"
    aria-hidden="true"
  >
    <path class="glyph-grid" d="M4 35.5h56M10 6v32M32 6v32M54 6v32" />

    <g v-if="visual === 'ATTENUATE'">
      <path class="glyph-line" d="M7 14v16m6-19v22m6-17v12m6-9v6m7-4h8m-4-4 4 4-4 4" />
      <path class="glyph-soft" d="m30 11 23 23m0 0v-9m0 9h-9" />
    </g>

    <g v-else-if="visual === 'BOOST'">
      <path class="glyph-line" d="M7 20v4m6-7v10m6-14v18m6-22v26m7 4h8m-4-4 4 4-4 4" />
      <path class="glyph-soft" d="M31 33 54 10m0 0v9m0-9h-9" />
    </g>

    <g v-else-if="visual === 'CHORUS'">
      <path class="glyph-soft" d="M5 17c8-12 14 12 22 0s14 12 22 0 8-2 10 0" />
      <path class="glyph-line" d="M5 23c8-12 14 12 22 0s14 12 22 0 8-2 10 0" />
      <path class="glyph-faint" d="M5 29c8-12 14 12 22 0s14 12 22 0 8-2 10 0" />
    </g>

    <g v-else-if="visual === 'COMPRESS'">
      <path class="glyph-faint" d="M8 34 55 8M31 35V7M7 23h49" />
      <path class="glyph-line" d="M8 34 31 22 55 16" />
      <circle class="glyph-dot" cx="31" cy="22" r="2.5" />
    </g>

    <g v-else-if="visual === 'DELAY'">
      <path class="glyph-line" d="M8 30V12h8v18M25 30V17h7v13M41 30v-8h6v8M54 30v-4h4v4" />
      <path class="glyph-faint" d="M8 36h50" />
    </g>

    <g v-else-if="visual === 'EQUALIZE'">
      <path class="glyph-line" d="M5 29c8 0 10 7 18-4s12-15 20-6 11 2 16-4" />
      <circle class="glyph-dot" cx="17" cy="30" r="2.2" />
      <circle class="glyph-dot" cx="35" cy="17" r="2.2" />
      <circle class="glyph-dot" cx="51" cy="19" r="2.2" />
    </g>

    <g v-else-if="visual === 'FLANGE'">
      <path class="glyph-line" d="M5 15c8-12 14 12 22 0s14 12 22 0 8-2 10 0" />
      <path class="glyph-soft" d="M5 29c8 12 14-12 22 0s14-12 22 0 8 2 10 0" />
      <circle class="glyph-dot" cx="32" cy="22" r="2.5" />
    </g>

    <g v-else-if="visual === 'GRANULATE'">
      <circle class="glyph-dot" cx="10" cy="27" r="2.5" />
      <circle class="glyph-dot" cx="16" cy="15" r="1.8" />
      <circle class="glyph-dot" cx="23" cy="31" r="3.2" />
      <circle class="glyph-dot" cx="29" cy="11" r="2.3" />
      <circle class="glyph-dot" cx="35" cy="24" r="1.7" />
      <circle class="glyph-dot" cx="42" cy="15" r="3" />
      <circle class="glyph-dot" cx="49" cy="30" r="2.2" />
      <circle class="glyph-dot" cx="56" cy="20" r="1.8" />
      <path class="glyph-faint" d="m8 34 48-25" />
    </g>

    <g v-else-if="visual === 'LIMIT'">
      <path class="glyph-faint" d="M6 12h52" />
      <path class="glyph-line" d="M7 35 35 12h23" />
      <circle class="glyph-dot" cx="35" cy="12" r="2.4" />
    </g>

    <g v-else-if="visual === 'NOISE_GATE'">
      <path class="glyph-faint glyph-dashed" d="M5 14h54" />
      <path class="glyph-line" d="M5 28h11v-8h5v-7h6v18h6V13h6v7h5v8h15" />
    </g>

    <g v-else-if="visual === 'PITCH_SHIFT'">
      <path class="glyph-soft" d="M5 31c7-8 12 8 19 0s12 8 19 0 11 4 16 0" />
      <path class="glyph-line" d="M5 17c7-8 12 8 19 0s12 8 19 0 11 4 16 0" />
      <path class="glyph-faint" d="M32 29V12m-4 4 4-4 4 4" />
    </g>

    <g v-else-if="visual === 'REVERB'">
      <path class="glyph-line" d="M8 31V10" />
      <path class="glyph-line" d="M12 13c9 2 9 16 0 18M18 15c8 3 8 11 0 14M24 17c7 2 7 7 0 10" />
      <path class="glyph-soft" d="M31 19c6 2 6 4 0 6M40 20c4 1 4 2 0 4M49 21h8" />
    </g>

    <g v-else-if="visual === 'SATURATE'">
      <path class="glyph-faint" d="M7 10h50M7 34h50" />
      <path class="glyph-line" d="M7 33c15 0 14-22 29-22h21" />
      <path class="glyph-soft" d="M7 29c12 0 13-15 25-15h25" />
    </g>

    <g v-else-if="visual === 'STEREO_IMAGE'">
      <path class="glyph-faint" d="M32 36V9M32 36 9 17M32 36l23-19M32 36 5 27M32 36l27-9" />
      <path class="glyph-line" d="M12 28c5-12 13-17 20-17s15 5 20 17" />
      <path class="glyph-soft" d="M19 31c3-8 8-12 13-12s10 4 13 12" />
      <circle class="glyph-dot" cx="32" cy="36" r="2.4" />
    </g>

    <g v-else-if="visual === 'TIME_STRETCH'">
      <path class="glyph-line" d="M15 22h3l2-9 4 18 4-14 4 10 4-17 4 22 3-10h6" />
      <path class="glyph-soft" d="M12 10 5 17l7 7M52 10l7 7-7 7" />
    </g>

    <g v-else-if="visual === 'TONE'">
      <path class="glyph-line" d="M5 30h11c7 0 6-16 14-16h29" />
      <circle class="glyph-dot" cx="16" cy="30" r="2.4" />
      <circle class="glyph-dot" cx="30" cy="14" r="2.4" />
      <path class="glyph-faint" d="M16 8v27M30 8v27" />
    </g>

    <g v-else-if="visual === 'TRANSIENT_DESIGN'">
      <path class="glyph-line" d="M5 28h8l3-16 4 25 5-12 4 5h8l4-20 4 27 5-11 4 2h5" />
      <path class="glyph-soft" d="M5 33h54" />
    </g>

    <g v-else-if="visual === 'VIBRATO'">
      <path class="glyph-line" d="M5 22c8-15 14 15 22 0s14 15 22 0 8-3 10 0" />
      <path class="glyph-soft" d="M17 8v8m-3-4 3 4 3-4M45 36v-8m-3 4 3-4 3 4" />
    </g>

    <g v-else-if="visual === 'VOICE_ENHANCE'">
      <rect class="glyph-soft-fill" x="27" y="8" width="10" height="20" rx="5" />
      <path class="glyph-line" d="M22 22c0 7 4 11 10 11s10-4 10-11M32 33v6M25 39h14" />
      <path class="glyph-soft" d="M15 16c-4 4-4 8 0 12M49 16c4 4 4 8 0 12" />
      <path class="glyph-faint" d="M9 12c-7 7-7 17 0 24M55 12c7 7 7 17 0 24" />
    </g>

    <g v-else-if="visual === 'WAH_WAH'">
      <path class="glyph-line" d="M5 34c11 0 12-24 24-24s13 24 30 24" />
      <path class="glyph-soft" d="M15 14h32m-7-6 7 6-7 6" />
      <circle class="glyph-dot" cx="29" cy="10" r="2.5" />
    </g>

    <g v-else>
      <path class="glyph-line" d="M5 22h6l3-11 5 23 5-17 5 10 5-19 5 27 5-18 5 9h10" />
    </g>
  </svg>
</template>
