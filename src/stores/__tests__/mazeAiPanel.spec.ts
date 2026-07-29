// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import MazeAiPanel from '@/components/MazeAiPanel.vue'
import { useChainStore } from '@/stores/chain'
import { useMazeAiStore } from '@/stores/mazeAi'
import { useMazeStore } from '@/stores/maze'
import {
  mazeAiCapabilities,
  mazeAiHealth,
  mazeAiInput,
  mazeAiProcessors,
  mazeAiResult,
  toneProcessor,
} from './mazeAiTestFixture'

describe('MazeAI proposal panel', () => {
  it('does not change the draft before acceptance and then replaces it atomically', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const maze = useMazeStore()
    const chain = useChainStore()
    const mazeAi = useMazeAiStore()

    maze.$patch({
      status: 'connected',
      health: { status: 'ok', service: 'maze', version: '0.8.0' },
      processors: mazeAiProcessors,
      audioInputs: [mazeAiInput],
    })
    chain.bindInput(mazeAiInput, mazeAiProcessors)
    chain.setOutputBaseName('browser-owned-output')
    chain.setOutputFormat('AIFF')
    chain.toggleOverwriteExisting()
    chain.addProcessor(toneProcessor)
    mazeAi.$patch({
      status: 'ready',
      health: mazeAiHealth,
      capabilities: mazeAiCapabilities,
      result: mazeAiResult,
    })

    const wrapper = mount(MazeAiPanel, { global: { plugins: [pinia] } })

    expect(chain.draft.effects.map((effect) => effect.processorId)).toEqual([
      toneProcessor.id,
    ])
    expect(wrapper.text()).toContain('Anteprima in sola lettura')
    expect(wrapper.text()).toContain('false-start')
    expect(wrapper.text()).toContain('ASR locale pronto')
    expect(wrapper.text()).toContain('[0, 691200)')
    expect(wrapper.text()).toContain('14.40 s')
    expect(wrapper.find('.mazeai-proposal-region.is-destructive').exists()).toBe(true)

    await wrapper.get('.mazeai-accept-button').trigger('click')

    expect(chain.draft.effects.map((effect) => effect.processorId)).toEqual([
      'PR-VOI-BA-VE-01',
      'PR-FLT-2K-TO-01',
    ])
    expect(chain.draft.outputBaseName).toBe('browser-owned-output')
    expect(chain.draft.outputFormat).toBe('AIFF')
    expect(chain.draft.overwriteExisting).toBe(false)
    expect(mazeAi.proposalAccepted).toBe(true)
    expect(wrapper.text()).toContain('Usa “Validate” per inviarla a Maze')
  })
})
