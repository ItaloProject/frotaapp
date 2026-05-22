import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type AuthUser = {
  id: string
  email: string
  role: 'super_admin' | 'admin' | 'user'
  mustChangePassword: boolean
  isDemo?: boolean
}

type Ctx = {
  user: AuthUser | null
  loading: boolean
  isPasswordRecovery: boolean
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => Promise<void>
  changePassword: (newPassword: string) => Promise<{ ok: true } | { ok: false; message: string }>
}

const AuthContext = createContext<Ctx | null>(null)

const DEMO_CREDENTIALS = [
  { email: 'demo@frotaapp.com', password: 'demo123', role: 'super_admin' as const },
  { email: 'admin@frotaapp.com', password: 'admin123', role: 'admin' as const },
  { email: 'user@frotaapp.com', password: 'user123', role: 'user' as const },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading] = useState(false)
  const [isPasswordRecovery] = useState(false)

  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const match = DEMO_CREDENTIALS.find(
      (c) => c.email === email.trim().toLowerCase() && c.password === password,
    )
    if (!match) return { ok: false, message: 'E-mail ou senha incorretos.' }
    setUser({
      id: '00000000-0000-0000-0000-000000000001',
      email: match.email,
      role: match.role,
      mustChangePassword: false,
      isDemo: true,
    })
    try { sessionStorage.setItem('frota.demo.start', String(Date.now())) } catch { /* ignore */ }
    return { ok: true }
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
  }, [])

  const changePassword = useCallback(async (
    _newPassword: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    return { ok: true }
  }, [])

  const value = useMemo(
    () => ({ user, loading, isPasswordRecovery, login, logout, changePassword }),
    [user, loading, isPasswordRecovery, login, logout, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook exposto junto ao provider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
