import { DEMO_NARRATION_STEPS, type DemoNarrationStepId } from './demoNarration'

/** Loop ambiente — mixado via Web Audio junto com a narração */
export const DEMO_AMBIENT_SRC = '/demo-narration/ambient-bg.wav'
const AMBIENT_VOLUME_IDLE = 0.72   // volume quando narrador está em silêncio
const AMBIENT_VOLUME_VOICE = 0.18  // volume durante a narração (ducking)
const AMBIENT_VOLUME = AMBIENT_VOLUME_IDLE
const VOICE_VOLUME = 1
const AMBIENT_FADE_IN_SEC = 0.5
const AMBIENT_FADE_OUT_SEC = 0.8
const AMBIENT_DUCK_SEC = 0.4       // tempo de fade para ducking

export type DemoAudioDiagnostic = {
  ok: boolean
  contextState: string | null
  ambientFetchOk: boolean
  ambientFetchStatus: number | null
  ambientDecoded: boolean
  ambientPlaying: boolean
  outputDevice: string
  hints: string[]
}

type NarratorConfig = {
  enabled: boolean
  speedFactor: number
}

let config: NarratorConfig = { enabled: false, speedFactor: 1 }
let unlocked = false
const narrationBufferCache = new Map<string, AudioBuffer>()
const audioFileCache = new Map<string, boolean>()

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let voiceGain: GainNode | null = null
let ambientGain: GainNode | null = null
let ambientBuffer: AudioBuffer | null = null
let ambientSource: AudioBufferSourceNode | null = null
let voiceSource: AudioBufferSourceNode | null = null
let ambientActive = false
let stopGeneration = 0  // incrementado a cada stop; startAmbientBed verifica antes de prosseguir

export function configureDemoNarrator(partial: Partial<NarratorConfig>) {
  config = { ...config, ...partial }
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null

  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume()
    } catch {
      return null
    }
  }
  return audioCtx
}

async function ensureAudioGraph(): Promise<AudioContext | null> {
  const ctx = await ensureAudioContext()
  if (!ctx) return null

  // Reconstrói o grafo se o contexto mudou (ex: contexto fechado e recriado)
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain()
    masterGain.gain.value = 1
    masterGain.connect(ctx.destination)

    voiceGain = ctx.createGain()
    voiceGain.gain.value = VOICE_VOLUME
    voiceGain.connect(masterGain)

    ambientGain = ctx.createGain()
    ambientGain.gain.value = 0
    ambientGain.connect(masterGain)

    // Reseta estado derivado do grafo antigo
    ambientSource = null
    ambientActive = false
    voiceSource = null
  }

  return ctx
}

async function fetchAmbientBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (ambientBuffer) return ambientBuffer
  try {
    const res = await fetch(DEMO_AMBIENT_SRC)
    if (!res.ok) return null
    const data = await res.arrayBuffer()
    ambientBuffer = await ctx.decodeAudioData(data)
    return ambientBuffer
  } catch {
    return null
  }
}

function teardownAmbientSource() {
  try {
    ambientSource?.stop()
  } catch {
    /* já parado */
  }
  ambientSource?.disconnect()
  ambientSource = null
  ambientActive = false
  if (ambientGain && audioCtx) {
    ambientGain.gain.cancelScheduledValues(audioCtx.currentTime)
    ambientGain.gain.value = 0
  }
}

function stopVoiceSource() {
  try {
    voiceSource?.stop()
  } catch {
    /* já parado */
  }
  voiceSource?.disconnect()
  voiceSource = null
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

/** Desbloqueia áudio no clique e já inicia o bed ambiente */
export async function unlockDemoNarrator() {
  unlocked = true
  void ensureVoices()
  if (!config.enabled) return
  await startAmbientBed()
}

export function isDemoNarratorUnlocked() {
  return unlocked
}

async function startAmbientBed() {
  if (!config.enabled || !unlocked) return
  if (ambientActive) return

  const genAtStart = stopGeneration

  const ctx = await ensureAudioGraph()
  if (!ctx || !ambientGain) return
  if (stopGeneration !== genAtStart) return

  const buffer = await fetchAmbientBuffer(ctx)
  if (!buffer) return
  if (stopGeneration !== genAtStart) return

  teardownAmbientSource()

  ambientSource = ctx.createBufferSource()
  ambientSource.buffer = buffer
  ambientSource.loop = true
  ambientSource.connect(ambientGain)

  const now = ctx.currentTime
  ambientGain.gain.cancelScheduledValues(now)
  ambientGain.gain.setValueAtTime(0, now)
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_VOLUME, now + AMBIENT_FADE_IN_SEC)

  ambientSource.start(0)
  ambientActive = true
}

function stopAmbientBed() {
  const gen = ++stopGeneration

  if (!ambientActive || !ambientGain || !audioCtx) {
    teardownAmbientSource()
    return
  }

  const ctx = audioCtx
  const now = ctx.currentTime
  ambientGain.gain.cancelScheduledValues(now)
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now)
  ambientGain.gain.linearRampToValueAtTime(0, now + AMBIENT_FADE_OUT_SEC)

  window.setTimeout(() => {
    if (gen === stopGeneration && ambientActive) teardownAmbientSource()
  }, AMBIENT_FADE_OUT_SEC * 1000 + 50)
}

export function stopDemoNarration() {
  stopVoiceSource()
  stopAmbientBed()
}

function audioPlaybackRate(speedFactor: number): number {
  return Math.min(1.08, Math.max(0.92, speedFactor))
}

function speechRate(speedFactor: number): number {
  return Math.min(1.05, Math.max(0.88, 0.94 * speedFactor))
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  let score = 0
  if (voice.lang === 'pt-BR') score += 100
  else if (voice.lang.startsWith('pt')) score += 60
  if (name.includes('natural')) score += 50
  if (name.includes('neural')) score += 50
  if (name.includes('online')) score += 45
  return score
}

function pickPtVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const ranked = [...voices].sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))
  return ranked.find((v) => voiceQualityScore(v) > 0) ?? ranked[0] ?? null
}

function ensureVoices(): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve()
  if (speechSynthesis.getVoices().length > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve()
    }
    speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 800)
  })
}

async function audioFileExists(src: string): Promise<boolean> {
  if (audioFileCache.has(src)) return audioFileCache.get(src)!
  try {
    const res = await fetch(src, { method: 'HEAD' })
    const ok = res.ok
    audioFileCache.set(src, ok)
    return ok
  } catch {
    audioFileCache.set(src, false)
    return false
  }
}

async function loadNarrationBuffer(ctx: AudioContext, src: string): Promise<AudioBuffer> {
  const cached = narrationBufferCache.get(src)
  if (cached) return cached
  const res = await fetch(src)
  if (!res.ok) throw new Error(`fetch failed: ${src}`)
  const data = await res.arrayBuffer()
  const buffer = await ctx.decodeAudioData(data)
  narrationBufferCache.set(src, buffer)
  return buffer
}

async function playAudioViaWebAudio(src: string, rate: number): Promise<void> {
  const ctx = await ensureAudioGraph()
  if (!ctx || !voiceGain) throw new Error('no audio context')

  const buffer = await loadNarrationBuffer(ctx, src)
  stopVoiceSource()

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate
  source.connect(voiceGain)
  voiceSource = source

  return new Promise((resolve, reject) => {
    source.onended = () => {
      voiceSource = null
      resolve()
    }
    try {
      source.start(0)
    } catch (err) {
      voiceSource = null
      reject(err)
    }
  })
}

function speakText(text: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve()
      return
    }
    stopVoiceSource()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = rate
    utterance.pitch = 1
    utterance.volume = 1
    const voice = pickPtVoice()
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    setTimeout(() => speechSynthesis.speak(utterance), 40)
  })
}

function duckAmbient() {
  if (!ambientGain || !audioCtx) return
  const now = audioCtx.currentTime
  ambientGain.gain.cancelScheduledValues(now)
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now)
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_VOLUME_VOICE, now + AMBIENT_DUCK_SEC)
}

function unduckAmbient() {
  if (!ambientGain || !audioCtx || !ambientActive) return
  const now = audioCtx.currentTime
  ambientGain.gain.cancelScheduledValues(now)
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now)
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_VOLUME_IDLE, now + AMBIENT_DUCK_SEC)
}

async function playNarrationVoice(stepId: DemoNarrationStepId): Promise<void> {
  const step = DEMO_NARRATION_STEPS[stepId]
  if (!step) return

  duckAmbient()
  try {
    if (step.audio && (await audioFileExists(step.audio))) {
      try {
        await playAudioViaWebAudio(step.audio, audioPlaybackRate(config.speedFactor))
        return
      } catch {
        /* fallback TTS */
      }
    }

    if (step.text) {
      await ensureVoices()
      await speakText(step.text, speechRate(config.speedFactor))
    }
  } finally {
    unduckAmbient()
  }
}

export async function narrateDemoStep(stepId: DemoNarrationStepId): Promise<void> {
  if (!config.enabled || !unlocked) return
  await startAmbientBed()
  await playNarrationVoice(stepId)
}

export async function finishDemoNarration() {
  stopAmbientBed()
}

/** Diagnóstico — chame no console: await testarAudioDemo() */
export async function runDemoAudioDiagnostics(): Promise<DemoAudioDiagnostic> {
  const hints: string[] = []
  let fetchStatus: number | null = null
  let fetchOk = false

  try {
    const res = await fetch(DEMO_AMBIENT_SRC)
    fetchStatus = res.status
    fetchOk = res.ok
    if (!res.ok) hints.push(`Arquivo ambient-bg.wav retornou HTTP ${res.status}. Rode: npm run gen:ambient`)
  } catch {
    hints.push('Não foi possível baixar /demo-narration/ambient-bg.wav — verifique se npm run dev está ativo.')
  }

  unlocked = true
  const prevEnabled = config.enabled
  config.enabled = true

  const ctx = await ensureAudioGraph()
  const contextState = ctx?.state ?? null

  if (!ctx) {
    hints.push('Web Audio não disponível neste navegador.')
  } else if (ctx.state !== 'running') {
    hints.push(`AudioContext está "${ctx.state}". Clique em "Iniciar com narração" antes do teste (gesto do usuário).`)
  }

  const decoded = ctx ? (await fetchAmbientBuffer(ctx)) !== null : false
  if (fetchOk && !decoded) {
    hints.push('WAV baixou mas não decodificou — arquivo corrompido? Regere com npm run gen:ambient')
  }

  await startAmbientBed()

  if (ambientActive) {
    hints.push('Bed ambiente INICIADO por 4 segundos — se não ouvir nada, o problema é saída de áudio do Windows/navegador.')
  } else if (fetchOk && decoded) {
    hints.push('Buffer OK mas bed não iniciou — recarregue a página e clique em Iniciar.')
  }

  await new Promise((r) => setTimeout(r, 4000))
  stopAmbientBed()

  config.enabled = prevEnabled

  let outputDevice = 'desconhecido'
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sink = await (ctx as any)?.setSinkId?.('')
    void sink
    outputDevice = 'padrão do sistema'
  } catch {
    outputDevice = 'padrão do sistema (setSinkId indisponível)'
  }

  if (hints.length === 0) hints.push('Tudo OK no navegador — se não ouviu o bed nos 4s, verifique o Windows (passos abaixo).')

  return {
    ok: fetchOk && decoded && ambientActive && contextState === 'running',
    contextState,
    ambientFetchOk: fetchOk,
    ambientFetchStatus: fetchStatus,
    ambientDecoded: decoded,
    ambientPlaying: ambientActive,
    outputDevice,
    hints,
  }
}

declare global {
  interface Window {
    testarAudioDemo?: () => Promise<DemoAudioDiagnostic>
    inspecionarAudio?: () => void
  }
}

if (typeof window !== 'undefined') {
  window.testarAudioDemo = runDemoAudioDiagnostics
  window.inspecionarAudio = () => {
    console.log('=== ESTADO INTERNO DO NARRATOR ===')
    console.log('config:', config)
    console.log('unlocked:', unlocked)
    console.log('ambientActive:', ambientActive)
    console.log('stopGeneration:', stopGeneration)
    console.log('audioCtx state:', audioCtx?.state ?? 'null')
    console.log('audioCtx sampleRate:', audioCtx?.sampleRate ?? 'null')
    console.log('masterGain.gain:', masterGain?.gain.value ?? 'null')
    console.log('masterGain.context === audioCtx:', masterGain?.context === audioCtx)
    console.log('ambientGain.gain:', ambientGain?.gain.value ?? 'null')
    console.log('ambientGain.context === audioCtx:', ambientGain?.context === audioCtx)
    console.log('voiceGain.gain:', voiceGain?.gain.value ?? 'null')
    console.log('ambientSource:', ambientSource ? 'existe' : 'null')
    console.log('ambientBuffer:', ambientBuffer ? `${ambientBuffer.duration.toFixed(1)}s` : 'null')

    if (audioCtx && ambientGain && ambientBuffer) {
      console.log('\n→ Forçando playback direto (bypassa todo o código)...')
      const src = audioCtx.createBufferSource()
      src.buffer = ambientBuffer
      src.loop = true
      const g = audioCtx.createGain()
      g.gain.value = 1.0
      src.connect(g)
      g.connect(audioCtx.destination)
      src.start(0)
      console.log('→ Tocando direto no destination com gain=1. Você deve ouvir agora.')
      setTimeout(() => { try { src.stop() } catch {} console.log('→ Parado.') }, 4000)
    } else {
      console.log('→ Não tem buffer ou contexto para testar')
    }
  }
}
