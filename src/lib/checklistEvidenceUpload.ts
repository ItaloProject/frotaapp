import { supabase } from './supabase'

const SUPABASE_BUCKET = 'checklist-evidencias'

/**
 * URLs públicas das evidências de checklist.
 *
 * **Supabase (predefinido)** — `supabase.storage` bucket `checklist-evidencias`.
 *
 * **Cloudflare R2** — sem expor chaves R2 no browser: configure um endpoint que
 * devolva um URL de upload assinado (Worker, Supabase Edge Function, etc.) e o URL público final.
 *
 * Variáveis:
 * - `VITE_R2_PRESIGN_URL` — POST JSON `{ "key": string, "contentType": string }` →
 *   `{ "uploadUrl": string, "publicUrl": string }`. O cliente faz `PUT uploadUrl` com o corpo = ficheiro.
 * - `VITE_R2_PRESIGN_API_KEY` (opcional) — enviado como `Authorization: Bearer …` no pedido de presign.
 */
export function isChecklistEvidenceR2Enabled(): boolean {
  const u = (import.meta.env.VITE_R2_PRESIGN_URL as string | undefined)?.trim()
  return Boolean(u)
}

export async function uploadChecklistEvidenceFile(file: File, storageKey: string): Promise<string | null> {
  if (isChecklistEvidenceR2Enabled()) {
    const url = await uploadToR2ViaPresign(file, storageKey)
    if (url) return url
    // fallback se o presigner falhar
  }
  return uploadToSupabaseStorage(file, storageKey)
}

async function uploadToSupabaseStorage(file: File, path: string): Promise<string | null> {
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: false })
  if (error) return null
  return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl
}

type PresignResponse = { uploadUrl: string; publicUrl: string }

async function uploadToR2ViaPresign(file: File, key: string): Promise<string | null> {
  const endpoint = (import.meta.env.VITE_R2_PRESIGN_URL as string).trim()
  const apiKey = (import.meta.env.VITE_R2_PRESIGN_API_KEY as string | undefined)?.trim()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const presignRes = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key,
      contentType: file.type || 'application/octet-stream',
    }),
  })

  if (!presignRes.ok) return null

  let data: PresignResponse
  try {
    data = (await presignRes.json()) as PresignResponse
  } catch {
    return null
  }
  if (!data.uploadUrl || !data.publicUrl) return null

  const putRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })

  if (!putRes.ok) return null
  return data.publicUrl
}
