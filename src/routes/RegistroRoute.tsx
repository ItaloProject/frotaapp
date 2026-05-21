import { Link } from 'react-router-dom'
import { Car, LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { AppShellLayout } from '../components/layout/AppShell'
import { RegistroVeiculosPage } from '../pages/RegistroVeiculosPage'
import { TourOverlay } from '../tour/TourOverlay'
import { TourLauncher } from '../tour/TourLauncher'

export function RegistroRoute() {
  const { user } = useAuth()

  if (user) {
    // Overlay/launcher do tour aqui também: /registro fica fora do shell
    // autenticado, mas compartilha o TourProvider global montado em App.
    return (
      <AppShellLayout>
        <RegistroVeiculosPage />
        <TourOverlay />
        <TourLauncher />
      </AppShellLayout>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white dark:bg-slate-800">
            <Car size={18} aria-hidden />
          </span>
          <span className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">Registro da frota</span>
        </div>
        <Link
          to="/login"
          state={{ from: '/registro' }}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <LogIn size={18} aria-hidden />
          Entrar
        </Link>
      </header>
      <RegistroVeiculosPage />
    </div>
  )
}
