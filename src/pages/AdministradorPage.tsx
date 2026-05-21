import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Select, type SelectOption } from '../components/ui/Select'
import {
  createOrInviteUser,
  resetUserPassword,
  type CreateUserMode,
} from '../services/adminUsersService'

type ProfileRow = {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: string
}

type RoleFilter = 'todos' | 'admin' | 'user'

const ROLE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'todos', label: 'Todos os perfis' },
  { value: 'admin', label: 'Administradores' },
  { value: 'user', label: 'Usuários' },
]

const ROLE_CREATE_OPTIONS: SelectOption[] = [
  { value: 'user', label: 'Usuário' },
  { value: 'admin', label: 'Administrador' },
]

function formatDateBR(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function RoleBadge({ role }: { role: ProfileRow['role'] }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
        <ShieldCheck size={11} aria-hidden />
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <User size={11} aria-hidden />
      Usuário
    </span>
  )
}

export function UsuariosPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroRole, setFiltroRole] = useState<RoleFilter>('todos')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [resetModal, setResetModal] = useState<{ id: string; email: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [redefinindo, setRedefinindo] = useState(false)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateUserMode>('create')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createConfirm, setCreateConfirm] = useState('')
  const [createRole, setCreateRole] = useState<'admin' | 'user'>('user')
  const [criando, setCriando] = useState(false)

  const showMsg = useCallback((text: string, ok = true) => {
    setMsg({ text, ok })
    window.setTimeout(() => setMsg(null), 4000)
  }, [])

  const carregar = useCallback(async () => {
    if (!supabaseConfigured) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    const { data, error } = await supabase.rpc('list_users_with_roles')
    if (error) {
      showMsg('Erro ao carregar: ' + error.message, false)
    } else {
      setUsers((data as ProfileRow[]) ?? [])
    }
    setCarregando(false)
  }, [showMsg])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin').length
    return {
      total: users.length,
      admins,
      users: users.length - admins,
    }
  }, [users])

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filtroRole !== 'todos' && u.role !== filtroRole) return false
      if (!q) return true
      return u.email.toLowerCase().includes(q)
    })
  }, [users, search, filtroRole])

  const alterarRole = async (id: string, novoRole: 'admin' | 'user') => {
    if (id === currentUser?.id && novoRole !== 'admin') {
      showMsg('Não é possível remover o seu próprio acesso de administrador.', false)
      return
    }
    const { error } = await supabase.from('profiles').update({ role: novoRole }).eq('id', id)
    if (error) {
      showMsg('Erro ao alterar perfil: ' + error.message, false)
      return
    }
    showMsg('Perfil atualizado com sucesso.')
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: novoRole } : u)))
  }

  const abrirResetModal = (u: ProfileRow) => {
    setResetModal({ id: u.id, email: u.email })
    setNovaSenha('')
  }

  const fecharResetModal = () => {
    setResetModal(null)
    setNovaSenha('')
  }

  const redefinirSenha = async () => {
    if (!resetModal || novaSenha.length < 6) return
    setRedefinindo(true)
    const res = await resetUserPassword(resetModal.id, novaSenha)
    if (res.ok) {
      showMsg(`Senha de ${resetModal.email} redefinida com sucesso.`)
      fecharResetModal()
    } else {
      showMsg(res.message, false)
    }
    setRedefinindo(false)
  }

  const abrirCreateModal = () => {
    setCreateMode('create')
    setCreateEmail('')
    setCreatePassword('')
    setCreateConfirm('')
    setCreateRole('user')
    setCreateModalOpen(true)
  }

  const fecharCreateModal = () => {
    setCreateModalOpen(false)
    setCreateEmail('')
    setCreatePassword('')
    setCreateConfirm('')
    setCreateRole('user')
  }

  const criarUtilizador = async () => {
    const email = createEmail.trim()
    if (!email.includes('@')) {
      showMsg('Informe um e-mail válido.', false)
      return
    }
    if (createMode === 'create') {
      if (createPassword.length < 6) {
        showMsg('A senha deve ter pelo menos 6 caracteres.', false)
        return
      }
      if (createPassword !== createConfirm) {
        showMsg('As senhas não coincidem.', false)
        return
      }
    }

    setCriando(true)
    const res = await createOrInviteUser({
      mode: createMode,
      email,
      password: createMode === 'create' ? createPassword : undefined,
      role: createRole,
    })
    setCriando(false)

    if (!res.ok) {
      showMsg(res.message, false)
      return
    }

    if (res.mode === 'invite') {
      showMsg(`Convite enviado para ${email}.`)
    } else {
      showMsg(`Utilizador ${email} criado com sucesso.`)
    }
    fecharCreateModal()
    void carregar()
  }

  return (
    <div className="space-y-6">
      {msg ? (
        <div
          className={`fixed top-6 right-6 z-[100] flex max-w-md items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl ${
            msg.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}
          role="status"
        >
          {msg.ok ? <Check size={20} /> : <X size={20} />}
          <span className="text-sm font-bold">{msg.text}</span>
        </div>
      ) : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-soft dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900">
            <Shield size={20} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Usuários</h1>
            <p className="mt-0.5 max-w-xl text-sm font-semibold text-slate-500 dark:text-slate-400">
              Gerencie perfis de acesso, permissões e redefinição de senhas da equipe.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={abrirCreateModal}
            disabled={!supabaseConfigured}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-700 disabled:opacity-50 dark:shadow-blue-950/30"
          >
            <UserPlus size={14} aria-hidden />
            Novo utilizador
          </button>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando || !supabaseConfigured}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
        </div>
      </header>

      {!supabaseConfigured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Configure <code className="font-mono text-xs">VITE_SUPABASE_URL</code> e{' '}
          <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> para carregar os utilizadores.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            { label: 'Total', value: stats.total, Icon: Users, tone: 'border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60' },
            {
              label: 'Administradores',
              value: stats.admins,
              Icon: ShieldCheck,
              tone: 'border-brand-200/80 bg-brand-50/80 dark:border-brand-900/40 dark:bg-brand-950/30',
            },
            {
              label: 'Usuários',
              value: stats.users,
              Icon: User,
              tone: 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950',
            },
          ] as const
        ).map(({ label, value, Icon, tone }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-soft ${tone}`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-200">
              <Icon size={18} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-end sm:px-5">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Buscar
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
              <input
                type="search"
                placeholder="E-mail do utilizador…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100"
              />
            </div>
          </label>
          <div className="w-full sm:w-48">
            <Select label="Perfil" value={filtroRole} options={ROLE_FILTER_OPTIONS} onChange={(v) => setFiltroRole(v as RoleFilter)} />
          </div>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
            <RefreshCw size={16} className="animate-spin" aria-hidden />
            A carregar utilizadores…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">
            {users.length === 0 ? 'Nenhum utilizador encontrado.' : 'Nenhum utilizador corresponde aos filtros.'}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                    <th className="px-5 py-3">E-mail</th>
                    <th className="px-5 py-3">Perfil</th>
                    <th className="px-5 py-3">Criado em</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtrados.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                        <td className="px-5 py-3.5">
                          <div className="truncate font-extrabold text-slate-900 dark:text-slate-100">{u.email}</div>
                          {isSelf ? (
                            <span className="mt-0.5 inline-block text-[10px] font-black uppercase tracking-wide text-brand-600 dark:text-brand-400">
                              Sua conta
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {formatDateBR(u.created_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirResetModal(u)}
                              title="Redefinir senha"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-extrabold text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                            >
                              <KeyRound size={12} aria-hidden />
                              Senha
                            </button>
                            <select
                              value={u.role}
                              disabled={isSelf}
                              title={isSelf ? 'Não pode alterar o seu próprio perfil' : undefined}
                              onChange={(e) => void alterarRole(u.id, e.target.value as 'admin' | 'user')}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="user">Usuário</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {filtrados.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <div key={u.id} className="space-y-3 px-4 py-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{u.email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <RoleBadge role={u.role} />
                        <span className="text-xs font-semibold text-slate-400">{formatDateBR(u.created_at)}</span>
                        {isSelf ? (
                          <span className="text-[10px] font-black uppercase tracking-wide text-brand-600 dark:text-brand-400">
                            Sua conta
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => abrirResetModal(u)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <KeyRound size={12} aria-hidden />
                        Redefinir senha
                      </button>
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => void alterarRole(u.id, e.target.value as 'admin' | 'user')}
                        className="min-w-[7rem] flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-5">
          <span>
            A mostrar {filtrados.length} de {users.length} utilizador{users.length !== 1 ? 'es' : ''}
          </span>
          <span>Fonte: Supabase Auth + perfis</span>
        </div>
      </div>

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={fecharCreateModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="novo-utilizador-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600 dark:text-blue-400" aria-hidden />
                <span id="novo-utilizador-titulo" className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Novo utilizador
                </span>
              </div>
              <button
                type="button"
                onClick={fecharCreateModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setCreateMode('create')}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
                  createMode === 'create'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Criar com senha
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('invite')}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
                  createMode === 'invite'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Convidar por e-mail
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  E-mail
                </span>
                <input
                  type="email"
                  autoComplete="off"
                  placeholder="nome@empresa.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              {createMode === 'create' ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Senha
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Confirmar senha
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      value={createConfirm}
                      onChange={(e) => setCreateConfirm(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                </>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-3 text-xs font-semibold leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                  <Mail size={14} className="mt-0.5 shrink-0" aria-hidden />
                  O Supabase envia um e-mail de convite com link para definir a senha e aceder ao sistema.
                </p>
              )}

              <Select label="Perfil de acesso" value={createRole} options={ROLE_CREATE_OPTIONS} onChange={(v) => setCreateRole(v as 'admin' | 'user')} />
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={fecharCreateModal}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void criarUtilizador()}
                disabled={
                  criando ||
                  !createEmail.trim() ||
                  (createMode === 'create' && (createPassword.length < 6 || createPassword !== createConfirm))
                }
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {criando ? 'A processar…' : createMode === 'invite' ? 'Enviar convite' : 'Criar utilizador'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetModal ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={fecharResetModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="reset-senha-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-amber-500" aria-hidden />
                <span id="reset-senha-titulo" className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Redefinir senha
                </span>
              </div>
              <button
                type="button"
                onClick={fecharResetModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{resetModal.email}</p>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void redefinirSenha()
              }}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-400/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fecharResetModal}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void redefinirSenha()}
                disabled={redefinindo || novaSenha.length < 6}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-extrabold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {redefinindo ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
