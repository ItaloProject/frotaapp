import type { ReactNode } from 'react'

/**
 * Moldura de celular para gravação de vídeo do fluxo de checklist.
 * Viewport interno ~390×844 (iPhone 14 / 14 Pro).
 */
export function ChecklistPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#0a0a0f] p-4 sm:p-8">
      <div className="relative max-w-full">
        {/* Corpo do aparelho */}
        <div
          className="relative overflow-hidden rounded-[2.75rem] bg-[#1a1a1f] p-3 shadow-[0_40px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          style={{ width: 'min(100vw - 2rem, 414px)' }}
        >
          {/* Notch */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

          {/* Tela */}
          <div
            id="checklist-phone-screen"
            className="relative flex flex-col overflow-hidden rounded-[2.1rem] bg-white shadow-inner ring-1 ring-black/20 dark:bg-slate-950"
            style={{ height: 'min(calc(100dvh - 4rem), 844px)' }}
          >
            <div className="checklist-phone-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
              {children}
            </div>
          </div>

          {/* Home indicator */}
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 h-1 w-28 -translate-x-1/2 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  )
}
