import { Outlet } from 'react-router-dom'
import { X } from 'lucide-react'
import { ApontamentosProvider, useApontamentos } from '../apontamentos/ApontamentosContext'

function ApontamentosShell() {
  const { persistError, clearPersistError } = useApontamentos()

  return (
    <div className="space-y-3">
      {persistError ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <span>{persistError}</span>
          <button
            type="button"
            onClick={clearPersistError}
            className="shrink-0 rounded-lg p-1 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/60"
            aria-label="Dispensar aviso"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}
      <Outlet />
    </div>
  )
}

export function ApontamentosLayout() {
  return (
    <ApontamentosProvider>
      <ApontamentosShell />
    </ApontamentosProvider>
  )
}
