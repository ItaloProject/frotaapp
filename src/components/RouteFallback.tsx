/** Fallback partilhado enquanto chunk da rota é carregado (code-splitting). */
export function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
      <span
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200"
        aria-hidden
      />
      <span>A carregar…</span>
    </div>
  )
}
