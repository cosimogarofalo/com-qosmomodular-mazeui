export const AUDIO_METER_FLOOR_DB = -60

export interface AudioMeterLevels {
  rmsDb: number
  peakDb: number
}

function amplitudeToDb(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) {
    return AUDIO_METER_FLOOR_DB
  }
  return Math.max(
    AUDIO_METER_FLOOR_DB,
    Math.min(0, 20 * Math.log10(amplitude)),
  )
}

export function calculateAudioMeterLevels(
  samples: Float32Array<ArrayBuffer>,
): AudioMeterLevels {
  if (samples.length === 0) {
    return {
      rmsDb: AUDIO_METER_FLOOR_DB,
      peakDb: AUDIO_METER_FLOOR_DB,
    }
  }

  let sumSquares = 0
  let peak = 0
  for (const sample of samples) {
    const finiteSample = Number.isFinite(sample) ? sample : 0
    sumSquares += finiteSample * finiteSample
    peak = Math.max(peak, Math.abs(finiteSample))
  }

  return {
    rmsDb: amplitudeToDb(Math.sqrt(sumSquares / samples.length)),
    peakDb: amplitudeToDb(peak),
  }
}
