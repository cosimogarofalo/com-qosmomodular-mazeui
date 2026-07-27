// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '@/components/AppHeader.vue'
import AudioComparison from '@/components/AudioComparison.vue'
import BottomDock from '@/components/BottomDock.vue'
import ProcessorInspector from '@/components/ProcessorInspector.vue'
import ProcessorLibrary from '@/components/ProcessorLibrary.vue'
import ProcessorVisualization from '@/components/ProcessorVisualization.vue'
import RenderTransport from '@/components/RenderTransport.vue'
import {
  AUDIO_METER_FLOOR_DB,
  calculateAudioMeterLevels,
} from '@/services/audioMeter'
import { mazeApi } from '@/services/mazeApi'
import { useChainStore } from '@/stores/chain'
import StudioView from '@/views/StudioView.vue'
import type {
  AudioInput,
  ChainEffectDraft,
  Processor,
  ProcessorParam,
} from '@/types/maze'

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

function numericParam(
  name: string,
  defaultValue: number,
  unit = 'dB',
): ProcessorParam {
  return {
    name,
    type: 'number',
    min: -60,
    max: 24,
    defaultValue,
    unit,
    options: [],
    description: name,
    regional: false,
    sourceDerived: false,
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

  it('keeps the Processor tab selected when auto-validation completes', async () => {
    const wrapper = mount(BottomDock, {
      props: {
        effects: [],
        processors: [],
        yaml: '',
        validation: null,
        validationError: null,
        validating: false,
        job: null,
        jobLogs: [],
        outputs: [],
        jobError: null,
        jobBusy: false,
        originalUrl: '',
      },
    })
    const processorTab = wrapper
      .findAll('.dock-tabs button')
      .find((button) => button.text() === 'processor')

    expect(processorTab).toBeDefined()
    await processorTab?.trigger('click')
    await wrapper.setProps({
      validation: {
        valid: true,
        errors: [],
        warnings: [],
      },
    })

    expect(processorTab?.classes()).toContain('active')
    expect(wrapper.find('.processor-content').exists()).toBe(true)
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

  it('aligns amplitude and spectrum visualizers above both A/B players', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const wrapper = mount(AudioComparison, {
      props: {
        originalUrl: '/api/audio/inputs/input/content',
        renderedUrl: '/api/jobs/job/outputs/0/content',
      },
    })
    const cards = wrapper.findAll('.audio-source-card')

    expect(cards).toHaveLength(2)
    expect(cards[0]?.findAll('canvas')).toHaveLength(2)
    expect(cards[1]?.findAll('canvas')).toHaveLength(2)
    expect(
      wrapper.find('[aria-label="Original audio amplitude waveform"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Original audio frequency spectrum"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Rendered audio amplitude waveform"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Rendered audio frequency spectrum"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Original audio RMS and peak meter"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Rendered audio RMS and peak meter"]').exists(),
    ).toBe(true)

    const analysisLayouts = wrapper.findAll('.audio-analysis-layout')
    expect(analysisLayouts[0]?.element.firstElementChild?.classList).toContain(
      'audio-level-meter',
    )
    expect(analysisLayouts[1]?.element.lastElementChild?.classList).toContain(
      'audio-level-meter',
    )

    await wrapper.findAll('.ab-actions button')[1]?.trigger('click')
    expect(cards[0]?.classes()).not.toContain('active')
    expect(cards[1]?.classes()).toContain('active')
  })

  it('calculates RMS and sample peak meter levels in dBFS', () => {
    const halfScale = calculateAudioMeterLevels(
      new Float32Array([0.5, -0.5]),
    )
    expect(halfScale.rmsDb).toBeCloseTo(-6.0206, 3)
    expect(halfScale.peakDb).toBeCloseTo(-6.0206, 3)

    const transient = calculateAudioMeterLevels(new Float32Array([1, 0]))
    expect(transient.rmsDb).toBeCloseTo(-3.0103, 3)
    expect(transient.peakDb).toBe(0)

    const silence = calculateAudioMeterLevels(new Float32Array(32))
    expect(silence.rmsDb).toBe(AUDIO_METER_FLOOR_DB)
    expect(silence.peakDb).toBe(AUDIO_METER_FLOOR_DB)
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

  it('shows a reactive compressor transfer curve for threshold, ratio, and knee', async () => {
    const compressor: Processor = {
      ...processor('simple-compressor', ['MONO', 'STEREO']),
      type: 'COMPRESS',
      subType: 'SIMPLE',
      params: [
        numericParam('threshold', -20),
        numericParam('ratio', 4, ':1'),
        numericParam('knee', 6),
      ],
    }
    const effect = (
      threshold: number,
      ratio: number,
      knee: number,
    ): ChainEffectDraft => ({
      key: 'compressor-1',
      processorId: compressor.id,
      enabled: true,
      params: {
        threshold: { value: threshold, regions: [] },
        ratio: { value: ratio, regions: [] },
        knee: { value: knee, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: compressor,
        effect: effect(-20, 4, 6),
      },
    })
    const scope = wrapper.find('.compressor-scope')
    const initialPath = wrapper.find('.compressor-trace').attributes('d')

    expect(scope.attributes('data-curve-count')).toBe('1')
    expect(scope.text()).toContain('T -20.0 dB')
    expect(scope.text()).toContain('R 4.0:1')
    expect(scope.text()).toContain('K 6.0 dB')
    expect(wrapper.find('.compressor-reference').exists()).toBe(true)

    await wrapper.setProps({
      effect: effect(-36, 10, 0),
    })
    expect(scope.text()).toContain('T -36.0 dB')
    expect(scope.text()).toContain('R 10.0:1')
    expect(scope.text()).toContain('K 0.0 dB')
    expect(wrapper.find('.compressor-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('shows all four independent multiband compressor curves', () => {
    const bands = ['low', 'lowMid', 'highMid', 'high']
    const compressor: Processor = {
      ...processor('multiband-compressor', ['MONO', 'STEREO']),
      type: 'COMPRESS',
      subType: 'MULTIBAND',
      params: bands.flatMap((band, index) => [
        numericParam(`${band}Threshold`, -18 - index),
        numericParam(`${band}Ratio`, 2 + index, ':1'),
        numericParam(`${band}Knee`, 3 + index),
      ]),
    }
    const params = Object.fromEntries(
      compressor.params.map((param) => [
        param.name,
        { value: param.defaultValue, regions: [] },
      ]),
    ) as ChainEffectDraft['params']
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: compressor,
        effect: {
          key: 'multiband-compressor-1',
          processorId: compressor.id,
          enabled: true,
          params,
        },
      },
    })
    const scopes = wrapper.findAll('.compressor-scope')

    expect(scopes).toHaveLength(4)
    expect(scopes.every((scope) => scope.attributes('data-curve-count') === '1')).toBe(
      true,
    )
    expect(wrapper.findAll('.compressor-curve')).toHaveLength(4)
    expect(wrapper.text()).toContain('LOW')
    expect(wrapper.text()).toContain('LOW MID')
    expect(wrapper.text()).toContain('HIGH MID')
    expect(wrapper.text()).toContain('HIGH')
  })

  it('shows the Simple limiter transfer including gain, ratio, and ceiling', async () => {
    const limiter: Processor = {
      ...processor('simple-limiter', ['MONO', 'STEREO']),
      type: 'LIMIT',
      subType: 'SIMPLE',
      params: [
        numericParam('inputGain', 0),
        numericParam('threshold', -12),
        numericParam('outputCeiling', -1),
        numericParam('dryWet', 100, '%'),
        {
          name: 'mode',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'VCA',
          unit: null,
          options: ['VCA', 'DIODE', 'OPTICAL'],
          description: 'Limiter mode',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect = (
      inputGain: number,
      threshold: number,
      ceiling: number,
      mode: string,
    ): ChainEffectDraft => ({
      key: 'simple-limiter-1',
      processorId: limiter.id,
      enabled: true,
      params: {
        inputGain: { value: inputGain, regions: [] },
        threshold: { value: threshold, regions: [] },
        outputCeiling: { value: ceiling, regions: [] },
        dryWet: { value: 100, regions: [] },
        mode: { value: mode, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: limiter,
        effect: effect(0, -12, -1, 'VCA'),
      },
    })
    const scope = wrapper.find('.limiter-scope')
    const initialPath = wrapper.find('.limiter-trace').attributes('d')

    expect(scope.attributes('data-variant')).toBe('SIMPLE')
    expect(scope.text()).toContain('SIMPLE VCA')
    expect(scope.text()).toContain('T -12.0 dB')
    expect(scope.text()).toContain('R 20.0:1')
    expect(scope.text()).toContain('C -1.0 dB')

    await wrapper.setProps({
      effect: effect(8, -24, -3, 'OPTICAL'),
    })
    expect(scope.text()).toContain('SIMPLE OPTICAL')
    expect(scope.text()).toContain('G 8.0 dB')
    expect(wrapper.find('.limiter-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('shows the Bus limiter ceiling and reactive soft-clip stage', async () => {
    const limiter: Processor = {
      ...processor('bus-limiter', ['STEREO']),
      type: 'LIMIT',
      subType: 'BUS',
      params: [
        numericParam('inputGain', 0),
        numericParam('ceiling', -1),
        numericParam('softClipDrive', 0),
        {
          name: 'softClip',
          type: 'boolean',
          min: null,
          max: null,
          defaultValue: false,
          unit: null,
          options: [],
          description: 'Soft clip',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'transientMode',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'CLEAN',
          unit: null,
          options: ['CLEAN', 'PUNCHY', 'SMOOTH'],
          description: 'Transient mode',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect = (
      softClip: boolean,
      drive: number,
      transientMode: string,
    ): ChainEffectDraft => ({
      key: 'bus-limiter-1',
      processorId: limiter.id,
      enabled: true,
      params: {
        inputGain: { value: 0, regions: [] },
        ceiling: { value: -1, regions: [] },
        softClip: { value: softClip, regions: [] },
        softClipDrive: { value: drive, regions: [] },
        transientMode: { value: transientMode, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: limiter,
        effect: effect(false, 0, 'CLEAN'),
      },
    })
    const scope = wrapper.find('.limiter-scope')
    const initialPath = wrapper.find('.limiter-trace').attributes('d')

    expect(scope.attributes('data-variant')).toBe('BUS')
    expect(scope.text()).toContain('BUS CLEAN')
    expect(scope.text()).toContain('C -1.0 dBTP')
    expect(scope.text()).toContain('SOFT CLIP OFF')

    await wrapper.setProps({
      effect: effect(true, 6, 'SMOOTH'),
    })
    expect(scope.text()).toContain('BUS SMOOTH')
    expect(scope.text()).toContain('SOFT CLIP ON')
    expect(scope.text()).toContain('DRIVE 6.0 dB')
    expect(wrapper.find('.limiter-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('shows the Ten Band EQ bands and reactive combined response', async () => {
    const frequencies = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']
    const equalizer: Processor = {
      ...processor('ten-band-eq', ['MONO', 'STEREO']),
      type: 'EQUALIZE',
      subType: 'TEN_BANDS',
      params: frequencies.map((frequency) => numericParam(`band${frequency}`, 0)),
    }
    const effect = (low: number, presence: number): ChainEffectDraft => ({
      key: 'ten-band-eq-1',
      processorId: equalizer.id,
      enabled: true,
      params: Object.fromEntries(
        frequencies.map((frequency) => [
          `band${frequency}`,
          {
            value:
              frequency === '31' ? low : frequency === '4k' ? presence : 0,
            regions: [],
          },
        ]),
      ),
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: equalizer,
        effect: effect(0, 0),
        sampleRate: 48_000,
      },
    })
    const initialPath = wrapper.find('.eq-total-trace').attributes('d')

    expect(wrapper.find('.eq-scope').attributes('data-band-count')).toBe('10')
    expect(wrapper.findAll('.eq-band')).toHaveLength(10)
    expect(wrapper.text()).toContain('48000 Hz')

    await wrapper.setProps({ effect: effect(8, -6) })
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('shows Parametric EQ filter nodes and updates frequency, gain, Q, and slope', async () => {
    const equalizer: Processor = {
      ...processor('parametric-eq', ['MONO', 'STEREO']),
      type: 'EQUALIZE',
      subType: 'PARAMETRIC',
      params: [
        numericParam('inputGain', 0),
        numericParam('highPassFrequency', 30, 'Hz'),
        numericParam('bell1Frequency', 800, 'Hz'),
        numericParam('bell1Gain', 6),
        numericParam('bell1Q', 1, 'Q'),
        numericParam('outputGain', 0),
        numericParam('dryWet', 100, '%'),
      ],
    }
    const effect = (
      frequency: number,
      gain: number,
      q: number,
      slope: string,
    ): ChainEffectDraft => ({
      key: 'parametric-eq-1',
      processorId: equalizer.id,
      enabled: true,
      params: {
        inputGain: { value: 0, regions: [] },
        highPassEnabled: { value: true, regions: [] },
        highPassFrequency: { value: 30, regions: [] },
        highPassSlope: { value: slope, regions: [] },
        lowShelfEnabled: { value: false, regions: [] },
        bell1Enabled: { value: true, regions: [] },
        bell1Frequency: { value: frequency, regions: [] },
        bell1Gain: { value: gain, regions: [] },
        bell1Q: { value: q, regions: [] },
        highShelfEnabled: { value: false, regions: [] },
        lowPassEnabled: { value: false, regions: [] },
        outputGain: { value: 0, regions: [] },
        dryWet: { value: 100, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: equalizer,
        effect: effect(800, 6, 1, '2P'),
        sampleRate: 96_000,
      },
    })
    const initialPath = wrapper.find('.eq-total-trace').attributes('d')

    expect(wrapper.find('.eq-scope').attributes('data-band-count')).toBe('8')
    expect(wrapper.findAll('.eq-band')).toHaveLength(8)
    expect(wrapper.find('[data-label="HP"]').attributes('data-enabled')).toBe(
      'true',
    )
    expect(wrapper.find('[data-label="B1"]').attributes('data-enabled')).toBe(
      'true',
    )

    await wrapper.setProps({
      effect: effect(3_200, -9, 8, '4P'),
    })
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('labels Dynamic EQ curves as maximum detector-controlled range', async () => {
    const equalizer: Processor = {
      ...processor('dynamic-eq', ['MONO', 'STEREO']),
      type: 'EQUALIZE',
      subType: 'DYNAMIC',
      params: [
        numericParam('band1Frequency', 1_000, 'Hz'),
        numericParam('band1Range', -6),
        numericParam('band1Q', 2, 'Q'),
      ],
    }
    const effect = (range: number): ChainEffectDraft => ({
      key: 'dynamic-eq-1',
      processorId: equalizer.id,
      enabled: true,
      params: {
        band1Enabled: { value: true, regions: [] },
        band1Frequency: { value: 1_000, regions: [] },
        band1Range: { value: range, regions: [] },
        band1Q: { value: 2, regions: [] },
        dryWet: { value: 100, regions: [] },
        inputGain: { value: 0, regions: [] },
        outputGain: { value: 0, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: equalizer,
        effect: effect(-6),
      },
    })
    const initialPath = wrapper.find('.eq-total-trace').attributes('d')
    const scope = wrapper.find('.eq-scope')

    expect(scope.attributes('data-dynamic')).toBe('true')
    expect(scope.text()).toContain('maximum Range')
    expect(wrapper.findAll('.eq-band')).toHaveLength(6)

    await wrapper.setProps({ effect: effect(10) })
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(
      initialPath,
    )
  })

  it('shows reactive frequency responses for both Two and Three Knob Tone EQs', async () => {
    const tone = (
      subType: 'T2_KNOB' | 'T3_KNOB',
      bass: number,
      middle: number,
      treble: number,
    ) => {
      const processorDefinition: Processor = {
        ...processor(`tone-${subType}`, ['MONO', 'STEREO']),
        type: 'TONE',
        subType,
        params: [
          numericParam('bass', 0),
          ...(subType === 'T3_KNOB' ? [numericParam('middle', 0)] : []),
          numericParam('treble', 0),
        ],
      }
      const effect: ChainEffectDraft = {
        key: `tone-${subType}-1`,
        processorId: processorDefinition.id,
        enabled: true,
        params: {
          bass: { value: bass, regions: [] },
          ...(subType === 'T3_KNOB'
            ? { middle: { value: middle, regions: [] } }
            : {}),
          treble: { value: treble, regions: [] },
        },
      }
      return { processorDefinition, effect }
    }
    const twoKnob = tone('T2_KNOB', 6, 0, -4)
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: twoKnob.processorDefinition,
        effect: twoKnob.effect,
      },
    })

    expect(wrapper.find('.eq-scope').attributes('data-band-count')).toBe('2')
    expect(wrapper.text()).toContain('BASS')
    expect(wrapper.text()).toContain('TREBLE')

    const twoKnobPath = wrapper.find('.eq-total-trace').attributes('d')
    const threeKnob = tone('T3_KNOB', -5, 9, 3)
    await wrapper.setProps({
      processor: threeKnob.processorDefinition,
      effect: threeKnob.effect,
    })
    expect(wrapper.find('.eq-scope').attributes('data-band-count')).toBe('3')
    expect(wrapper.text()).toContain('MID')
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(
      twoKnobPath,
    )
  })

  it('shows the selected saturation transfer function as a phosphor trace', async () => {
    const saturator: Processor = {
      ...processor('simple-saturator', ['MONO', 'STEREO']),
      type: 'SATURATE',
      params: [
        {
          name: 'algorithm',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'COSINE',
          unit: null,
          options: ['COSINE', 'EXPONENTIAL', 'INVERSE_POWER'],
          description: 'Saturation algorithm',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'saturation',
          type: 'number',
          min: 1,
          max: 4,
          defaultValue: 2,
          unit: 'linear',
          options: [],
          description: 'Saturation amount',
          regional: false,
          sourceDerived: false,
        },
        {
          name: 'asymmetry',
          type: 'enum',
          min: null,
          max: null,
          defaultValue: 'false',
          unit: null,
          options: ['true', 'false'],
          description: 'Asymmetry',
          regional: false,
          sourceDerived: false,
        },
      ],
    }
    const effect = (
      algorithm: string,
      amount: number,
      asymmetry: boolean,
      bass = 0,
      treble = 0,
      toneControlPosition = 'POST',
    ): ChainEffectDraft => ({
      key: 'saturator-1',
      processorId: saturator.id,
      enabled: true,
      params: {
        algorithm: { value: algorithm, regions: [] },
        saturation: { value: amount, regions: [] },
        asymmetry: { value: String(asymmetry), regions: [] },
        bass: { value: bass, regions: [] },
        treble: { value: treble, regions: [] },
        toneControlPosition: { value: toneControlPosition, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: saturator,
        effect: effect('EXPONENTIAL', 2, true, 5, -3),
      },
    })
    const scope = wrapper.find('.transfer-scope')
    const exponentialPath = wrapper.find('.transfer-trace').attributes('d')
    const tonePath = wrapper.find('.eq-total-trace').attributes('d')

    expect(scope.attributes('data-algorithm')).toBe('EXPONENTIAL')
    expect(scope.text()).toContain('sat 2.00')
    expect(scope.text()).toContain('asymmetric')
    expect(wrapper.find('.transfer-reference').exists()).toBe(true)
    expect(wrapper.find('.eq-scope').attributes('data-band-count')).toBe('2')
    expect(wrapper.text()).toContain('Tone section in POST position')

    await wrapper.setProps({
      effect: effect('INVERSE_POWER', 3, false, -7, 8, 'PRE'),
    })
    expect(scope.attributes('data-algorithm')).toBe('INVERSE_POWER')
    expect(scope.text()).toContain('sat 3.00')
    expect(scope.text()).toContain('symmetric')
    expect(wrapper.find('.transfer-trace').attributes('d')).not.toBe(
      exponentialPath,
    )
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(tonePath)
    expect(wrapper.text()).toContain('Tone section in PRE position')
  })

  it('shows four reactive Linkwitz-Riley regions for the Multiband Saturator', async () => {
    const prefixes = ['low', 'lowMid', 'highMid', 'high']
    const saturator: Processor = {
      ...processor('multiband-saturator', ['MONO', 'STEREO']),
      type: 'SATURATE',
      subType: 'MULTIBAND',
      params: prefixes.flatMap((prefix) => [
        numericParam(`${prefix}Drive`, 1),
        numericParam(`${prefix}Mix`, 35, '%'),
        numericParam(`${prefix}Gain`, 0),
      ]),
    }
    const effect = (highMidGain: number): ChainEffectDraft => ({
      key: 'multiband-saturator-1',
      processorId: saturator.id,
      enabled: true,
      params: {
        algorithm: { value: 'COSINE', regions: [] },
        saturation: { value: 1.6, regions: [] },
        asymmetry: { value: 'false', regions: [] },
        inputGain: { value: 0, regions: [] },
        outputGain: { value: 0, regions: [] },
        dryWet: { value: 100, regions: [] },
        lowDrive: { value: 1.5, regions: [] },
        lowMix: { value: 35, regions: [] },
        lowGain: { value: -0.5, regions: [] },
        lowMidDrive: { value: 2, regions: [] },
        lowMidMix: { value: 45, regions: [] },
        lowMidGain: { value: 0, regions: [] },
        highMidDrive: { value: 1.5, regions: [] },
        highMidMix: { value: 35, regions: [] },
        highMidGain: { value: highMidGain, regions: [] },
        highDrive: { value: 1, regions: [] },
        highMix: { value: 25, regions: [] },
        highGain: { value: 0, regions: [] },
      },
    })
    const wrapper = mount(ProcessorVisualization, {
      props: {
        processor: saturator,
        effect: effect(0),
        sampleRate: 48_000,
      },
    })
    const initialPath = wrapper.find('.eq-total-trace').attributes('d')
    const scope = wrapper.find('.eq-scope')

    expect(wrapper.find('.transfer-scope').exists()).toBe(true)
    expect(scope.attributes('data-band-count')).toBe('4')
    expect(wrapper.findAll('.eq-band')).toHaveLength(4)
    expect(wrapper.text()).toContain('LOW MID')
    expect(wrapper.text()).toContain('HIGH MID')
    expect(wrapper.text()).toContain('D 1.5 dB')
    expect(wrapper.text()).toContain('M 35%')

    await wrapper.setProps({ effect: effect(6) })
    expect(wrapper.find('.eq-total-trace').attributes('d')).not.toBe(
      initialPath,
    )
    expect(wrapper.text()).toContain('G 6.0 dB')
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

    const dockResizer = wrapper.find('[aria-label="Resize chain details panel"]')
    expect(dockResizer.attributes('aria-valuenow')).toBe('280')
    await dockResizer.trigger('keydown', { key: 'ArrowUp' })
    expect(dockResizer.attributes('aria-valuenow')).toBe('304')
    await dockResizer.trigger('dblclick')
    expect(dockResizer.attributes('aria-valuenow')).toBe('280')

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
