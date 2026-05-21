import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

/** Permite acesso a admins E super_admins (ex.: página de registro de veículos). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

/** Restringe a página apenas a super_admins (ex.: gestão de utilizadores). */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
