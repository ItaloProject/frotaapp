import { useState } from 'react'
import { BRANDING } from './paths'

const sizeClass = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
} as const

type CollapsedNavMarkProps = {
  className?: string
  size?: keyof typeof sizeClass
}

/** Marca compacta (ícone checklist FA) para sidebar/topbar. */
export function CollapsedNavMark({ className = '', size = 'lg' }: CollapsedNavMarkProps) {
  const [failed, setFailed] = useState(false)
  const boxClass = sizeClass[size]

  if (failed) {
    return (
      <div
        className={[
          'flex shrink-0 items-center justify-center bg-[#0b1020] text-[10px] font-black tracking-tight text-white ring-1 ring-white/10',
          boxClass,
          className,
        ].join(' ')}
        title="FA"
      >
        FA
      </div>
    )
  }

  return (
    <div
      className={[
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-[#0b1020] shadow-sm ring-1 ring-white/10',
        boxClass,
        className,
      ].join(' ')}
      title="FrotaApp"
    >
      <img
        src={BRANDING.favicon}
        alt="FA"
        className="h-[72%] w-[72%] object-contain"
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
