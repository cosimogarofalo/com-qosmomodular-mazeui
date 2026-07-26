// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '@/components/AppHeader.vue'
import AudioComparison from '@/components/AudioComparison.vue'
import ProcessorLibrary from '@/components/ProcessorLibrary.vue'
import RenderTransport from '@/components/RenderTransport.vue'
import { mazeApi } from '@/services/mazeApi'
import { useChainStore } from '@/stores/chain'
import StudioView from '@/views/StudioView.vue'
import type { AudioInput, Processor } from '@/types/maze'

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
