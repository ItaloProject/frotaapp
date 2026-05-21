import { NavLink, useNavigate } from 'react-router-dom'
import { Car, ClipboardList, LayoutDashboard, LogOut, Settings2, Shield, X } from 'lucide-react'
import { InstagramIcon } from '../../branding/InstagramIcon'
import { SOCIAL_LINKS } from '../../branding/socialLinks'
import { useAuth } from '../../auth/AuthContext'
import { useTheme } from '../../theme/ThemeProvider'
import { BrandLogo } from '../../branding/BrandLogo'
import { CollapsedNavMark } from '../../branding/CollapsedNavMark'

const baseNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/gerenciar', label: 'Gerenciar', icon: Settings2, end: true },
  { to: '/registro', label: 'Registro', icon: Car, end: false },
  { to: '/gerenciar/checklists', label: 'Checklists', icon: ClipboardList, end: false },
] as const

export function Sidebar({
  open,
  collapsed,
  onClose,
}: {
  open: boolean
  collapsed: boolean
  onClose: () => void
}) {
  const { theme } = useTheme()
  const navTone = theme === 'dark' ? 'on-dark' : 'on-light'

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar"
        className={[
          'hidden h-full shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-950',
          'transition-[width] duration-200 ease-out',
          collapsed ? 'w-20' : 'w-72',
        ].join(' ')}
      >
        <Header collapsed={collapsed} />
        <Nav collapsed={collapsed} onNavigate={() => {}} />
        <Footer collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <div className={open ? 'md:hidden' : 'hidden'}>
        <button
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-label="Fechar menu"
        />
        <aside className="fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] border-r border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <div className="flex h-14 items-center justify-between px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <BrandLogo tone={navTone} variant="horizontal" />
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <Nav collapsed={false} onNavigate={onClose} />
          <Footer collapsed={false} onAfterLogout={onClose} />
        </aside>
      </div>
    </>
  )
}

function Header({ collapsed }: { collapsed: boolean }) {
  const { theme } = useTheme()
  const onDarkChrome = theme === 'dark'
  const tone = onDarkChrome ? 'on-dark' : 'on-light'

  return (
    <div
      className={[
        'flex min-h-14 items-center gap-2',
        collapsed ? 'justify-center px-2 py-2.5' : 'h-14 px-5',
      ].join(' ')}
    >
      {collapsed ? (
        <CollapsedNavMark size="lg" />
      ) : (
        <div className="flex min-w-0 flex-1 items-center">
          <BrandLogo tone={tone} variant="horizontal" className="min-w-0" />
        </div>
      )}
    </div>
  )
}

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const { user } = useAuth()
  const navItems = [
    ...baseNav,
    ...(user?.role === 'super_admin' ? ([{ to: '/usuarios', label: 'Usuários', icon: Shield, end: false }] as const) : []),
  ]

  return (
    <nav className="px-3 py-3">
      {!collapsed ? (
        <div className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navegação
        </div>
      ) : null}
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'group relative flex items-center rounded-xl px-3 py-2 text-sm font-extrabold',
                  collapsed ? 'justify-center' : 'gap-3',
                  'transition-all duration-150',
                  isActive
                    // Ativo: fundo sutil com borda interna colorida + texto brilhante
                    ? 'bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 ring-1 ring-inset ring-brand-600/20 dark:ring-brand-500/20'
                    // Inativo: texto atenuado, hover apenas clareia levemente (sem fundo pesado)
                    : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200',
                ].join(' ')
              }
            >
              <span
                className={[
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-150',
                  // Ativo: ícone com fundo colorido
                  'group-[&[aria-current=page]]:bg-brand-600/15 group-[&[aria-current=page]]:text-brand-600',
                  'group-[&[aria-current=page]]:dark:bg-brand-500/15 group-[&[aria-current=page]]:dark:text-brand-400',
                  // Inativo: fundo neutro, hover clareia
                  'bg-transparent text-slate-500 group-hover:bg-slate-200/60 group-hover:text-slate-700',
                  'dark:text-slate-400 dark:group-hover:bg-slate-700/40 dark:group-hover:text-slate-200',
                ].join(' ')}
              >
                <item.icon size={18} />
              </span>

              {!collapsed ? <span className="truncate">{item.label}</span> : null}

              {/* Indicador lateral: barra colorida visível apenas no estado ativo */}
              <span className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-600 opacity-0 transition-opacity duration-150 group-[&[aria-current=page]]:opacity-100 dark:bg-brand-400" />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer({ collapsed, onAfterLogout }: { collapsed: boolean; onAfterLogout?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      className={[
        'mt-auto border-t border-slate-200 py-4 dark:border-slate-800',
        collapsed ? 'px-3' : 'px-5',
      ].join(' ')}
    >
      {!collapsed && user ? (
        <div className="mb-3 space-y-1">
          <div
            className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400"
            title={user.email}
          >
            {user.email}
          </div>
          {user.role === 'super_admin' ? (
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Super Admin
            </div>
          ) : user.role === 'admin' ? (
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Administrador
            </div>
          ) : null}
        </div>
      ) : null}
      {!collapsed ? (
        <div className="mb-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
            Desenvolvido por Italo Bruno da Silva Fontes
          </p>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_LINKS.developer.href ? (
              <a
                href={SOCIAL_LINKS.developer.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-extrabold text-slate-600 transition hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-800/80"
                title={`Instagram ${SOCIAL_LINKS.developer.label}`}
              >
                <InstagramIcon size={12} />
                @{SOCIAL_LINKS.developer.handle}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={['flex items-center gap-2', collapsed ? 'flex-col' : 'flex-row'].join(' ')}>
        <button
          type="button"
          onClick={() => {
            logout()
            onAfterLogout?.()
            navigate('/login', { replace: true })
          }}
          className={[
            'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900',
            collapsed ? 'w-full' : 'flex-1',
          ].join(' ')}
          title="Sair"
        >
          <LogOut size={16} />
          {!collapsed ? <span>Sair</span> : null}
        </button>
        <div
          className={[
            'text-xs font-semibold text-slate-400 dark:text-slate-500',
            collapsed ? 'text-center' : 'whitespace-nowrap',
            onAfterLogout && !collapsed ? 'ml-auto' : '',
          ].join(' ')}
        >
          v1.0.0
        </div>
      </div>
    </div>
  )
}

