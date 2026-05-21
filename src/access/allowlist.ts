const STORAGE_KEY = 'frota.access.allowlist'

export type AllowedUser = {
  email: string
  /** Vazio = legado (aceita qualquer senha com 4+ caracteres). */
  password: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function parseStored(raw: string): AllowedUser[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed) || parsed.length === 0) return []

  if (typeof parsed[0] === 'string') {
    return (parsed as string[])
      .map((x) => normalizeEmail(String(x)))
      .filter(Boolean)
      .map((email) => ({ email, password: '' }))
  }

  return parsed
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && x !== null)
    .map((x) => ({
      email: normalizeEmail(String(x.email ?? '')),
      password: typeof x.password === 'string' ? x.password : '',
    }))
    .filter((u) => u.email)
}

/** Utilizadores autorizados (e-mail + senha). Lista vazia = modo demo (sem filtro por lista). */
export function readAllowlist(): AllowedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return parseStored(raw)
  } catch {
    return []
  }
}

export function writeAllowlist(users: AllowedUser[]): void {
  const byEmail = new Map<string, AllowedUser>()
  for (const u of users) {
    const email = normalizeEmail(u.email)
    if (!email) continue
    byEmail.set(email, { email, password: u.password })
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...byEmail.values()]))
}

export function addToAllowlist(
  email: string,
  password: string,
): { ok: true } | { ok: false; message: string } {
  const e = normalizeEmail(email)
  if (!e) return { ok: false, message: 'Informe o e-mail.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, message: 'E-mail inválido.' }
  if (password.length < 4) return { ok: false, message: 'A senha do utilizador deve ter pelo menos 4 caracteres.' }

  const list = readAllowlist()
  if (list.some((u) => u.email === e)) return { ok: false, message: 'Este e-mail já está na lista.' }
  writeAllowlist([...list, { email: e, password }])
  return { ok: true }
}

export function removeFromAllowlist(email: string): void {
  const e = normalizeEmail(email)
  writeAllowlist(readAllowlist().filter((u) => u.email !== e))
}

export function updateAllowedUserPassword(
  email: string,
  newPassword: string,
): { ok: true } | { ok: false; message: string } {
  if (newPassword.length < 4) return { ok: false, message: 'A senha deve ter pelo menos 4 caracteres.' }
  const e = normalizeEmail(email)
  const list = readAllowlist()
  const i = list.findIndex((u) => u.email === e)
  if (i === -1) return { ok: false, message: 'Utilizador não encontrado na lista.' }
  const next = [...list]
  next[i] = { email: e, password: newPassword }
  writeAllowlist(next)
  return { ok: true }
}
