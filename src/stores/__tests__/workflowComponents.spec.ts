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

  it('loops either A/B source through an explicit pressed-state toggle', async () => {
    const wrapper = mount(AudioComparison, {
      props: {
        originalUrl: '/api/audio/inputs/input/content',
        renderedUrl: '/api/jobs/job/outputs/0/content',
      },
    })
    const loopButton = wrapper.find('.loop-playback-button')
    const players = wrapper.findAll('audio')

    expect(loopButton.attributes('aria-pressed')).toBe('false')
    expect(loopButton.classes()).toContain('button-ghost')
    expect(players.every((player) => player.element.loop === false)).toBe(true)

    await loopButton.trigger('click')

    expect(loopButton.attributes('aria-pressed')).toBe('true')
    expect(loopButton.classes()).toContain('button-primary')
    expect(players.every((player) => player.element.loop === true)).toBe(true)
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
        overwriteExisting: true,
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

  it('exposes overwrite as an explicit pressed-state toggle', async () => {
    const wrapper = mount(AppHeader, {
      props: {
        mazeStatus: 'connected',
        mazeVersion: '0.8.0',
        uiVersion: '0.8.0',
        chainName: 'Voice chain',
        dirty: true,
        autoValidate: false,
        overwriteExisting: false,
      },
    })
    const button = wrapper.find('.overwrite-button')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.classes()).not.toContain('active')
    await button.trigger('click')
    expect(wrapper.emitted('toggleOverwriteExisting')).toHaveLength(1)

    await wrapper.setProps({ overwriteExisting: true })
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

  it('guides filter-dependent controls, poles, and modulation destinations', async () => {
    const filteredDelay: Processor = {
      ...processor('PR-TIB-FI-DE-01', ['MONO', 'STEREO']),
      type: 'DELAY',
      params: [
        {
          name: 'filterType',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'LP',
          unit: null,
          options: ['LP', 'HP', 'BP', 'BS', 'LS', 'HS', 'PN'],
          description: 'Filter type',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'filterPoles',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: '1P',
          unit: null,
          options: ['1P', '2P', '3P', '4P', '6P', '8P'],
          optionsBy: 'filterType',
          optionsFor: {
            LP: ['1P', '2P', '3P', '4P'],
            BP: ['2P', '4P', '6P', '8P'],
            PN: ['2P'],
          },
          description: 'Filter poles',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'filterFrequency',
          type: 'number',
          min: 20,
          max: 20_000,
          defaultValue: 2_000,
          unit: 'Hz',
          options: [],
          description: 'Filter frequency',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'filterBandwidth',
          type: 'number',
          min: 20,
          max: 10_000,
          defaultValue: 500,
          unit: 'Hz',
          options: [],
          visibleBy: 'filterType',
          visibleFor: ['BP', 'BS', 'PN'],
          description: 'Filter bandwidth',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'filterGain',
          type: 'number',
          min: -24,
          max: 24,
          defaultValue: 6,
          unit: 'dB',
          options: [],
          visibleBy: 'filterType',
          visibleFor: ['LS', 'HS', 'PN'],
          description: 'Filter gain',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'modDestination',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'FILTER_FREQUENCY',
          unit: null,
          options: [
            'NONE',
            'DELAY',
            'GAIN',
            'FEEDBACK',
            'FILTER_GAIN',
            'FILTER_FREQUENCY',
            'FILTER_BANDWIDTH',
          ],
          optionsBy: 'filterType',
          optionsFor: {
            LP: ['NONE', 'DELAY', 'GAIN', 'FEEDBACK', 'FILTER_FREQUENCY'],
            BP: [
              'NONE',
              'DELAY',
              'GAIN',
              'FEEDBACK',
              'FILTER_FREQUENCY',
              'FILTER_BANDWIDTH',
            ],
            PN: [
              'NONE',
              'DELAY',
              'GAIN',
              'FEEDBACK',
              'FILTER_GAIN',
              'FILTER_FREQUENCY',
              'FILTER_BANDWIDTH',
            ],
          },
          description: 'Modulation destination',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect = (filterType: string, filterPoles: string): ChainEffectDraft => ({
      key: 'filtered-delay-1',
      processorId: filteredDelay.id,
      enabled: true,
      params: {
        filterType: { value: filterType, regions: [] },
        filterPoles: { value: filterPoles, regions: [] },
        filterFrequency: { value: 2_000, regions: [] },
        filterBandwidth: { value: 500, regions: [] },
        filterGain: { value: 6, regions: [] },
        modDestination: { value: 'FILTER_FREQUENCY', regions: [] },
      },
    })
    const wrapper = mount(ProcessorInspector, {
      props: { processor: filteredDelay, effect: effect('LP', '1P') },
    })
    const control = (name: string) =>
      wrapper
        .findAll('.parameter-control')
        .find((candidate) => candidate.find('.parameter-label').text().startsWith(name))
    const enabledOptions = (name: string) =>
      control(name)
        ?.findAll('option')
        .filter((option) => option.attributes('disabled') === undefined)
        .map((option) => option.text())

    expect(control('filterBandwidth')).toBeUndefined()
    expect(control('filterGain')).toBeUndefined()
    expect(enabledOptions('filterPoles')).toEqual(['1P', '2P', '3P', '4P'])
    expect(enabledOptions('modDestination')).toEqual([
      'NONE',
      'DELAY',
      'GAIN',
      'FEEDBACK',
      'FILTER_FREQUENCY',
    ])

    await control('filterType')?.find('select').setValue('BP')
    expect(wrapper.emitted('update')?.slice(-2)).toEqual([
      ['filterType', 'BP'],
      ['filterPoles', '2P'],
    ])

    await wrapper.setProps({ effect: effect('BP', '2P') })
    expect(control('filterBandwidth')).toBeDefined()
    expect(control('filterGain')).toBeUndefined()
    expect(enabledOptions('filterPoles')).toEqual(['2P', '4P', '6P', '8P'])
    expect(enabledOptions('modDestination')).toContain('FILTER_BANDWIDTH')

    await wrapper.setProps({ effect: effect('PN', '2P') })
    expect(control('filterBandwidth')).toBeDefined()
    expect(control('filterGain')).toBeDefined()
    expect(enabledOptions('filterPoles')).toEqual(['2P'])
    expect(enabledOptions('modDestination')).toEqual([
      'NONE',
      'DELAY',
      'GAIN',
      'FEEDBACK',
      'FILTER_GAIN',
      'FILTER_FREQUENCY',
      'FILTER_BANDWIDTH',
    ])
  })

  it('shows a static phosphor waveform for lfoWave on any processor', async () => {
    const modulator: Processor = {
      ...processor('arbitrary-modulator', ['MONO', 'STEREO']),
      type: 'DELAY',
      params: [
        {
          name: 'lfoWave',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'UNIPOLAR_TRIANGLE',
          unit: null,
          options: ['UNIPOLAR_TRIANGLE', 'BIPOLAR_SQUARE'],
          description: 'LFO waveform',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect: ChainEffectDraft = {
      key: 'modulator-1',
      processorId: modulator.id,
      enabled: true,
      params: {
        lfoWave: {
          value: 'UNIPOLAR_TRIANGLE',
          regions: [],
        },
      },
    }
    const wrapper = mount(ProcessorInspector, {
      props: { processor: modulator, effect },
    })
    const scope = wrapper.find('.lfo-scope')
    const trianglePath = wrapper.find('.scope-trace').attributes('d')

    expect(scope.attributes('data-wave')).toBe('UNIPOLAR_TRIANGLE')
    expect(scope.text()).toContain('offset +0.5')
    expect(trianglePath).toMatch(/^M13\.00 39\.00 L/)
    expect(trianglePath).toContain(' 10.00')
    expect(trianglePath).toContain(' 68.00')

    await wrapper.setProps({
      effect: {
        ...effect,
        params: {
          lfoWave: {
            value: 'BIPOLAR_SQUARE',
            regions: [],
          },
        },
      },
    })
    expect(scope.attributes('data-wave')).toBe('BIPOLAR_SQUARE')
    expect(scope.text()).toContain('zero centered')
    expect(wrapper.find('.scope-trace').attributes('d')).not.toBe(trianglePath)
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
