import { useState } from 'react'
import { BRANDING } from './paths'

export type BrandLogoTone = 'on-light' | 'on-dark'

type BrandLogoProps = {
  /** Fundo claro → logotipo escuro; fundo escuro → logotipo claro */
  tone: BrandLogoTone
  /** Largura/híbridos visuais */
  variant?: 'horizontal' | 'mark'
  className?: string
  alt?: string
}

export function BrandLogo({ tone, variant = 'horizontal', className = '', alt = 'FrotaApp' }: BrandLogoProps) {
  const src = tone === 'on-light' ? BRANDING.logoOnLight : BRANDING.logoOnDark
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={[
          'inline-flex items-center font-black tracking-tight',
          tone === 'on-light' ? 'text-slate-900' : 'text-white',
          variant === 'mark' ? 'text-lg' : 'text-xl',
          className,
        ].join(' ')}
      >
        FrotaApp
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={[
        variant === 'mark' ? 'h-8 w-8 max-w-[120px] object-contain' : 'h-9 max-h-10 w-auto max-w-[200px] object-left object-contain sm:max-w-[220px]',
        className,
      ].join(' ')}
      loading="lazy"
      decoding="async"
    />
  )
}
