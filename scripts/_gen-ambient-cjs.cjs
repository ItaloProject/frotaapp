const lamejs = require('lamejs')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'demo-narration')
const OUT_FILE = path.join(OUT_DIR, 'ambient-bg.mp3')
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

const total = SAMPLE_RATE * DURATION_SEC
const pcm = new Int16Array(total)
for (let i = 0; i < total; i++) {
  const s = synthSample(i / SAMPLE_RATE)
  pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)))
}

const mp3enc = new lamejs.Mp3Encoder(1, SAMPLE_RATE, 128)
const chunks = []
const BLOCK = 1152

for (let i = 0; i < total; i += BLOCK) {
  const slice = pcm.subarray(i, i + BLOCK)
  const buf = mp3enc.encodeBuffer(slice)
  if (buf.length > 0) chunks.push(Buffer.from(buf))
}
const tail = mp3enc.flush()
if (tail.length > 0) chunks.push(Buffer.from(tail))

const mp3 = Buffer.concat(chunks)
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_FILE, mp3)
console.log('Gerado:', OUT_FILE, '—', (mp3.length / 1024).toFixed(0), 'KB')
