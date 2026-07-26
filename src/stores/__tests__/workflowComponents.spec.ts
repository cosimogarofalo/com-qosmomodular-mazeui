// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '@/components/AppHeader.vue'
import AudioComparison from '@/components/AudioComparison.vue'
import ProcessorInspector from '@/components/ProcessorInspector.vue'
import ProcessorLibrary from '@/components/ProcessorLibrary.vue'
import RenderTransport from '@/components/RenderTransport.vue'
import { mazeApi } from '@/services/mazeApi'
import { useChainStore } from '@/stores/chain'
import StudioView from '@/views/StudioView.vue'
import type { AudioInput, ChainEffectDraft, Processor } from '@/types/maze'

function processor(id: string, inputTypes: string[]): Processor {
  return {
    id,
    name: id,
    type: 'TEST',
    subType: 'TEST',
    genre: 'FIXED',
    inputTypes,
    outputType: 'PRESERVE',
    sourceBinding: 'NONE',
    description: 'Processor description',
    useWhen: [],
    perceivedEffect: '',
    category: 'test',
    position: 'middle',
    params: [],
  }
}

const input: AudioInput = {
  id: 'input-id',
  fileName: 'voice.wav',
  format: 'WAV',
  sizeBytes: 4096,
  sampleRate: 48_000,
  channels: 1,
  totalFrames: 96_000,
  durationSeconds: 2,
  sha256: 'a'.repeat(64),
  contentUrl: '/api/audio/inputs/input-id/content',
}

describe('critical workflow components', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('prevents stereo-only processor placement for a mono input', async () => {
    const mono = processor('mono-safe', ['MONO', 'STEREO'])
    const simpleImager = processor('simple-imager', ['STEREO'])
    const advancedImager = processor('advanced-imager', ['STEREO'])
    const wrapper = mount(ProcessorLibrary, {
      props: {
        processors: [mono, simpleImager, advancedImager],
        loading: false,
        currentTopology: 'MONO',
        inputSelected: true,
      },
    })
    const rows = wrapper.findAll('button.processor-row')

    expect(rows[0]?.attributes('disabled')).toBeUndefined()
    expect(rows[1]?.attributes('disabled')).toBeDefined()
    expect(rows[2]?.attributes('disabled')).toBeDefined()
    await rows[1]?.trigger('click')
    expect(wrapper.emitted('add')).toBeUndefined()
    await rows[0]?.trigger('click')
    expect(wrapper.emitted('add')?.[0]).toEqual([mono])

    await wrapper.setProps({ currentTopology: 'STEREO' })
    expect(wrapper.findAll('button.processor-row')[1]?.attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('button.processor-row')[2]?.attributes('disabled')).toBeUndefined()
  })

  it('uses managed input controls and emits browser uploads without path fields', async () => {
    const wrapper = mount(RenderTransport, {
      props: {
        inputs: [input],
        selectedInputId: input.id,
        inputsLoading: false,
        uploading: false,
        audioError: null,
        chainName: 'Voice chain',
        outputBaseName: 'render',
        outputFormat: 'WAV',
        canRender: true,
        renderReason: 'Ready to render',
        rendering: false,
      },
    })

    expect(wrapper.text()).not.toContain('C:/')
    expect(wrapper.find('[aria-label="Safe output base name"]').exists()).toBe(true)
    await wrapper.find('.render-button').trigger('click')
    expect(wrapper.emitted('render')).toHaveLength(1)

    const file = new File(['wave'], 'new-voice.wav', { type: 'audio/wav' })
    const picker = wrapper.find('input[type="file"]')
    Object.defineProperty(picker.element, 'files', { value: [file] })
    await picker.trigger('change')
    expect(wrapper.emitted('upload')?.[0]?.[0]).toBe(file)
  })

  it('highlights the selected A/B source and clears it when playback pauses', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const wrapper = mount(AudioComparison, {
      props: {
        originalUrl: '/api/audio/inputs/input/content',
        renderedUrl: '/api/jobs/job/outputs/0/content',
      },
    })
    const buttons = wrapper.findAll('.ab-actions button')

    expect(buttons[0]?.classes()).toContain('button-ghost')
    expect(buttons[1]?.classes()).toContain('button-ghost')

    await buttons[1]?.trigger('click')
    expect(buttons[1]?.classes()).toContain('button-primary')
    expect(buttons[0]?.classes()).toContain('button-ghost')

    await buttons[0]?.trigger('click')
    expect(buttons[0]?.classes()).toContain('button-primary')
    expect(buttons[1]?.classes()).toContain('button-ghost')

    await buttons[2]?.trigger('click')
    expect(buttons[0]?.classes()).toContain('button-ghost')
    expect(buttons[1]?.classes()).toContain('button-ghost')
  })

  it('exposes auto validation as an explicit pressed-state toggle', async () => {
    const wrapper = mount(AppHeader, {
      props: {
        mazeStatus: 'connected',
        mazeVersion: '0.8.0',
        uiVersion: '0.8.0',
        chainName: 'Voice chain',
        dirty: true,
        autoValidate: false,
      },
    })
    const button = wrapper.find('.auto-validate-button')

    expect(wrapper.find('.brand-block span').text()).toContain('UI 0.8.0')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.classes()).not.toContain('active')
    await button.trigger('click')
    expect(wrapper.emitted('toggleAutoValidate')).toHaveLength(1)

    await wrapper.setProps({ autoValidate: true })
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.classes()).toContain('active')
  })

  it('keeps dryWet integer even with a catalog cached from an older server', async () => {
    const chorus: Processor = {
      ...processor('PR-MOD-SI-CH-01', ['MONO', 'STEREO']),
      type: 'CHORUS',
      params: [
        {
          name: 'dryWet',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 50,
          unit: '%',
          options: [],
          description: 'Dry/wet mix',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect: ChainEffectDraft = {
      key: 'chorus-1',
      processorId: chorus.id,
      enabled: true,
      params: {
        dryWet: {
          value: 50,
          regions: [],
        },
      },
    }
    const wrapper = mount(ProcessorInspector, {
      props: { processor: chorus, effect },
    })
    const controls = wrapper.findAll('.number-control input')

    expect(controls[0]?.attributes('step')).toBe('1')
    expect(controls[1]?.attributes('step')).toBe('1')
    await controls[1]?.setValue('15.91')

    const updates = wrapper.emitted('update') ?? []
    expect(updates[updates.length - 1]).toEqual(['dryWet', 16])
  })

  it('keeps the full inputLevel scale but inhibits values outside ATT or AMP', async () => {
    const chorus: Processor = {
      ...processor('PR-MOD-SI-CH-01', ['MONO', 'STEREO']),
      type: 'CHORUS',
      params: [
        {
          name: 'inputType',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'ATT',
          unit: null,
          options: ['ATT', 'AMP'],
          description: 'Input stage type',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'inputLevel',
          type: 'number',
          min: -127,
          max: 31,
          rangeBy: 'inputType',
          ranges: {
            ATT: { min: -127, max: 0 },
            AMP: { min: 0, max: 31 },
          },
          defaultValue: 0,
          unit: 'dB',
          options: [],
          description: 'Input level',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect: ChainEffectDraft = {
      key: 'chorus-1',
      processorId: chorus.id,
      enabled: true,
      params: {
        inputType: { value: 'ATT', regions: [] },
        inputLevel: { value: -12, regions: [] },
      },
    }
    const wrapper = mount(ProcessorInspector, {
      props: { processor: chorus, effect },
    })
    const slider = wrapper.find('.number-control input[type="range"]')

    expect(slider.attributes('min')).toBe('-127')
    expect(slider.attributes('max')).toBe('31')
    await slider.setValue('10')
    let updates = wrapper.emitted('update') ?? []
    expect(updates[updates.length - 1]).toEqual(['inputLevel', 0])

    await wrapper.find('select').setValue('AMP')
    updates = wrapper.emitted('update') ?? []
    expect(updates.slice(-2)).toEqual([
      ['inputType', 'AMP'],
      ['inputLevel', 0],
    ])

    await wrapper.setProps({
      effect: {
        ...effect,
        params: {
          ...effect.params,
          inputType: { value: 'AMP', regions: [] },
          inputLevel: { value: 6, regions: [] },
        },
      },
    })
    await slider.setValue('-10')
    updates = wrapper.emitted('update') ?? []
    expect(updates[updates.length - 1]).toEqual(['inputLevel', 0])
  })

  it('auto-validates the latest complete draft after the debounce window', async () => {
    vi.useFakeTimers()
    const monoProcessor = processor('mono-safe', ['MONO', 'STEREO'])
    vi.spyOn(mazeApi, 'health').mockResolvedValue({
      status: 'ok',
      service: 'maze-rest',
      version: '0.8.0',
    })
    vi.spyOn(mazeApi, 'processors').mockResolvedValue({
      processors: [monoProcessor],
    })
    vi.spyOn(mazeApi, 'audioInputs').mockResolvedValue({ inputs: [input] })
    const validate = vi.spyOn(mazeApi, 'validateChain').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    })
    const pinia = createPinia()
    const wrapper = mount(StudioView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()
    const chain = useChainStore(pinia)
    chain.bindInput(input, [monoProcessor])
    chain.addProcessor(monoProcessor, input)
    await wrapper.vm.$nextTick()

    await wrapper.find('.auto-validate-button').trigger('click')
    await vi.advanceTimersByTimeAsync(649)
    expect(validate).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(1)
    expect(validate.mock.calls[0]?.[0].inputBindings[0]?.inputId).toBe(input.id)
    wrapper.unmount()
  })
})
