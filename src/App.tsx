import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RequireAuth } from './components/auth/RequireAuth'
import { RequireSuperAdmin } from './components/auth/RequireAdmin'
import { AppShell } from './components/layout/AppShell'
import { RouteFallback } from './components/RouteFallback'
import { ApontamentosLayout } from './layouts/ApontamentosLayout'
import { TourProvider } from './tour/TourContext'
import { TourOverlay } from './tour/TourOverlay'
import { TourLauncher } from './tour/TourLauncher'

function AuthedShellWithTour() {
  return (
    <>
      <AppShell />
      <TourOverlay />
      <TourLauncher />
    </>
  )
}

const UsuariosPage = lazy(() =>
  import('./pages/AdministradorPage').then((m) => ({ default: m.UsuariosPage })),
)
const ChecklistPublicoPage = lazy(() =>
  import('./pages/ChecklistPublicoPage').then((m) => ({ default: m.ChecklistPublicoPage })),
)
const ChecklistResultadosPage = lazy(() =>
  import('./pages/ChecklistResultadosPage').then((m) => ({ default: m.ChecklistResultadosPage })),
)
const ChecklistsPage = lazy(() =>
  import('./pages/ChecklistsPage').then((m) => ({ default: m.ChecklistsPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const EvolucaoPage = lazy(() =>
  import('./pages/EvolucaoPage').then((m) => ({ default: m.EvolucaoPage })),
)
const HistoricoPage = lazy(() =>
  import('./pages/HistoricoPage').then((m) => ({ default: m.HistoricoPage })),
)
const PrivacyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })),
)
const TermsPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ManagePage = lazy(() => import('./pages/ManagePage').then((m) => ({ default: m.ManagePage })))
const RegistroEspecialPage = lazy(() =>
  import('./pages/RegistroEspecialPage').then((m) => ({ default: m.RegistroEspecialPage })),
)
const VeiculosStatusPage = lazy(() =>
  import('./pages/VeiculosStatusPage').then((m) => ({ default: m.VeiculosStatusPage })),
)
const ChecklistDetalharPage = lazy(() =>
  import('./pages/ChecklistDetalharPage').then((m) => ({ default: m.ChecklistDetalharPage })),
)
const LazyRegistroRoute = lazy(() =>
  import('./routes/RegistroRoute').then((m) => ({ default: m.RegistroRoute })),
)
const TrocarSenhaPage = lazy(() =>
  import('./pages/TrocarSenhaPage').then((m) => ({ default: m.TrocarSenhaPage })),
)

/** Links antigos /checklist/:tipo — exceto /checklist/demo */
function ChecklistTipoRedirect() {
  const { tipo } = useParams<{ tipo: string }>()
  if (tipo === 'demo') {
    return <ChecklistPublicoPage forceDemo />
  }
  return <Navigate to="/checklist" replace />
}

export default function App() {
  return (
    <TourProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
        <Route path="/registro-especial" element={<RegistroEspecialPage />} />
        <Route path="/registro" element={<LazyRegistroRoute />} />
        {/* Checklist público — rotas mais específicas primeiro */}
        <Route path="/checklist/demo" element={<ChecklistPublicoPage forceDemo />} />
        <Route path="/checklist/:tipo" element={<ChecklistTipoRedirect />} />
        <Route path="/checklist" element={<ChecklistPublicoPage />} />

        {/* Troca de senha — pública para suportar o fluxo de recovery via link de e-mail */}
        <Route path="/trocar-senha" element={<TrocarSenhaPage />} />

        {/* Rotas autenticadas */}
        <Route element={<RequireAuth />}>
          <Route element={<AuthedShellWithTour />}>
            <Route index element={<DashboardPage />} />
            <Route path="/gerenciar" element={<ApontamentosLayout />}>
              <Route index element={<ManagePage />} />
              <Route path="evolucao" element={<EvolucaoPage />} />
              <Route path="historico" element={<HistoricoPage />} />
              <Route path="checklists" element={<ChecklistsPage />} />
              <Route path="checklists/resultados" element={<ChecklistResultadosPage />} />
            </Route>
            <Route path="/veiculos/status" element={<VeiculosStatusPage />} />
            <Route path="/checklists/detalhar" element={<ChecklistDetalharPage />} />
            <Route path="/veiculos" element={<Navigate to="/gerenciar" replace />} />
            <Route
              path="/usuarios"
              element={
                <RequireSuperAdmin>
                  <UsuariosPage />
                </RequireSuperAdmin>
              }
            />
          </Route>
        </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </TourProvider>
  )
}
