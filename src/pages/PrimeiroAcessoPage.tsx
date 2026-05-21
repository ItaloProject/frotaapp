import { useState, type FormEvent } from 'react'
import { KeyRound, Eye, EyeOff, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

function ModalTrocarSenha({ onClose }: { onClose: () => void }) {
  const { changePassword } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showNova, setShowNova] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (novaSenha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem.'); return }
    setLoading(true)
    const res = await changePassword(novaSenha)
    setLoading(false)
    if (!res.ok) { setErro('Não foi possível alterar a senha. Tente novamente.'); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600/20">
              <ShieldCheck size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Alterar senha</p>
              <p className="text-[11px] font-medium text-slate-400">Defina uma senha pessoal</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nova senha</label>
            <div className="relative">
              <KeyRound size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showNova ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-9 text-sm font-medium text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="button" onClick={() => setShowNova(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showNova ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmar senha</label>
            <div className="relative">
              <KeyRound size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-9 text-sm font-medium text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="button" onClick={() => setShowConfirmar(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showConfirmar ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Indicador de força */}
          {novaSenha.length > 0 && (
            <div className="flex items-center gap-1.5">
              {[4, 6, 8, 10].map((min, i) => (
                <div key={min} className={`h-1 flex-1 rounded-full transition-colors ${
                  novaSenha.length >= min
                    ? i < 2 ? 'bg-rose-500' : i === 2 ? 'bg-amber-400' : 'bg-emerald-500'
                    : 'bg-slate-700'
                }`} />
              ))}
              <span className="text-[10px] font-bold text-slate-500">
                {novaSenha.length < 6 ? 'Fraca' : novaSenha.length < 8 ? 'Regular' : novaSenha.length < 10 ? 'Boa' : 'Forte'}
              </span>
            </div>
          )}

          {erro && (
            <p className="rounded-xl bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-400">{erro}</p>
          )}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-extrabold text-slate-400 hover:bg-slate-800">
              Agora não
            </button>
            <button type="submit" disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-extrabold text-white hover:bg-blue-500 disabled:opacity-60">
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <ShieldCheck size={15} />}
              {loading ? 'Salvando…' : 'Salvar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function PrimeiroAcessoBanner() {
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!user?.mustChangePassword || dismissed) return null

  return (
    <>
      <div className="flex items-center gap-3 border-b border-amber-400/30 bg-amber-500/10 px-4 py-2.5">
        <ShieldCheck size={15} className="shrink-0 text-amber-400" />
        <p className="min-w-0 flex-1 text-xs font-semibold text-amber-200">
          Este é seu primeiro acesso. Recomendamos que você defina uma senha pessoal.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-amber-400"
        >
          Alterar senha
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-400/60 hover:text-amber-300"
          aria-label="Dispensar"
        >
          <X size={14} />
        </button>
      </div>

      {modalOpen && <ModalTrocarSenha onClose={() => setModalOpen(false)} />}
    </>
  )
}
