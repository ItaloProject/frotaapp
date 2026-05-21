import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Erro não tratado:', error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-rose-100 dark:bg-rose-900/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-10 w-10 text-rose-500" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <div className="max-w-sm">
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
            Algo deu errado
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ocorreu um erro inesperado na aplicação. Recarregue a página para continuar.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-auto rounded-xl bg-slate-100 p-3 text-left text-[11px] text-rose-700 dark:bg-slate-900 dark:text-rose-400">
              {error.message}
            </pre>
          )}
        </div>

        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 active:scale-95 dark:shadow-rose-900/30"
        >
          Recarregar página
        </button>
      </div>
    )
  }
}
