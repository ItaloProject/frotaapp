import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { OfflineSyncProvider } from './checklists/OfflineSyncProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ApontamentosProvider } from './apontamentos/ApontamentosContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <OfflineSyncProvider>
              <ApontamentosProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </ApontamentosProvider>
            </OfflineSyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] Falha ao registrar service worker', error)
    })
  })

  // Quando o SW ativa uma nova versão, exibe banner apenas para usuários do checklist
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'SW_UPDATED') return
    if (!window.location.pathname.startsWith('/checklist')) return
    if (document.getElementById('pwa-update-banner')) return

    const banner = document.createElement('div')
    banner.id = 'pwa-update-banner'
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'z-index:99999',
      'background:#0b1020',
      'border-top:1px solid rgba(255,255,255,0.12)',
      'box-shadow:0 -8px 40px rgba(0,0,0,0.55)',
      'padding:16px 20px',
      'padding-bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
      'display:flex', 'flex-direction:column', 'gap:12px',
      'font-family:system-ui,sans-serif',
      'animation:slide-up 0.3s ease',
    ].join(';')

    // Animação
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
    `
    document.head.appendChild(style)

    // Linha superior: ícone + texto + fechar
    const top = document.createElement('div')
    top.style.cssText = 'display:flex;align-items:center;gap:10px;'

    const icon = document.createElement('div')
    icon.style.cssText = [
      'width:36px', 'height:36px', 'border-radius:10px', 'flex-shrink:0',
      'background:#be123c', 'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';')
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15"/></svg>`

    const texts = document.createElement('div')
    texts.style.cssText = 'flex:1;min-width:0;'

    const title = document.createElement('div')
    title.style.cssText = 'color:#fff;font-size:14px;font-weight:800;'
    title.textContent = 'Atualização disponível'

    const sub = document.createElement('div')
    sub.style.cssText = 'color:rgba(255,255,255,0.55);font-size:12px;font-weight:600;margin-top:1px;'
    sub.textContent = 'Uma nova versão do app está pronta.'

    texts.appendChild(title)
    texts.appendChild(sub)

    const closeBtn = document.createElement('button')
    closeBtn.style.cssText = [
      'background:none', 'border:none', 'color:rgba(255,255,255,0.4)',
      'cursor:pointer', 'padding:4px', 'flex-shrink:0', 'line-height:1',
    ].join(';')
    closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    closeBtn.onclick = () => banner.remove()

    top.appendChild(icon)
    top.appendChild(texts)
    top.appendChild(closeBtn)

    // Botão de atualizar
    const btn = document.createElement('button')
    btn.style.cssText = [
      'width:100%', 'padding:13px', 'border:none', 'border-radius:14px',
      'background:linear-gradient(135deg,#9f1239,#be123c)',
      'color:#fff', 'font-size:15px', 'font-weight:800', 'cursor:pointer',
      'box-shadow:0 4px 16px rgba(190,18,60,0.45)',
      'letter-spacing:0.01em',
    ].join(';')
    btn.textContent = '🔄 Atualizar agora'
    btn.onclick = () => window.location.reload()

    banner.appendChild(top)
    banner.appendChild(btn)
    document.body.appendChild(banner)
  })
}
