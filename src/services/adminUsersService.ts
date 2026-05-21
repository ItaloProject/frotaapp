import { supabase } from '../lib/supabase'

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Sessão expirada. Faça login novamente.',
  forbidden: 'Apenas administradores podem executar esta ação.',
  invalid_email: 'Informe um e-mail válido.',
  invalid_password: 'A senha deve ter pelo menos 6 caracteres.',
  invalid_params: 'Dados inválidos. Verifique o formulário.',
  email_exists: 'Já existe um utilizador com este e-mail.',
  create_failed: 'Não foi possível criar o utilizador.',
}

function translateAdminError(code: string | undefined): string {
  if (!code) return 'Erro desconhecido.'
  return ERROR_MESSAGES[code] ?? code
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function callAdminEdgeFunction<T extends { ok?: boolean; error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const token = await getAccessToken()
  if (!token) {
    return { ok: false, message: ERROR_MESSAGES.unauthorized }
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) {
    return { ok: false, message: 'Supabase não configurado.' }
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json()) as T
    if (!res.ok || json.error) {
      return { ok: false, message: translateAdminError(json.error) }
    }
    return { ok: true, data: json }
  } catch {
    return { ok: false, message: 'Erro ao conectar com o servidor.' }
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await callAdminEdgeFunction<{ ok?: boolean }>('reset-user-password', {
    userId,
    newPassword,
  })
  if (!res.ok) return res
  return { ok: true }
}

export type CreateUserMode = 'create' | 'invite'

export async function createOrInviteUser(input: {
  mode: CreateUserMode
  email: string
  password?: string
  role: 'admin' | 'user'
}): Promise<{ ok: true; mode: CreateUserMode } | { ok: false; message: string }> {
  const res = await callAdminEdgeFunction<{ ok?: boolean; mode?: CreateUserMode }>('create-user', {
    mode: input.mode,
    email: input.email.trim(),
    password: input.mode === 'create' ? input.password : undefined,
    role: input.role,
  })
  if (!res.ok) return res
  return { ok: true, mode: res.data.mode ?? input.mode }
}
