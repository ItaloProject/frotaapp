import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Eye, EyeOff, Loader2, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export function TrocarSenhaPage() {
  const { changePassword, logout, user, loading, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  // Se terminar de carregar e não houver sessão nem recovery, volta ao login
  useEffect(() => {
    if (!loading && !user && !isPasswordRecovery) {
      navigate('/login', { replace: true })
    }
  }, [loading, user, isPasswordRecovery, navigate])
  const [nova, setNova]           = useState('')
  const [confirma, setConfirma]   = useState('')
  const [mostrar, setMostrar]     = useState(false)
  const [erro, setErro]           = useState('')
  const [salvando, setSalvando]   = useState(false)
  const [ok, setOk]               = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (nova !== confirma) { setErro('As senhas não coincidem.'); return }
    setSalvando(true)
    const res = await changePassword(nova)
    setSalvando(false)
    if (!res.ok) {
      const msg = res.message.toLowerCase()
      if (msg.includes('different') || msg.includes('same') || msg.includes('diferente')) {
        setErro('A nova senha deve ser diferente da senha temporária.')
      } else {
        setErro('Não foi possível alterar a senha. Tente novamente.')
      }
      return
    }
    setOk(true)
    setTimeout(() => { navigate('/', { replace: true }) }, 1500)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10">
            <KeyRound size={28} className="text-brand-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-slate-100">
              {isPasswordRecovery ? 'Redefinir senha' : 'Crie sua senha'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {isPasswordRecovery
                ? 'Digite sua nova senha para recuperar o acesso.'
                : 'Este é seu primeiro acesso. Defina uma senha pessoal para continuar.'}
            </p>
          </div>
        </div>

        {ok ? (
          <div className="rounded-xl bg-emerald-900/30 px-4 py-3 text-center text-sm font-semibold text-emerald-400">
            Senha definida com sucesso! Redirecionando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Confirmar senha
              </label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {erro && (
              <p className="rounded-lg bg-rose-900/30 px-3 py-2 text-xs font-semibold text-rose-400">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Definir senha e entrar'}
            </button>
          </form>
        )}

        <div className="mt-5 flex items-center justify-center">
          <span className="text-xs text-slate-500">{user?.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="ml-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
