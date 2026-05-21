import type { AccessArea } from './accessAreas'
import { readAllowlist, removeFromAllowlist } from './allowlist'
import { registerSpecialUser } from './specialUsers'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Remove da lista padrão e regista como especial (mantém senha e área por omissão). */
export function convertAllowlistUserToSpecial(
  email: string,
  area: AccessArea = 'TODAS',
): { ok: true } | { ok: false; message: string } {
  const e = normalizeEmail(email)
  const row = readAllowlist().find((u) => u.email === e)
  if (!row) return { ok: false, message: 'Utilizador não encontrado na lista padrão.' }
  if (!row.password || row.password.length < 4) {
    return {
      ok: false,
      message: 'Defina uma senha com pelo menos 4 caracteres antes de tornar este utilizador especial.',
    }
  }

  const reg = registerSpecialUser(row.email, row.password, area)
  if (!reg.ok) return reg

  removeFromAllowlist(row.email)
  return { ok: true }
}
