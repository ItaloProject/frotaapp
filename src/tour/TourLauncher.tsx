import { HelpCircle, RotateCcw, X } from 'lucide-react'
import { useTour } from './TourContext'

/** Botão flutuante para iniciar/controlar o tour. Visível apenas na conta demo. */
export function TourLauncher() {
  const { active, isDemo, start, stop, resetTour } = useTour()

  if (!isDemo) return null

  if (active) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={resetTour}
          title="Recomeçar tour do início"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 shadow-lg transition hover:bg-slate-700 hover:text-white"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={stop}
          title="Fechar tour"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-slate-200 shadow-2xl transition hover:bg-slate-600 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={resetTour}
        title="Resetar e recomeçar tour"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-lg transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <RotateCcw size={15} />
      </button>
      <button
        type="button"
        onClick={start}
        title="Iniciar tour guiado"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-2xl shadow-brand-500/40 transition hover:scale-110 hover:bg-brand-600"
      >
        <HelpCircle size={22} />
      </button>
    </div>
  )
}
