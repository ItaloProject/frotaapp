import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Moon, Sparkles, Sun, UserPlus } from 'lucide-react'
import { ACCESS_AREA_OPTIONS, type AccessArea } from '../access/accessAreas'
import { registerSpecialUser } from '../access/specialUsers'
import { Select } from '../components/ui/Select'
import { useTheme } from '../theme/ThemeProvider'

export type RegistroEspecialVariant = 'standalone' | 'shell'

export function RegistroEspecialPage({ variant = 'standalone' }: { variant?: RegistroEspecialVariant }) {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isDark = theme === 'dark'
  const isShell = variant === 'shell'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [area, setArea] = useState<AccessArea>('TODAS')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setPending(true)
    await new Promise((r) => setTimeout(r, 200))
    const res = registerSpecialUser(email, password, area)
    setPending(false)
    if (res.ok === false) {
      setError(res.message)
      return
    }
    if (isShell) {
      setEmail('')
      setPassword('')
      setConfirm('')
      setArea('TODAS')
      setSuccess('Utilizador especial registado. Ele pode iniciar sessão na página de login com este e-mail e senha.')
      return
    }
    navigate('/login', { replace: true, state: { fromRegistroEspecial: true } })
  }

  const formCard = (
    <div
      className={`rounded-3xl border px-6 py-8 shadow-xl sm:px-8 ${isShell ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80' : isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'}`}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
          <Sparkles size={22} />
        </div>
        <div>
          <h1
            className={`text-2xl font-black tracking-tight ${isShell ? 'text-slate-900 dark:text-white' : isDark ? 'text-white' : 'text-slate-900'}`}
          >
            Registo — utilizador especial
          </h1>
          <p className={`mt-1 text-sm font-semibold ${isShell ? 'text-slate-600 dark:text-slate-400' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Preencha os dados abaixo. A área define que segmento da frota este perfil pode acompanhar após o login.
          </p>
        </div>
      </div>

      <div
        className={`mb-6 rounded-2xl border px-4 py-4 ${isShell ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60' : isDark ? 'border-slate-700 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}
      >
        <h2 className={`mb-2 text-xs font-black uppercase tracking-wider ${isShell ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
          O que será registado?
        </h2>
        <ul className={`list-inside list-disc space-y-1.5 text-sm font-semibold ${isShell ? 'text-slate-700 dark:text-slate-300' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <li>
            <span className="font-bold text-slate-900 dark:text-white">E-mail</span> — utilizado para iniciar sessão.
          </li>
          <li>
            <span className="font-bold text-slate-900 dark:text-white">Senha</span> — palavra-passe de acesso (mínimo 4 caracteres).
          </li>
          <li>
            <span className="font-bold text-slate-900 dark:text-white">Área de acesso</span> — segmento da frota que pretende consultar:{' '}
            <span className="font-mono text-xs font-bold tracking-tight text-brand-600 dark:text-brand-400">
              {ACCESS_AREA_OPTIONS.map((o) => o.label).join(', ')}
            </span>
            .
          </li>
        </ul>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <label htmlFor="reg-email" className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-400">
            E-mail
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-bold outline-none transition-all focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 ${isShell ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white' : isDark ? 'border-slate-800 bg-slate-950 text-white focus:border-blue-500' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:border-blue-500 focus:bg-white'}`}
            placeholder="voce@empresa.com.br"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-pw" className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Senha
            </label>
            <input
              id="reg-pw"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              minLength={4}
              className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-bold outline-none transition-all focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 ${isShell ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white' : isDark ? 'border-slate-800 bg-slate-950 text-white focus:border-blue-500' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:border-blue-500 focus:bg-white'}`}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <div>
            <label htmlFor="reg-pw2" className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Confirmar senha
            </label>
            <input
              id="reg-pw2"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
              className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-bold outline-none transition-all focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 ${isShell ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white' : isDark ? 'border-slate-800 bg-slate-950 text-white focus:border-blue-500' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:border-blue-500 focus:bg-white'}`}
              placeholder="Repita a senha"
            />
          </div>
        </div>

        <Select
          label="Área de acesso desejada"
          value={area}
          options={[...ACCESS_AREA_OPTIONS]}
          onChange={(v) => setArea(v as AccessArea)}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-800 dark:text-emerald-200" role="status">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="animate-spin" size={22} /> : <UserPlus size={20} />}
          {isShell ? 'Registar utilizador especial' : 'Criar registo e ir ao login'}
        </button>
      </form>
    </div>
  )

  if (isShell) {
    return (
      <div className="mx-auto max-w-lg">
        {formCard}
      </div>
    )
  }

  return (
    <div className={`relative min-h-dvh w-full transition-colors duration-500 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <button
        type="button"
        onClick={toggleTheme}
        className={`fixed z-50 flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-all ${isDark ? 'border-slate-600/80 bg-slate-950/90 text-slate-300 backdrop-blur-sm hover:border-slate-500 hover:bg-slate-900 hover:text-white' : 'border-slate-200 bg-white/95 text-slate-600 backdrop-blur-sm hover:bg-slate-50'}`}
        style={{
          top: 'max(1rem, env(safe-area-inset-top, 0px))',
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        aria-label="Alternar tema"
      >
        {isDark ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
      </button>

      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        <Link
          to="/login"
          className={`mb-6 inline-flex items-center gap-2 text-sm font-bold transition-colors ${isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'}`}
        >
          <ArrowLeft size={18} />
          Voltar ao login
        </Link>

        {formCard}
      </div>
    </div>
  )
}
