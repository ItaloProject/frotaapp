import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, LogIn, Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { BrandLogo } from '../branding/BrandLogo'
import { CollapsedNavMark } from '../branding/CollapsedNavMark'
import { InstagramIcon } from '../branding/InstagramIcon'
import { SOCIAL_LINKS } from '../branding/socialLinks'
import { useTheme } from '../theme/ThemeProvider'

const FLUX_VB_H = 800
const FLUX_VB_W = 60
const FLUX_PERIOD = 80

function buildFluxRailPath(totalH: number): string {
  const cx = 30
  let d = `M ${cx} 0`
  for (let y = 0; y + FLUX_PERIOD <= totalH; y += FLUX_PERIOD) {
    const midY = y + FLUX_PERIOD / 2
    const nextY = y + FLUX_PERIOD
    d += ` C 45 ${y + 20} 45 ${midY - 20} 30 ${midY}`
    d += ` C 15 ${midY + 20} 15 ${nextY - 20} 30 ${nextY}`
  }
  return d
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}

/** Comprimento sintético para dash-offset (mesmo `d` que o trilho; só animação visual). */
const FLUX_PATH_LENGTH = 1000

const FLUX_TRAIL_LAYERS: ReadonlyArray<{
  dash: string
  width: number
  stroke: string
  opacity: number
  durSec: number
  beginSec: number
}> = [
  { dash: '52 948', width: 11, stroke: '#1e3a5f', opacity: 0.55, durSec: 9.5, beginSec: 0 },
  { dash: '34 966', width: 7, stroke: '#38bdf8', opacity: 0.35, durSec: 8.2, beginSec: -1.1 },
  { dash: '18 982', width: 4, stroke: '#7dd3fc', opacity: 0.85, durSec: 7, beginSec: -2.2 },
]

function LoginFluxVisual({ reduced }: { reduced: boolean }) {
  const uid = useId().replace(/:/g, '')
  const pathId = `lfp-${uid}`
  const gooId = `lgoo-${uid}`
  const railPath = useMemo(() => buildFluxRailPath(FLUX_VB_H), [])

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${FLUX_VB_W} ${FLUX_VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <filter id={gooId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
        </filter>
      </defs>
      {/* Geometria para animateMotion (sem trilho fixo visível) */}
      <path id={pathId} d={railPath} fill="none" stroke="none" strokeWidth="0" />
      {!reduced
        ? FLUX_TRAIL_LAYERS.map((layer, i) => (
            <path
              key={`trail-${i}`}
              d={railPath}
              pathLength={FLUX_PATH_LENGTH}
              fill="none"
              stroke={layer.stroke}
              strokeOpacity={layer.opacity}
              strokeWidth={layer.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={layer.dash}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to={String(FLUX_PATH_LENGTH)}
                dur={`${layer.durSec}s`}
                begin={`${layer.beginSec}s`}
                repeatCount="indefinite"
                calcMode="linear"
              />
            </path>
          ))
        : null}
      {!reduced ? (
        <g filter={`url(#${gooId})`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} r="5" fill="#7dd3fc">
              <animateMotion dur={`${4 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * -1.5}s`} rotate="auto">
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      ) : null}
    </svg>
  )
}

export function LoginPage() {
  const { user, login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()

  const fromRaw = (location.state as { from?: string } | null)?.from
  const from = fromRaw && fromRaw !== '/login' ? fromRaw : '/'
  const fromRegistroEspecial = Boolean((location.state as { fromRegistroEspecial?: boolean } | null)?.fromRegistroEspecial)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // ── Recuperação de senha ──────────────────────────────────────────────────
  const [recovering, setRecovering] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryPending, setRecoveryPending] = useState(false)

  async function onRecoverySubmit(e: React.FormEvent) {
    e.preventDefault()
    setRecoveryError(null)
    setRecoveryPending(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: `${window.location.origin}/trocar-senha`,
    })
    setRecoveryPending(false)
    if (err) {
      const isRateLimit = err.status === 429 || err.message?.toLowerCase().includes('rate') || err.message?.toLowerCase().includes('too many')
      setRecoveryError(
        isRateLimit
          ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
          : 'Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.'
      )
    } else {
      setRecoverySent(true)
    }
  }

  useEffect(() => {
    if (!user || location.pathname !== '/login') return
    navigate(from, { replace: true })
  }, [user, location.pathname, from, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await login(email, password)
    setPending(false)
    if (res.ok === false) {
      setError(res.message)
      return
    }
  }

  const isDark = theme === 'dark'

  return (
    <div
      className={`relative flex min-h-dvh w-full flex-col overflow-y-auto transition-colors duration-500 lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
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

      <div
        className="pointer-events-none fixed inset-0 z-[1] flex select-none items-center justify-center overflow-hidden"
        aria-hidden
      >
        <span className="rotate-[-16deg] whitespace-nowrap text-[min(28vw,9rem)] font-black tracking-[0.32em] text-slate-900/[0.06] lg:text-[min(16vw,8rem)] dark:text-white/[0.08]">
          FA
        </span>
      </div>

      <div className="relative z-10 hidden h-full w-full shrink-0 overflow-hidden bg-[#0B1120] lg:block lg:w-[440px] xl:w-[500px] 2xl:w-[520px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(181,22,73,0.38),transparent_28%),radial-gradient(circle_at_22%_48%,rgba(30,64,175,0.32),transparent_34%),linear-gradient(180deg,#0b1020_0%,#07101f_48%,#030712_100%)]" />
        <div className="pointer-events-none absolute -right-28 top-20 h-72 w-72 rotate-45 rounded-[3rem] border border-rose-400/20 bg-[#b51649]/15 shadow-[0_0_90px_rgba(181,22,73,0.22)]" />
        <div className="pointer-events-none absolute -left-24 bottom-16 h-64 w-64 rotate-45 rounded-[3rem] border border-rose-300/10 bg-[#7f1022]/20 blur-[1px]" />
        <LoginFluxVisual reduced={reducedMotion} />

        <div className="relative z-10 flex h-full min-h-0 flex-col justify-between p-6 text-white sm:p-7 lg:p-9 xl:p-10 2xl:p-12">
          <div className="inline-flex w-fit items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[0_16px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl xl:gap-4 xl:px-5 xl:py-4">
            <CollapsedNavMark size="md" className="ring-2 ring-white/15 xl:h-12 xl:w-12" />
            <div>
              <BrandLogo tone="on-dark" variant="horizontal" className="!h-10 !max-h-10 !max-w-[220px] xl:!h-12 xl:!max-h-12 xl:!max-w-[260px]" />
              <div className="mt-1.5 h-0.5 w-32 rounded-full bg-gradient-to-r from-[#b51649] via-rose-400 to-sky-400 xl:mt-2 xl:h-1 xl:w-36" />
            </div>
          </div>

          <div className="space-y-4 py-4 lg:space-y-5 lg:py-5 xl:space-y-6 2xl:space-y-7 2xl:py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-rose-100">
              <span className="h-2 w-2 rounded-full bg-[#b51649] shadow-[0_0_14px_rgba(244,63,94,0.75)]" />
              Portal FrotaApp
            </div>
            <h2 className="text-balance text-4xl font-black leading-[1.02] tracking-tight lg:text-5xl 2xl:text-6xl">
              <span className="text-white">Sua frota sob</span>
              <br />
              <span className="bg-gradient-to-r from-[#fb7185] via-[#f43f5e] to-[#b51649] bg-clip-text text-transparent">controle</span>
              <br />
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-white bg-clip-text text-transparent">total.</span>
            </h2>
            <p className="max-w-sm text-xs font-semibold leading-relaxed text-slate-300 lg:text-sm">
              Checklists, apontamentos e acompanhamento operacional com controle total.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-extrabold text-slate-200 xl:gap-3 xl:text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur xl:py-3">
                <span className="block text-[9px] uppercase tracking-widest text-rose-200 xl:text-[10px]">Operação</span>
                Frota conectada
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur xl:py-3">
                <span className="block text-[9px] uppercase tracking-widest text-rose-200 xl:text-[10px]">Checklists</span>
                Online e offline
              </div>
            </div>

          </div>

          <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 xl:text-[11px]">
            <span>FrotaApp — gestão de frota</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#b51649] to-transparent" />
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 flex flex-1 flex-col items-center justify-start overflow-y-auto px-4 pb-24 pt-20 transition-colors duration-500 sm:px-8 sm:pt-24 lg:h-full lg:min-h-0 lg:justify-center lg:py-10 lg:pb-12 ${isDark ? 'bg-slate-950' : 'bg-white'}`}
      >
        <div className="mb-8 flex w-full max-w-[380px] shrink-0 items-center justify-center rounded-3xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:hidden">
          <CollapsedNavMark size="md" className="mr-3" />
          <BrandLogo tone={isDark ? 'on-dark' : 'on-light'} variant="horizontal" className="!max-h-10" />
        </div>

        <div className="w-full max-w-[380px]">
          {recovering ? (
            /* ── Formulário de recuperação de senha ────────────────────── */
            <>
              <header className="mb-7 text-center lg:mb-8 lg:text-left xl:mb-10">
                <h1 className={`text-3xl font-black tracking-tight lg:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Recuperar senha</h1>
                <p className="mt-2 text-sm font-bold text-slate-500 lg:mt-3 lg:text-base">Enviaremos um link de redefinição para o seu e-mail</p>
              </header>

              {recoverySent ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-6 text-center">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                  <div>
                    <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">E-mail enviado!</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Verifique sua caixa de entrada em <span className="font-black">{recoveryEmail}</span> e clique no link para redefinir sua senha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRecovering(false); setRecoverySent(false); setRecoveryEmail('') }}
                    className="mt-1 text-[11px] font-black text-[#b51649] hover:underline dark:text-rose-300"
                  >
                    Voltar para o login
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => void onRecoverySubmit(e)} className="space-y-4 xl:space-y-5">
                  <div className="group space-y-2">
                    <label htmlFor="recovery-email" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-[#b51649]">
                      E-mail corporativo
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#b51649]" aria-hidden />
                      <input
                        id="recovery-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        disabled={recoveryPending}
                        className={`w-full rounded-2xl border py-3.5 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:border-[#b51649] focus:ring-4 focus:ring-rose-500/10 disabled:opacity-60 xl:py-4 ${isDark ? 'border-slate-800 bg-slate-900 text-white focus:bg-slate-950' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:bg-white'}`}
                        placeholder="voce@empresa.com.br"
                      />
                    </div>
                  </div>

                  {recoveryError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
                      {recoveryError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={recoveryPending}
                    className="group relative flex min-h-[52px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7f1022] via-[#9f1239] to-[#b51649] py-3.5 text-base font-black text-white shadow-xl shadow-rose-950/15 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 xl:min-h-[56px] xl:py-4"
                  >
                    {recoveryPending ? <Loader2 className="animate-spin" size={24} /> : 'Enviar link de recuperação'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setRecovering(false); setRecoveryError(null) }}
                    className="flex w-full items-center justify-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <ArrowLeft size={13} />
                    Voltar para o login
                  </button>
                </form>
              )}
            </>
          ) : (
            /* ── Formulário de login ────────────────────────────────────── */
            <>
              <header className="mb-7 text-center lg:mb-8 lg:text-left xl:mb-10">
                <h1 className={`text-3xl font-black tracking-tight lg:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Acessar</h1>
                <p className="mt-2 text-sm font-bold text-slate-500 lg:mt-3 lg:text-base">Portal FrotaApp de gestão e apontamentos da frota</p>
              </header>

              {fromRegistroEspecial ? (
                <div
                  className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-800 dark:text-emerald-200"
                  role="status"
                >
                  Registo de utilizador especial concluído. Inicie sessão com o e-mail e a palavra-passe que definiu.
                </div>
              ) : null}

              <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 xl:space-y-5">
                <div className="group space-y-2">
                  <label htmlFor="login-email" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-[#b51649]">
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#b51649]"
                      aria-hidden
                    />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={pending}
                      className={`w-full rounded-2xl border py-3.5 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:border-[#b51649] focus:ring-4 focus:ring-rose-500/10 disabled:opacity-60 xl:py-4 ${isDark ? 'border-slate-800 bg-slate-900 text-white focus:bg-slate-950' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:bg-white'}`}
                      placeholder="voce@empresa.com.br"
                    />
                  </div>
                </div>

                <div className="group space-y-2">
                  <div className="ml-1 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-[#b51649]">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => { setRecovering(true); setRecoveryEmail(email); setRecoveryError(null); setRecoverySent(false) }}
                      className="text-[11px] font-black text-[#b51649] hover:underline dark:text-rose-300"
                    >
                      Recuperar
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#b51649]"
                      aria-hidden
                    />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={pending}
                      className={`w-full rounded-2xl border py-3.5 pl-12 pr-12 text-sm font-bold outline-none transition-all focus:border-[#b51649] focus:ring-4 focus:ring-rose-500/10 disabled:opacity-60 xl:py-4 ${isDark ? 'border-slate-800 bg-slate-900 text-white focus:bg-slate-950' : 'border-slate-200 bg-slate-50/80 text-slate-900 focus:bg-white'}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="group relative flex min-h-[52px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7f1022] via-[#9f1239] to-[#b51649] py-3.5 text-base font-black text-white shadow-xl shadow-rose-950/15 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 xl:min-h-[56px] xl:py-4"
                >
                  {pending ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      Entrar no sistema
                      <LogIn size={20} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <footer
        className="fixed bottom-0 left-0 right-0 z-[30] flex flex-col items-center gap-2 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 text-center text-[10px] font-semibold leading-snug text-slate-500/95 dark:text-slate-500"
        role="contentinfo"
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={SOCIAL_LINKS.developer.href}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center gap-1.5 text-slate-600 transition hover:text-[#9f1239] hover:underline dark:text-slate-400 dark:hover:text-rose-300"
            title={`Instagram ${SOCIAL_LINKS.developer.label}`}
          >
            <InstagramIcon size={12} />
            @{SOCIAL_LINKS.developer.handle}
          </a>
        </div>
        <div>
          <span>© {new Date().getFullYear()} Italo Bruno da Silva Fontes · Todos os direitos reservados.</span>
          <span className="mx-2 text-slate-400">·</span>
          <Link to="/termos" className="pointer-events-auto text-[#9f1239] hover:underline dark:text-rose-300">
            Termos
          </Link>
          <span className="mx-1 text-slate-400">/</span>
          <Link to="/privacidade" className="pointer-events-auto text-[#9f1239] hover:underline dark:text-rose-300">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  )
}
