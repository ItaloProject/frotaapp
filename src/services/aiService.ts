/**
 * Comunicação com a API Gemini (Google).
 * Retentativas com backoff exponencial em falhas de rede e em 5xx / 429.
 */

const GEMINI_MODELS_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const DEFAULT_MODEL = 'gemini-2.5-flash'
const MAX_RETRIES = 5

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
}

let cachedResolvedModel: { model: string; at: number } | null = null
let resolveModelInFlight: Promise<string> | null = null

function normalizeModelName(raw: string): string {
  const t = raw.trim()
  return t.replace(/^models\//, '')
}

async function resolveGenerateContentModel(apiKey: string): Promise<string> {
  const now = Date.now()
  if (cachedResolvedModel && now - cachedResolvedModel.at < 10 * 60 * 1000) return cachedResolvedModel.model
  if (resolveModelInFlight) return resolveModelInFlight

  const wanted = normalizeModelName(import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_MODEL)

  resolveModelInFlight = (async () => {
    try {
      const url = `${GEMINI_MODELS_BASE}?key=${encodeURIComponent(apiKey)}`
      const response = await fetch(url)
      const data = (await response.json()) as { models?: GeminiModel[]; error?: { message?: string } }

      const models = Array.isArray(data.models) ? data.models : []
      const generateCapable = models.filter((m) =>
        Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods.includes('generateContent') : false,
      )

      const names = generateCapable
        .map((m) => (m.name ? normalizeModelName(m.name) : ''))
        .filter((n) => Boolean(n))

      const wantedMatch = names.find((n) => n === wanted || n.endsWith(`/${wanted}`))
      const preferredFastest =
        // Prioriza "2.5 flash" quando existir (é o que está habilitado no free tier).
        names.find((n) => /gemini/i.test(n) && /2\.5/i.test(n) && /flash/i.test(n)) ??
        // Depois "2.0 flash".
        names.find((n) => /gemini/i.test(n) && /2\.0/i.test(n) && /flash/i.test(n)) ??
        // Depois qualquer "flash" gemini.
        names.find((n) => /gemini/i.test(n) && /flash/i.test(n)) ??
        // Depois qualquer gemini.
        names.find((n) => /gemini/i.test(n)) ??
        // E por fim o primeiro da lista.
        names[0]

      const chosen = wantedMatch ?? preferredFastest ?? wanted
      cachedResolvedModel = { model: chosen, at: Date.now() }
      return chosen
    } catch {
      // Se não conseguir listar modelos, volta para o valor do .env (ou default) e deixa a API responder.
      const fallback = normalizeModelName(import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_MODEL)
      cachedResolvedModel = { model: fallback, at: Date.now() }
      return fallback
    } finally {
      resolveModelInFlight = null
    }
  })()

  return resolveModelInFlight
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type AskGeminiResult =
  | { ok: true; text: string }
  | { ok: false; kind: 'not_configured' }
  | { ok: false; kind: 'error'; message: string }

export function isGeminiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY?.trim())
}

/**
 * @param prompt — texto do utilizador
 * @param systemInstruction — instruções de sistema (persona, formato, etc.)
 */
export async function askGemini(prompt: string, systemInstruction: string): Promise<AskGeminiResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim()
  if (!apiKey) return { ok: false, kind: 'not_configured' }

  const model = await resolveGenerateContentModel(apiKey)
  const url = `${GEMINI_MODELS_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const lastErrorMessage = 'Não foi possível conectar. Tente de novo em instantes.'

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      })

      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
        error?: { message?: string }
      }

      if (!response.ok) {
        const msg = data.error?.message ?? `Erro da API (${response.status}).`
        const retryable = response.status >= 500 || response.status === 429
        if (retryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.min(16_000, 2 ** (attempt + 1) * 1000)
          await sleep(delay)
          continue
        }
        return { ok: false, kind: 'error', message: msg }
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      const trimmed = text?.trim()
      return { ok: true, text: trimmed && trimmed.length > 0 ? trimmed : 'Sem resposta da IA.' }
    } catch {
      if (attempt >= MAX_RETRIES - 1) {
        return { ok: false, kind: 'error', message: lastErrorMessage }
      }
      const delay = Math.min(16_000, 2 ** (attempt + 1) * 1000)
      await sleep(delay)
    }
  }

  return { ok: false, kind: 'error', message: lastErrorMessage }
}
