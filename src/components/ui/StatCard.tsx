import type { ReactNode } from 'react'

export function StatCard({
  title,
  subtitle,
  value,
  colorClass,
  icon,
  meta,
  selected = false,
  onClick,
}: {
  title: string
  subtitle: string
  value: string | number
  colorClass: string
  icon: ReactNode
  meta: { label: string; icon: ReactNode }
  selected?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'relative overflow-hidden rounded-2xl p-3 sm:p-4 shadow-soft text-left',
        'transition-transform duration-150',
        onClick ? 'hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0' : '',
        selected ? 'ring-2 ring-white/70' : 'ring-0',
        onClick ? 'cursor-pointer' : '',
        colorClass,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/90">
            {title}
          </div>
          <div className="mt-1 text-xs font-bold text-white/90">{subtitle}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white">
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">
          {value}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold text-white">
          {meta.icon}
          {meta.label}
        </div>
      </div>

      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
    </Tag>
  )
}

