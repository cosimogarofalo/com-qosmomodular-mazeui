import { afterEach, describe, expect, it, vi } from 'vitest'

import { MazeApiError, mazeApi } from '@/services/mazeApi'
import type { BoundChainRequest, ChainValidationResponse } from '@/types/maze'

const boundRequest: BoundChainRequest = {
  chainYaml: 'chains: []\n',
  inputBindings: [{ chainIndex: 0, inputIndex: 0, inputId: 'opaque-input' }],
  outputBindings: [
    { chainIndex: 0, outputIndex: 0, fileName: 'render', format: 'WAV' },
  ],
  overwriteExisting: true,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Maze REST client', () => {
  it('submits the complete bound validation request', async () => {
    const validation: ChainValidationResponse = {
      valid: true,
      errors: [],
      warnings: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validation))
    vi.stubGlobal('fetch', fetchMock)

    await expect(mazeApi.validateChain(boundRequest)).resolves.toEqual(validation)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/chains/validate')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(boundRequest)
  })

  it('keeps structured validation errors returned with HTTP 409', async () => {
    const validation: ChainValidationResponse = {
      valid: false,
      errors: [
        {
          code: 'OUTPUT_COLLISION',
          message: 'Output file already exists',
          path: '$.outputBindings[0].fileName',
        },
      ],
      warnings: [],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(validation, 409)))

    try {
      await mazeApi.renderChain(boundRequest)
      throw new Error('Expected renderChain to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(MazeApiError)
      expect(error).toMatchObject({
        status: 409,
        code: 'OUTPUT_COLLISION',
        message: 'Output file already exists',
        validation,
      })
    }
  })

  it('parses stable REST error codes instead of exposing raw JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: 'AUDIO_INPUT_COLLISION',
            message: 'Managed audio input already exists',
          },
          409,
        ),
      ),
    )

    await expect(mazeApi.audioInputs()).rejects.toMatchObject({
      status: 409,
      code: 'AUDIO_INPUT_COLLISION',
      message: 'Managed audio input already exists',
    })
  })
})
