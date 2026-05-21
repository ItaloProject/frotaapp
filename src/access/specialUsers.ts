import type { AccessArea } from './accessAreas'
import { isAccessArea } from './accessAreas'

const STORAGE_KEY = 'frota.users.special'

export type SpecialUserRecord = {
  email: string
  password: string
  area: AccessArea
  registeredAt: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function readSpecialUsers(): SpecialUserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && x !== null)
      .map((x) => ({
        email: normalizeEmail(String(x.email ?? '')),
        password: typeof x.password === 'string' ? x.password : '',
        area: isAccessArea(String(x.area)) ? (String(x.area) as AccessArea) : 'TODAS',
        registeredAt: typeof x.registeredAt === 'string' ? x.registeredAt : new Date(0).toISOString(),
      }))
      .filter((u) => u.email)
  } catch {
    return []
  }
}

function writeSpecialUsers(users: SpecialUserRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

export function registerSpecialUser(
  email: string,
  password: string,
  area: AccessArea,
): { ok: true } | { ok: false; message: string } {
  const e = normalizeEmail(email)
  if (!e) return { ok: false, message: 'Informe o e-mail.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, message: 'E-mail inválido.' }
  if (password.length < 4) return { ok: false, message: 'A senha deve ter pelo menos 4 caracteres.' }

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && e === adminEmail) {
    return { ok: false, message: 'Este e-mail está reservado à conta de administrador.' }
  }

  const list = readSpecialUsers()
  if (list.some((u) => u.email === e)) {
    return { ok: false, message: 'Já existe registo para este e-mail. Use o login ou contacte o administrador.' }
  }

  writeSpecialUsers([
    ...list,
    {
      email: e,
      password,
      area,
      registeredAt: new Date().toISOString(),
    },
  ])
  return { ok: true }
}

export function removeSpecialUser(email: string): void {
  const e = normalizeEmail(email)
  writeSpecialUsers(readSpecialUsers().filter((u) => u.email !== e))
}

export function updateSpecialUserPassword(
  email: string,
  newPassword: string,
): { ok: true } | { ok: false; message: string } {
  if (newPassword.length < 4) return { ok: false, message: 'A senha deve ter pelo menos 4 caracteres.' }
  const e = normalizeEmail(email)
  const list = readSpecialUsers()
  const i = list.findIndex((u) => u.email === e)
  if (i === -1) return { ok: false, message: 'Utilizador especial não encontrado.' }
  const next = [...list]
  const cur = next[i]!
  next[i] = { ...cur, password: newPassword }
  writeSpecialUsers(next)
  return { ok: true }
}

/** Credenciais exatas (demo / localStorage). */
export function findSpecialUserLogin(email: string, password: string): SpecialUserRecord | null {
  const e = normalizeEmail(email)
  const u = readSpecialUsers().find((x) => x.email === e && x.password === password)
  return u ?? null
}
