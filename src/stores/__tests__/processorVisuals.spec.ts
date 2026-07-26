// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProcessorGlyph from '@/components/ProcessorGlyph.vue'
import {
  PROCESSOR_VISUAL_TYPES,
  processorTone,
  processorVisualType,
} from '@/services/processorVisuals'

const distributedTypes = [
  'ATTENUATE',
  'BOOST',
  'CHORUS',
  'COMPRESS',
  'DELAY',
  'EQUALIZE',
  'FLANGE',
  'GRANULATE',
  'LIMIT',
  'NOISE_GATE',
  'PITCH_SHIFT',
  'REVERB',
  'SATURATE',
  'STEREO_IMAGE',
  'TIME_STRETCH',
  'TONE',
  'TRANSIENT_DESIGN',
  'VIBRATO',
  'VOICE_ENHANCE',
  'WAH_WAH',
] as const

describe('processor visual system', () => {
  it('covers every processor type in the 35-definition Maze catalog', () => {
    expect(PROCESSOR_VISUAL_TYPES).toEqual(distributedTypes)

    for (const type of distributedTypes) {
      expect(processorVisualType(type)).toBe(type)
      expect(['blue', 'cyan', 'violet', 'green', 'amber']).toContain(
        processorTone(type),
      )
    }
  })

  it('renders a characteristic vector glyph for every known type', () => {
    const rendered = distributedTypes.map((type) => {
      const wrapper = mount(ProcessorGlyph, { props: { type } })
      expect(wrapper.attributes('data-visual')).toBe(type)
      expect(wrapper.find('g').exists()).toBe(true)
      return wrapper.html()
    })

    expect(new Set(rendered).size).toBe(distributedTypes.length)
  })

  it('keeps future unknown types visible through a generic waveform', () => {
    const wrapper = mount(ProcessorGlyph, { props: { type: 'FUTURE_PROCESSOR' } })

    expect(wrapper.attributes('data-visual')).toBe('GENERIC')
    expect(wrapper.classes()).toContain('tone-blue')
  })
})
