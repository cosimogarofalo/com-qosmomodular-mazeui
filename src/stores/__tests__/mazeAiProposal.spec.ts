import { describe, expect, it } from 'vitest'

import {
  proposalCompatibilityIssues,
  proposalToChainDraft,
} from '@/services/mazeAiProposal'
import type { ChainDraft } from '@/types/maze'
import {
  mazeAiInput,
  mazeAiProcessors,
  mazeAiResult,
} from './mazeAiTestFixture'

describe('MazeAI proposal adapter', () => {
  it('accepts the frozen contract fixture against the matching Maze catalog and source', () => {
    expect(
      proposalCompatibilityIssues(
        mazeAiResult,
        mazeAiProcessors,
        mazeAiInput,
        mazeAiResult.processorCatalogFingerprint,
        mazeAiResult.mazeAiVersion,
      ),
    ).toEqual([])
  })

  it('replaces the chain shape while preserving browser-owned output controls', () => {
    const currentDraft: ChainDraft = {
      name: 'Current chain',
      inputId: mazeAiInput.id,
      outputBaseName: 'my-final-mix',
      outputFormat: 'AIFF',
      overwriteExisting: false,
      effects: [],
    }

    const draft = proposalToChainDraft(mazeAiResult, currentDraft, mazeAiProcessors)

    expect(draft.name).toBe('MazeAI podcast cleanup')
    expect(draft.inputId).toBe(mazeAiInput.id)
    expect(draft.outputBaseName).toBe('my-final-mix')
    expect(draft.outputFormat).toBe('AIFF')
    expect(draft.overwriteExisting).toBe(false)
    expect(draft.effects.map((effect) => effect.processorId)).toEqual([
      'PR-VOI-BA-VE-01',
      'PR-FLT-2K-TO-01',
    ])
    expect(draft.effects[1]?.params.bass?.value).toBe('1.50')
    expect(draft.effects[0]?.params.falseStartAction?.regions).toEqual([
      {
        startFrame: 0,
        endFrame: 691_200,
        value: 'REMOVE',
        confidence: 0.96,
      },
    ])
    expect(draft.effects[0]?.params.analysisSourceSha256?.source).toEqual({
      inputId: mazeAiInput.id,
      sha256: mazeAiInput.sha256,
    })
    expect(draft.effects[0]?.params.voiceGainDb?.value).toBe(0)
  })

  it('blocks stale source, catalog and processor references before acceptance', () => {
    const issues = proposalCompatibilityIssues(
      mazeAiResult,
      mazeAiProcessors.slice(1),
      { ...mazeAiInput, sha256: 'f'.repeat(64) },
      'different-catalog',
      '0.9.0',
    )

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Proposal version'),
        expect.stringContaining('processor catalog changed'),
        expect.stringContaining('managed input no longer matches'),
        expect.stringContaining('PR-VOI-BA-VE-01'),
      ]),
    )
  })
})
