/**
 * Gera trilha ambiente corporativa: piano suave + pad de cordas
 * Saída: ambient-bg.wav (48000Hz stereo, 24s, loop suave)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/demo-narration')
const OUT_FILE = join(OUT_DIR, 'ambient-bg.wav')

const SAMPLE_RATE = 48000
const DURATION_SEC = 32   // loop de 32s para ser mais natural
const NUM_CHANNELS = 2
const BIT_DEPTH = 16
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC

mkdirSync(OUT_DIR, { recursive: true })

// --- Síntese ---

// Piano sintético: envelope ADSR + harmônicos
function pianoNote(freq, t, startT, durationT, volume = 1.0) {
  const localT = t - startT
  if (localT < 0 || localT > durationT + 2.0) return 0

  // ADSR envelope
  const attack = 0.008
  const decay = 0.15
  const sustain = 0.35
  const release = 1.2

  let env = 0
  if (localT < attack) {
    env = localT / attack
  } else if (localT < attack + decay) {
    env = 1 - (1 - sustain) * (localT - attack) / decay
  } else if (localT < durationT) {
    env = sustain
  } else {
    const rel = localT - durationT
    env = sustain * Math.max(0, 1 - rel / release)
  }

  if (env <= 0) return 0

  // Harmônicos do piano
  const f = freq
  const wave =
    Math.sin(2 * Math.PI * f * localT) * 1.0 +
    Math.sin(2 * Math.PI * f * 2 * localT) * 0.45 +
    Math.sin(2 * Math.PI * f * 3 * localT) * 0.18 +
    Math.sin(2 * Math.PI * f * 4 * localT) * 0.08 +
    Math.sin(2 * Math.PI * f * 5 * localT) * 0.04

  return (wave / 1.75) * env * volume
}

// Pad de cordas suave: osciladores com slight detune + filtro simulado via blend
function stringPad(freq, t, volume = 1.0) {
  const detune1 = 1.003
  const detune2 = 0.997
  const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5.2 * t)
  const wave =
    Math.sin(2 * Math.PI * freq * detune1 * vibrato * t) * 0.5 +
    Math.sin(2 * Math.PI * freq * detune2 * vibrato * t) * 0.5 +
    Math.sin(2 * Math.PI * freq * 2 * t) * 0.18 +
    Math.sin(2 * Math.PI * freq * 3 * t) * 0.06
  return (wave / 1.74) * volume
}

// Notas do piano — progressão Am → F → C → G (típica corporativa)
// Frequências: A3=220, C4=261.63, E4=329.63, F3=174.61, F4=349.23, G3=196, G4=392, B3=246.94
const C4 = 261.63, E4 = 329.63, G4 = 392.00
const A3 = 220.00, C5 = 523.25, E5 = 659.25
const F3 = 174.61, A4 = 440.00, C4f = 261.63
const G3 = 196.00, B3 = 246.94, D4 = 293.66

// [freq, startTime, duration, volume]
const pianoNotes = [
  // Compasso 1: Am (A-C-E)
  [A3, 0.0, 2.5, 0.52],
  [C4, 0.0, 2.5, 0.48],
  [E4, 0.0, 2.5, 0.44],
  [A3, 0.5, 1.0, 0.30],  // arpegio sutil
  [C4, 1.0, 1.0, 0.28],
  [E4, 1.5, 1.0, 0.26],

  // Compasso 2: F (F-A-C)
  [F3, 4.0, 2.5, 0.50],
  [A3, 4.0, 2.5, 0.46],
  [C4, 4.0, 2.5, 0.42],
  [F3, 4.5, 1.0, 0.28],
  [A3, 5.0, 1.0, 0.26],
  [C4, 5.5, 1.0, 0.24],

  // Compasso 3: C (C-E-G)
  [C4, 8.0, 2.5, 0.52],
  [E4, 8.0, 2.5, 0.46],
  [G4, 8.0, 2.5, 0.42],
  [C4, 8.5, 1.0, 0.28],
  [E4, 9.0, 1.0, 0.26],
  [G4, 9.5, 1.0, 0.24],

  // Compasso 4: G (G-B-D)
  [G3, 12.0, 2.5, 0.50],
  [B3, 12.0, 2.5, 0.46],
  [D4, 12.0, 2.5, 0.42],
  [G3, 12.5, 1.0, 0.28],
  [B3, 13.0, 1.0, 0.26],
  [D4, 13.5, 1.0, 0.24],

  // Repetição com variação (compasso 5-8)
  [A3, 16.0, 2.5, 0.48],
  [C4, 16.0, 2.5, 0.44],
  [E4, 16.0, 2.5, 0.40],
  [E4, 16.5, 1.0, 0.26],
  [C4, 17.0, 1.0, 0.24],
  [A3, 17.5, 1.0, 0.22],

  [F3, 20.0, 2.5, 0.46],
  [A3, 20.0, 2.5, 0.42],
  [C4, 20.0, 2.5, 0.38],

  [C4, 24.0, 3.5, 0.44],
  [E4, 24.0, 3.5, 0.40],
  [G4, 24.0, 3.5, 0.36],

  [G3, 28.0, 3.8, 0.48],
  [B3, 28.0, 3.8, 0.44],
  [D4, 28.0, 3.8, 0.40],
]

// Pad de cordas — acorde sustentado com swell
// Usa as mesmas notas mas em pad suave
const padNotes = [
  // Am
  { freq: A3, startT: 0, endT: 8, vol: 0.18 },
  { freq: C4, startT: 0, endT: 8, vol: 0.16 },
  { freq: E4, startT: 0, endT: 8, vol: 0.14 },
  // F
  { freq: F3, startT: 4, endT: 12, vol: 0.17 },
  { freq: A3, startT: 4, endT: 12, vol: 0.15 },
  { freq: C4, startT: 4, endT: 12, vol: 0.13 },
  // C
  { freq: C4, startT: 8, endT: 16, vol: 0.18 },
  { freq: E4, startT: 8, endT: 16, vol: 0.16 },
  { freq: G4, startT: 8, endT: 16, vol: 0.14 },
  // G
  { freq: G3, startT: 12, endT: 20, vol: 0.17 },
  { freq: B3, startT: 12, endT: 20, vol: 0.15 },
  { freq: D4, startT: 12, endT: 20, vol: 0.13 },
  // repetição
  { freq: A3, startT: 16, endT: 24, vol: 0.16 },
  { freq: C4, startT: 16, endT: 24, vol: 0.14 },
  { freq: E4, startT: 16, endT: 24, vol: 0.12 },
  { freq: F3, startT: 20, endT: 28, vol: 0.16 },
  { freq: A3, startT: 20, endT: 28, vol: 0.14 },
  { freq: C4, startT: 24, endT: 32, vol: 0.17 },
  { freq: G3, startT: 28, endT: 32, vol: 0.16 },
  { freq: B3, startT: 28, endT: 32, vol: 0.14 },
]

// Gera amostras
const left = new Float32Array(TOTAL_SAMPLES)
const right = new Float32Array(TOTAL_SAMPLES)

console.log('Sintetizando trilha corporativa...')
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const t = i / SAMPLE_RATE

  // Envelope geral: fade-in 1s, fade-out 2s para loop limpo
  let masterEnv = 1.0
  if (t < 1.0) masterEnv = t / 1.0
  else if (t > DURATION_SEC - 2.0) masterEnv = (DURATION_SEC - t) / 2.0

  // Piano
  let pianoL = 0, pianoR = 0
  for (const [freq, startT, dur, vol] of pianoNotes) {
    const p = pianoNote(freq, t, startT, dur, vol)
    // Leve pan estéreo baseado na frequência
    const pan = freq < 300 ? -0.15 : freq < 400 ? 0.1 : 0.2
    pianoL += p * (1 - Math.max(0, pan))
    pianoR += p * (1 + Math.min(0, pan) + Math.max(0, pan))
  }

  // Pad de cordas
  let padL = 0, padR = 0
  for (const { freq, startT, endT, vol } of padNotes) {
    const localT = t - startT
    if (localT < 0 || t > endT + 1.0) continue
    // Envelope do pad
    const padDur = endT - startT
    let padEnv = 1.0
    if (localT < 0.8) padEnv = localT / 0.8
    else if (t > endT - 0.8) padEnv = Math.max(0, (endT - t) / 0.8)
    const p = stringPad(freq, t, vol) * padEnv
    const pan = freq < 300 ? -0.2 : 0.2
    padL += p * (1 - Math.max(0, pan))
    padR += p * (1 + Math.min(0, pan) + Math.max(0, pan))
  }

  // Mix final
  const mixL = (pianoL * 0.72 + padL * 0.28) * masterEnv
  const mixR = (pianoR * 0.72 + padR * 0.28) * masterEnv

  left[i] = Math.max(-1, Math.min(1, mixL))
  right[i] = Math.max(-1, Math.min(1, mixR))
}

// Normaliza pelo pico
let peak = 0
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const a = Math.max(Math.abs(left[i]), Math.abs(right[i]))
  if (a > peak) peak = a
}
const norm = peak > 0.001 ? 0.88 / peak : 1
console.log(`Pico antes da normalização: ${(peak * 100).toFixed(1)}% → normalizando para 88%`)

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  left[i] *= norm
  right[i] *= norm
}

// Escreve WAV stereo 16-bit
const dataSize = TOTAL_SAMPLES * NUM_CHANNELS * (BIT_DEPTH / 8)
const headerSize = 44
const buf = Buffer.alloc(headerSize + dataSize)

buf.write('RIFF', 0)
buf.writeUInt32LE(36 + dataSize, 4)
buf.write('WAVE', 8)
buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)           // PCM
buf.writeUInt16LE(NUM_CHANNELS, 22)
buf.writeUInt32LE(SAMPLE_RATE, 24)
buf.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28)
buf.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32)
buf.writeUInt16LE(BIT_DEPTH, 34)
buf.write('data', 36)
buf.writeUInt32LE(dataSize, 40)

let offset = 44
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const l = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)))
  const r = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)))
  buf.writeInt16LE(l, offset); offset += 2
  buf.writeInt16LE(r, offset); offset += 2
}

writeFileSync(OUT_FILE, buf)
console.log(`Gerado: ${OUT_FILE}`)
console.log(`Duração: ${DURATION_SEC}s | ${(buf.length / 1024 / 1024).toFixed(1)}MB | ${SAMPLE_RATE}Hz stereo`)
