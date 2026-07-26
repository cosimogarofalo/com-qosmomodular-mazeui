export const PROCESSOR_VISUAL_TYPES = [
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

export type ProcessorVisualType = (typeof PROCESSOR_VISUAL_TYPES)[number]
export type ProcessorTone = 'blue' | 'cyan' | 'violet' | 'green' | 'amber'

const visualTypes = new Set<string>(PROCESSOR_VISUAL_TYPES)

const tones: Record<ProcessorVisualType, ProcessorTone> = {
  ATTENUATE: 'cyan',
  BOOST: 'cyan',
  CHORUS: 'blue',
  COMPRESS: 'cyan',
  DELAY: 'amber',
  EQUALIZE: 'violet',
  FLANGE: 'blue',
  GRANULATE: 'violet',
  LIMIT: 'amber',
  NOISE_GATE: 'cyan',
  PITCH_SHIFT: 'green',
  REVERB: 'cyan',
  SATURATE: 'amber',
  STEREO_IMAGE: 'green',
  TIME_STRETCH: 'blue',
  TONE: 'violet',
  TRANSIENT_DESIGN: 'violet',
  VIBRATO: 'blue',
  VOICE_ENHANCE: 'violet',
  WAH_WAH: 'amber',
}

export function processorVisualType(type: string): ProcessorVisualType | 'GENERIC' {
  const normalized = type.trim().toUpperCase()
  return visualTypes.has(normalized)
    ? (normalized as ProcessorVisualType)
    : 'GENERIC'
}

export function processorTone(type: string): ProcessorTone {
  const visual = processorVisualType(type)
  return visual === 'GENERIC' ? 'blue' : tones[visual]
}
