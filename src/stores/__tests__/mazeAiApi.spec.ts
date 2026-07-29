import { afterEach, describe, expect, it, vi } from 'vitest'

import { MazeAiApiError, mazeAiApi } from '@/services/mazeAiApi'
import { mazeAiCapabilities, mazeAiHealth } from './mazeAiTestFixture'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('MazeAI REST client', () => {
  it('uses the distinct MazeAI prefix and exact chain-job request contract', async () => {
    const accepted = {
      chainJobId: 'chain-job-1',
      state: 'QUEUED',
      createdAt: '2026-07-29T10:00:00Z',
      statusUrl: '/api/chain-jobs/chain-job-1',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mazeAiHealth))
      .mockResolvedValueOnce(jsonResponse(mazeAiCapabilities))
      .mockResolvedValueOnce(jsonResponse(accepted))
    vi.stubGlobal('fetch', fetchMock)

    await expect(mazeAiApi.health()).resolves.toEqual(mazeAiHealth)
    await expect(mazeAiApi.capabilities()).resolves.toEqual(mazeAiCapabilities)
    await expect(
      mazeAiApi.createChainJob({
        inputId: 'managed-input',
        goal: 'clean up the voice',
        contentHint: 'AUTO',
        semanticEdit: 'KEEP',
        transcript: null,
      }),
    ).resolves.toEqual(accepted)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/mazeai-api/health')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/mazeai-api/capabilities')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/mazeai-api/chain-jobs')
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      inputId: 'managed-input',
      goal: 'clean up the voice',
      contentHint: 'AUTO',
      semanticEdit: 'KEEP',
      transcript: null,
    })
  })

  it('retains the stable MazeAI error code and field path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          {
            code: 'INVALID_GOAL',
            message: 'Goal must not be blank',
            fieldPath: '$.goal',
          },
          400,
        ),
      ),
    ))

    try {
      await mazeAiApi.createChainJob({
        inputId: 'managed-input',
        goal: '',
        contentHint: 'AUTO',
        semanticEdit: 'KEEP',
        transcript: null,
      })
      throw new Error('Expected MazeAI request to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(MazeAiApiError)
      expect(error).toMatchObject({
        status: 400,
        code: 'INVALID_GOAL',
        message: 'Goal must not be blank',
        fieldPath: '$.goal',
      })
    }
  })
})
