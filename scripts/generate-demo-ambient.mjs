/**
 * Gera loop ambiente suave para fundo da narração do demo.
 * Saída: ambient-bg.mp3 (codificado com lamejs — compatível com todos os browsers)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const lamejs = require('lamejs')

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/demo-narration')
const OUT_FILE = join(OUT_DIR, 'ambient-bg.mp3')

const SAMPLE_RATE = 44100
const DURATION_SEC = 24

function synthSample(t) {
  const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * t / DURATION_SEC)
  const a2 = Math.sin(2 * Math.PI * 110 * t)
  const e3 = Math.sin(2 * Math.PI * 164.81 * t) * 0.55
  const a3 = Math.sin(2 * Math.PI * 220 * t) * 0.35
  const breath = Math.sin(2 * Math.PI * 0.7 * t) * 0.08
  return ((a2 + e3 + a3) / 3 + breath) * swell * 0.82
}

mkdirSync(OUT_DIR, { recursive: true })

const total = SAMPLE_RATE * DURATION_SEC
const pcm = new Int16Array(total)
for (let i = 0; i < total; i++) {
  const s = synthSample(i / SAMPLE_RATE)
  pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)))
}

// Codifica para MP3 com lamejs (128kbps mono)
const mp3enc = new lamejs.Mp3Encoder(1, SAMPLE_RATE, 128)
const chunks = []
const BLOCK = 1152  // tamanho de frame MP3

for (let i = 0; i < total; i += BLOCK) {
  const slice = pcm.subarray(i, i + BLOCK)
  const mp3buf = mp3enc.encodeBuffer(slice)
  if (mp3buf.length > 0) chunks.push(Buffer.from(mp3buf))
}
const flush = mp3enc.flush()
if (flush.length > 0) chunks.push(Buffer.from(flush))

const mp3 = Buffer.concat(chunks)
writeFileSync(OUT_FILE, mp3)
console.log(`Ambiente gerado: public/demo-narration/ambient-bg.mp3 (${DURATION_SEC}s, ${(mp3.length/1024).toFixed(0)}KB)`)
