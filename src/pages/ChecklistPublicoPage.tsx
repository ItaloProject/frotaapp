import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ChecklistPhoneFrame } from '../components/checklist/ChecklistPhoneFrame'
import { DemoCursor } from '../components/checklist/DemoCursor'
import { DEMO_TIMING, demoDelay, resolveDemoProfile, resolveDemoVehicleFields } from '../checklists/checklistDemoConfig'
import { configureDemoNarrator, finishDemoNarration, isDemoNarratorUnlocked, narrateDemoStep, stopDemoNarration, unlockDemoNarrator } from '../checklists/demoNarrator'
import { useChecklistDemoPlayer } from '../checklists/useChecklistDemoPlayer'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ImagePlus,
  Loader2,
  MapPin,
  Paperclip,
  X,
} from 'lucide-react'
import { uploadChecklistEvidenceFile } from '../lib/checklistEvidenceUpload'
import { supabase } from '../lib/supabase'
import { useTheme } from '../theme/ThemeProvider'
import { enqueueChecklist, type OfflineChecklistFile } from '../checklists/offlineQueue'
import { SyncStatus } from '../checklists/SyncStatus'
import { BrandLogo } from '../branding/BrandLogo'
import { CollapsedNavMark } from '../branding/CollapsedNavMark'
import { CHECKLIST_SCHEMAS, SCHEMA_MAP } from '../data/checklistSchemas'
import type { ChecklistSchemaDef } from '../data/checklistSchemas'
import { formatPlaca, getDisplayedFleetVehicles, normalizePlaca } from '../frota/vehicleRegistry'
import { compressChecklistImageIfNeeded } from '../utils/compressChecklistImage'
import { buildWhatsappLink, getSupervisorWhatsapp, isSupervisorReconhecido, SUPERVISOR_WHATSAPP } from '../data/supervisorContatos'

type Resposta = 'c' | 'nc' | 'na' | null

const CHECKLIST_PAGE_BG =
  'bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.14),transparent_34%),linear-gradient(180deg,#fff7f9_0%,#f8fafc_34%,#eef2f7_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.24),transparent_35%),linear-gradient(180deg,#090d18_0%,#020617_58%,#01040b_100%)]'

const FA_CARD =
  'border border-slate-200/80 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-slate-950 dark:shadow-black/30'

const FA_SECTION_HEADER =
  'border-b border-[#7f1022]/10 bg-gradient-to-r from-[#7f1022] via-[#9f1239] to-[#101827] px-4 py-3 text-white dark:border-white/10'

const FA_FIELD_LABEL = 'text-[10px] font-extrabold uppercase tracking-widest text-[#7f1022] dark:text-rose-300'
const FA_PRIMARY_BUTTON =
  'bg-gradient-to-r from-[#7f1022] via-[#9f1239] to-[#b51649] text-white shadow-lg shadow-rose-950/15'

function CgbHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[#0b1020] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] ring-1 ring-white/10">
      <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#b51649]/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-40 w-40 rounded-full bg-[#7f1022]/35 blur-3xl" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <CollapsedNavMark size="lg" className="ring-2 ring-white/15" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-200">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-300">{description}</p>
        </div>
      </div>
    </div>
  )
}

function TelaEscolhaChecklist({
  onSelecionar,
  highlightTipo,
  hideSync,
  embeddedInFrame,
}: {
  onSelecionar: (tipo: string) => void
  highlightTipo?: string | null
  hideSync?: boolean
  embeddedInFrame?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center px-4 pb-8 ${CHECKLIST_PAGE_BG} ${
        embeddedInFrame
          ? 'min-h-full justify-start pt-10'
          : 'min-h-dvh justify-center py-8'
      }`}
    >
      <div className="w-full max-w-md">
        <CgbHero
          eyebrow="FrotaApp — inspeção"
          title="Escolha o checklist"
          description="Preencha com atenção para garantir a qualidade da inspeção. O envio funcionará online e offline."
        />

        <div className="mt-5 space-y-3">
          {CHECKLIST_SCHEMAS.map((schema) => {
            const totalItens = schema.grupos.reduce((acc, g) => acc + g.itens.length, 0)
            return (
              <button
                key={schema.id}
                type="button"
                data-demo-tipo={schema.id}
                onClick={() => onSelecionar(schema.id)}
                className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b51649]/35 hover:shadow-[0_16px_35px_rgba(127,16,34,0.12)] active:scale-[.99] ${FA_CARD} ${
                  highlightTipo === schema.id ? 'scale-[1.02] ring-2 ring-[#b51649] shadow-[0_16px_35px_rgba(181,22,73,0.25)]' : ''
                }`}
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#7f1022]/10 text-[#7f1022] ring-1 ring-[#7f1022]/10 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/10">
                  <ClipboardList size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-slate-900 dark:text-slate-100">{schema.nome}</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {schema.descricao} · {totalItens} itens
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-[#b51649]/45 transition group-hover:translate-x-0.5 group-hover:text-[#b51649]" />
              </button>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        Atenção ao preenchimento, pois os formulários serão avaliados e validados.
        </p>

        {!hideSync && (
          <div className="mt-4">
            <SyncStatus />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tela de identificação
// ---------------------------------------------------------------------------
function TelaIdentificacao({
  schema,
  onConfirmar,
  onVoltar,
  demoNome,
  demoMatricula,
  pulseSubmit,
  embeddedInFrame,
}: {
  schema: ChecklistSchemaDef
  onConfirmar: (nome: string, matricula: string) => void
  onVoltar: () => void
  demoNome?: string
  demoMatricula?: string
  pulseSubmit?: boolean
  embeddedInFrame?: boolean
}) {
  const isDemo = demoNome !== undefined
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const nomeValue = isDemo ? demoNome : nome
  const matriculaValue = isDemo ? (demoMatricula ?? '') : matricula
  const [erros, setErros] = useState<{ nome?: string; matricula?: string }>({})

  const validar = () => {
    const e: typeof erros = {}
    if (!nome.trim()) e.nome = 'Informe seu nome completo.'
    const m = matricula.trim()
    if (!m) e.matricula = 'Informe sua matrícula.'
    else if (!/^\d{1,5}$/.test(m)) e.matricula = 'Matrícula: use apenas números (até 5 dígitos).'
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errosNovos = validar()
    if (Object.keys(errosNovos).length > 0) { setErros(errosNovos); return }
    onConfirmar(nome.trim(), matricula.trim())
  }

  const totalItens = schema.grupos.reduce((acc, g) => acc + g.itens.length, 0)

  return (
    <div
      className={`flex flex-col items-center px-4 pb-8 ${CHECKLIST_PAGE_BG} ${embeddedInFrame ? 'min-h-full justify-start pt-10' : 'min-h-dvh justify-start pt-6'}`}
      style={embeddedInFrame ? { paddingTop: 'max(2.5rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' } : undefined}
    >
      <div className="w-full max-w-sm">

        {/* Cabeçalho */}
        <div className="mb-5">
          <button
            type="button"
            onClick={onVoltar}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ← Trocar tipo de checklist
          </button>
          <CgbHero
            eyebrow={schema.nome}
            title="Identificação"
            description="Informe os dados do motorista antes de iniciar a inspeção FrotaApp."
          />
        </div>

        {/* Resumo do checklist */}
        <div className={`mb-4 overflow-hidden rounded-2xl ${FA_CARD}`}>
          <div className="grid divide-x divide-slate-100 dark:divide-slate-800" style={{ gridTemplateColumns: `repeat(${schema.grupos.length + 1}, 1fr)` }}>
            {schema.grupos.map((g, i) => (
              <div key={g.id} className="flex flex-col items-center px-2 py-3 text-center">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">{g.itens.length}</span>
                <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-tight text-slate-400 dark:text-slate-500">
                  Grupo {i + 1}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center bg-[#7f1022]/[0.08] px-2 py-3 text-center dark:bg-rose-500/10">
              <span className="text-xl font-black text-[#7f1022] dark:text-rose-300">{totalItens}</span>
              <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-tight text-[#7f1022]/60 dark:text-rose-200/70">
                Total
              </span>
            </div>
          </div>
          {/* nomes completos dos grupos */}
          <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
            {schema.grupos.map((g, i) => (
              <p key={g.id} className="text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="font-extrabold text-slate-700 dark:text-slate-300">Grupo {i + 1}:</span> {g.titulo}
              </p>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className={`overflow-hidden rounded-2xl ${FA_CARD}`}>
            {/* Nome */}
            <div className={`border-b px-4 py-3 ${erros.nome ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-900/10' : 'border-slate-100 dark:border-slate-800'}`}>
              <label className={erros.nome ? 'text-[10px] font-extrabold uppercase tracking-widest text-rose-500' : FA_FIELD_LABEL}>
                Nome completo *
              </label>
              <input
                autoFocus={!isDemo}
                autoComplete="name"
                readOnly={isDemo}
                data-demo-field="nome"
                value={nomeValue}
                onChange={(e) => { if (!isDemo) { setNome(e.target.value); setErros((prev) => ({ ...prev, nome: undefined })) } }}
                placeholder="Ex: João Silva"
                className="mt-0.5 w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
              />
              {erros.nome && <p className="mt-1 text-xs font-semibold text-rose-500">{erros.nome}</p>}
            </div>
            {/* Matrícula */}
            <div className={`px-4 py-3 ${erros.matricula ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
              <label className={erros.matricula ? 'text-[10px] font-extrabold uppercase tracking-widest text-rose-500' : FA_FIELD_LABEL}>
                Matrícula *
              </label>
              <input
                value={matriculaValue}
                readOnly={isDemo}
                data-demo-field="matricula"
                onChange={(e) => {
                  if (isDemo) return
                  const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 5)
                  setMatricula(onlyDigits)
                  setErros((prev) => ({ ...prev, matricula: undefined }))
                }}
                placeholder="Ex: 00123"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                className="mt-0.5 w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
              />
              {erros.matricula && <p className="mt-1 text-xs font-semibold text-rose-500">{erros.matricula}</p>}
            </div>
          </div>

          <button
            type="submit"
            data-demo-field="submit"
            className={`w-full rounded-2xl py-4 text-base font-extrabold transition active:scale-[.98] ${FA_PRIMARY_BUTTON} ${
              pulseSubmit ? 'scale-[0.98] ring-2 ring-white/40' : ''
            }`}
          >
            Iniciar Checklist →
          </button>
        </form>
      </div>
    </div>
  )
}

function scrollChecklistViewportToTop() {
  const scroller = document.querySelector('.checklist-phone-scroll, .overscroll-contain') as HTMLElement | null
  if (scroller) scroller.scrollTo({ top: 0, behavior: 'instant' })
  else window.scrollTo({ top: 0, behavior: 'instant' })
}

function checklistPortalRoot(embeddedInFrame?: boolean) {
  if (embeddedInFrame) {
    return document.getElementById('checklist-phone-screen') ?? document.body
  }
  return document.body
}

// ---------------------------------------------------------------------------
// Tela de conclusão com resumo dos NCs
// ---------------------------------------------------------------------------
function TelaConclusao({
  ncImperativos,
  ncCount,
  itensNc,
  offline,
  nomeSupervisor,
  veiculo,
  operador,
  fotosPreview,
  fotosUrls,
  problemas,
  descricaoProblema,
  isDemo,
  autoOpenWhatsapp,
  embeddedInFrame,
}: {
  ncImperativos: number
  ncCount: number
  itensNc: { label: string; imperativo: boolean; obs: string }[]
  offline?: boolean
  nomeSupervisor: string
  veiculo: string
  operador: string
  fotosPreview: string[]
  fotosUrls: string[]
  problemas: string
  descricaoProblema: string
  isDemo?: boolean
  autoOpenWhatsapp?: boolean
  embeddedInFrame?: boolean
}) {
  const { theme } = useTheme()
  const footerTone = theme === 'dark' ? 'on-dark' : 'on-light'
  const bloqueado = ncImperativos > 0
  const comNc = ncCount > 0
  const [demoWhatsappOpen, setDemoWhatsappOpen] = useState(false)

  useEffect(() => {
    scrollChecklistViewportToTop()
  }, [])

  useEffect(() => {
    if (autoOpenWhatsapp) setDemoWhatsappOpen(true)
  }, [autoOpenWhatsapp])

  const whatsappLink = comNc
    ? buildWhatsappLink({
        numero: nomeSupervisor ? (getSupervisorWhatsapp(nomeSupervisor) ?? '') : '',
        nomeSupervisor: nomeSupervisor || 'Supervisor',
        operador,
        veiculo,
        ncCount,
        ncImperativos,
        itensNc,
        fotosUrls,
        problemas,
        descricaoProblema,
      })
    : null

  return (
    <>
    <div
      className={`flex flex-col items-center justify-start bg-slate-50 px-3 dark:bg-slate-950 sm:px-4 ${
        embeddedInFrame ? 'min-h-full overflow-x-hidden py-4 pt-12' : 'min-h-dvh overflow-x-hidden py-10'
      }`}
      style={
        embeddedInFrame
          ? {
              paddingTop: 'max(2rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }
          : undefined
      }
    >
      <div className={`flex w-full max-w-sm flex-col items-center text-center ${embeddedInFrame ? 'gap-3' : 'gap-5'}`}>
        {!embeddedInFrame && (
          <BrandLogo tone={footerTone} variant="horizontal" className="!max-h-9 opacity-90" />
        )}

        {/* Ícone de status */}
        <div className={`grid place-items-center rounded-full ${
          embeddedInFrame ? 'h-16 w-16' : 'h-20 w-20'
        } ${
          bloqueado ? 'bg-rose-100 text-rose-500' :
          comNc     ? 'bg-amber-100 text-amber-500' :
                      'bg-emerald-100 text-emerald-500'
        }`}>
          {bloqueado ? <AlertTriangle size={embeddedInFrame ? 32 : 40} /> : <CheckCircle2 size={embeddedInFrame ? 32 : 40} />}
        </div>

        <div>
          <h1 className={`font-black text-slate-900 dark:text-slate-100 ${embeddedInFrame ? 'text-xl' : 'text-2xl'}`}>
            {offline ? 'Checklist salvo no dispositivo' : bloqueado ? 'Veículo impedido!' : comNc ? 'Checklist enviado' : 'Tudo Conforme!'}
          </h1>
          <p className={`mt-2 font-semibold text-slate-500 dark:text-slate-400 ${embeddedInFrame ? 'text-xs leading-snug' : 'text-sm'}`}>
            {offline
              ? 'Assim que a internet voltar, o aplicativo tentará sincronizar automaticamente.'
              : bloqueado
              ? `${ncImperativos} item(s) impeditivo(s) NC. O veículo está impedido de ser conduzido até a correção.`
              : comNc
                ? `${ncCount} item(s) com NC registrado(s). Avise o supervisor.`
                : 'Todos os itens estão Conformes. Bom trabalho!'}
          </p>
        </div>

        {/* Banner de bloqueio */}
        {bloqueado && (
          <div className={`w-full rounded-2xl border border-rose-200 bg-rose-50 text-left dark:border-rose-900/50 dark:bg-rose-900/20 ${embeddedInFrame ? 'px-3 py-2' : 'px-4 py-3'}`}>
            <p className={`font-extrabold text-rose-600 dark:text-rose-400 ${embeddedInFrame ? 'text-[10px] leading-snug' : 'text-xs'}`}>
              ⚠ VEÍCULO IMPEDIDO — NÃO CONDUZA ATÉ QUE OS ITENS IMPEDITIVOS SEJAM CORRIGIDOS E VERIFICADOS PELO SUPERVISOR.
            </p>
          </div>
        )}

        {/* Alerta WhatsApp para supervisor */}
        {comNc && whatsappLink && (
          <div className={`w-full rounded-2xl border px-4 text-left ${
            embeddedInFrame ? 'py-3' : 'py-4'
          } ${
            bloqueado
              ? 'border-rose-300 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-900/20'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
          }`}>
            <p className={`mb-3 text-xs font-extrabold uppercase tracking-wide ${
              bloqueado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
            }`}>
              {bloqueado ? '🚫 Aviso urgente ao supervisor' : '⚠ Avise o supervisor'}
            </p>
            <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {bloqueado
                ? 'Itens impeditivos foram encontrados. Notifique o supervisor imediatamente antes de qualquer movimentação do veículo.'
                : 'Foram encontrados itens não conformes. Clique abaixo para notificar o supervisor via WhatsApp.'}
            </p>
            {offline && (
              <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                📡 Sem internet — as fotos serão sincronizadas depois. A mensagem de texto pode ser enviada agora normalmente.
              </p>
            )}
            {isDemo ? (
              <button
                type="button"
                data-demo-whatsapp-btn
                onClick={() => setDemoWhatsappOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-rose-200 transition active:scale-95 hover:bg-rose-700 dark:shadow-rose-900/40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Alertar no whatsapp
              </button>
            ) : (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-md transition active:scale-95 ${
                  bloqueado
                    ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-700 dark:shadow-rose-900/40'
                    : 'bg-[#25D366] shadow-green-200 hover:bg-[#1ebe5d] dark:shadow-green-900/40'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Alertar no whatsapp
              </a>
            )}
          </div>
        )}

        {/* Resumo dos itens NC */}
        {itensNc.length > 0 && (
          <div className="w-full space-y-2 text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Itens com NC ({itensNc.length})
            </p>
            {itensNc.map((it, i) => (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2.5 ${
                  it.imperativo
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
                }`}
              >
                <p className={`text-xs font-extrabold ${it.imperativo ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {it.imperativo ? '🚫 ' : '⚠ '}{it.label}
                </p>
                {it.obs && (
                  <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">{it.obs}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fotos registradas */}
        {fotosPreview.length > 0 && (
          <div className="w-full text-left">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Fotos registradas ({fotosPreview.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {fotosPreview.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className={`w-full rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-700 ${embeddedInFrame ? 'h-16' : 'h-24'}`}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs font-semibold text-slate-400">Você já pode fechar esta página.</p>
      </div>
    </div>

    {/* Modal de prévia da mensagem WhatsApp — exclusivo modo demo */}

    {isDemo && demoWhatsappOpen && createPortal(
      <div
        data-demo-whatsapp-modal
        className={`${embeddedInFrame ? 'absolute' : 'fixed'} inset-0 z-[99999] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4`}
        onClick={() => setDemoWhatsappOpen(false)}
      >
        <div
          className="flex max-h-[min(88dvh,100%)] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-[#ECE5DD] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho estilo WhatsApp */}
          <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-extrabold text-white">
              {nomeSupervisor.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-extrabold text-white">{nomeSupervisor}</p>
              <p className="text-[10px] text-white/70">online</p>
            </div>
            <button type="button" onClick={() => setDemoWhatsappOpen(false)} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Balão de mensagem */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 shadow-sm">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">
                {[
                  `🚫 VEICULO IMPEDIDO`,
                  ``,
                  `Olá, ${nomeSupervisor}!`,
                  `O operador *${operador}* acabou de concluir um checklist com *${ncCount} item(s) NC*.`,
                  `Veículo: *${veiculo || 'não informado'}*`,
                  ``,
                  `🚫 *${ncImperativos} item(s) impeditivo(s)* — veículo impedido de operar até correção.`,
                  ``,
                  `*Itens com NC:*`,
                  ...itensNc.map((it) => `${it.imperativo ? '🚫' : '⚠️'} ${it.label}`),
                  ...(problemas ? [``, `📋 *Problemas adicionais:* ${problemas}`] : []),
                  ``,
                  `Por favor, verifique e tome as providencias necessarias.`,
                ].join('\n')}
              </p>
              <p className="mt-1 text-right text-[10px] text-slate-500">agora ✓✓</p>
            </div>
          </div>

          {/* Rodapé estilo WhatsApp */}
          <div className="flex items-center gap-2 border-t border-slate-200 bg-[#F0F0F0] px-4 py-3">
            <div className="flex-1 rounded-full bg-white px-4 py-2 text-sm text-slate-400">
              Mensagem
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#075E54]">
              <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>,
      checklistPortalRoot(embeddedInFrame),
    )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Fotos por item NC
// ---------------------------------------------------------------------------
function FotosItem({
  fotos,
  onAdd,
  onRemove,
}: {
  fotos: File[]
  onAdd: (files: File[]) => void
  onRemove: (idx: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const slots = 3
  const restantes = slots - fotos.length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <ImagePlus size={13} className="text-rose-400" />
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-rose-500">
          Foto do problema
          {fotos.length > 0 ? ` (${fotos.length}/${slots})` : ` — opcional, até ${slots} · máx. 155 KB (ajuste automático)`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {fotos.map((file, idx) => {
          const url = URL.createObjectURL(file)
          return (
            <div
              key={idx}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-slate-200 shadow-sm dark:border-slate-700"
            >
              <img
                src={url}
                alt={`Foto ${idx + 1}`}
                className="h-full w-full object-cover"
                onLoad={() => URL.revokeObjectURL(url)}
                onError={() => URL.revokeObjectURL(url)}
              />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md"
                aria-label="Remover foto"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
        {restantes > 0 && (
          <>
            <input
              ref={ref}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                const input = e.target
                void (async () => {
                  const novos = Array.from(input.files ?? []).slice(0, restantes)
                  if (!novos.length) {
                    input.value = ''
                    return
                  }
                  const processed = await Promise.all(novos.map((f) => compressChecklistImageIfNeeded(f)))
                  onAdd(processed)
                  input.value = ''
                })()
              }}
            />
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/80 text-rose-500 transition active:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400"
            >
              <Camera size={22} />
              <span className="text-[9px] font-extrabold uppercase leading-none tracking-wide">
                {fotos.length === 0 ? 'Tirar foto' : `+${restantes}`}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Autocomplete de supervisor
// ---------------------------------------------------------------------------
const SUPERVISORES = Object.keys(SUPERVISOR_WHATSAPP)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  .map((nome) => ({ label: nome }))

function SupervisorField({ value, onChange, forceOpen }: { value: string; onChange: (v: string) => void; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const reconhecido = value.trim().length > 0 && isSupervisorReconhecido(value)

  // Demo: abre/fecha dropdown conforme sinalização externa
  useEffect(() => {
    if (forceOpen !== undefined) setOpen(forceOpen)
  }, [forceOpen])

  const sugestoes = value.trim().length === 0
    ? SUPERVISORES
    : SUPERVISORES.filter((s) =>
        s.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(
          value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        )
      )

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleScroll = () => setOpen(false)
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open || sugestoes.length === 0) return

    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPortalStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 9999,
    })
  }, [open, sugestoes.length, value])

  return (
    <div ref={cardRef} className={`rounded-2xl ${FA_CARD}`}>
      <div className={`rounded-t-2xl ${FA_SECTION_HEADER}`}>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-white">
          Supervisor Responsável
        </p>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Digite para buscar o supervisor..."
            autoComplete="off"
            data-demo-form-field="supervisor"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {reconhecido && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 size={12} />
              Reconhecido
            </span>
          )}
        </div>

        {reconhecido && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/50 dark:bg-emerald-900/20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
              WhatsApp reconhecido — alerta será enviado automaticamente se houver NC.
            </p>
          </div>
        )}
      </div>

      {/* Portal: renderiza no body para escapar de qualquer overflow/stacking context */}
      {open && sugestoes.length > 0 && createPortal(
        <div
          style={portalStyle}
          className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          {sugestoes.map((s) => (
            <button
              key={s.label}
              type="button"
              data-demo-supervisor-option={s.label}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s.label)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-extrabold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                {s.label.charAt(0)}
              </span>
              {s.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item de checklist — memoizado para evitar re-render ao responder outros itens
// ---------------------------------------------------------------------------
type RespostaVal = 'c' | 'nc' | 'na' | null

const ItemChecklist = memo(function ItemChecklist({
  item,
  numero,
  isLast,
  resp,
  obs,
  fotos,
  destacado,
  fotoFaltando,
  onResposta,
  onObs,
  onAddFoto,
  onRemoveFoto,
  itemRef,
}: {
  item: { id: string; label: string; imperativo?: boolean }
  numero: number
  isLast: boolean
  resp: RespostaVal
  obs: string
  fotos: File[]
  destacado: boolean
  fotoFaltando: boolean
  onResposta: (id: string, valor: RespostaVal) => void
  onObs: (id: string, valor: string) => void
  onAddFoto: (id: string, files: File[]) => void
  onRemoveFoto: (id: string, idx: number) => void
  itemRef: (el: HTMLDivElement | null) => void
}) {
  const bgClass =
    destacado     ? 'bg-rose-50 dark:bg-rose-900/20' :
    resp === 'nc' ? 'bg-rose-50/70 dark:bg-rose-900/15' :
    resp === 'c'  ? 'bg-emerald-50/50 dark:bg-emerald-900/[0.08]' :
    resp === 'na' ? 'bg-slate-50/80 dark:bg-slate-900/20' :
    ''

  return (
    <div
      ref={itemRef}
      className={`px-3 py-2.5 transition-colors duration-300 sm:px-4 sm:py-3 ${!isLast ? 'border-b border-slate-100 dark:border-slate-800/80' : ''} ${bgClass}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {numero}
          </span>
          {item.imperativo && (
            <span className="shrink-0 text-sm leading-tight" title="Item impeditivo — NC impede condução">🚫</span>
          )}
          <span className="break-words text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {item.label}
          </span>
        </div>

        <div className="flex shrink-0 gap-1">
          {([
            { valor: 'c'  as const, label: 'C',  activeClass: 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-200 shadow-sm' },
            { valor: 'nc' as const, label: 'NC', activeClass: 'bg-rose-500 border-rose-500 text-white shadow-rose-200 shadow-sm' },
            { valor: 'na' as const, label: 'NA', activeClass: 'bg-[#7f1022] border-[#7f1022] text-white shadow-sm' },
          ] as const).map(({ valor, label, activeClass }) => (
            <button
              key={valor}
              type="button"
              data-demo-item={valor === 'c' ? item.id : undefined}
              data-demo-item-nc={valor === 'nc' ? item.id : undefined}
              onClick={() => onResposta(item.id, valor)}
              className={`flex h-9 w-11 items-center justify-center rounded-xl border-2 text-[11px] font-extrabold transition-all active:scale-95 ${
                resp === valor
                  ? activeClass
                  : 'border-slate-200 bg-white/70 text-slate-400 hover:border-[#b51649]/40 hover:text-[#7f1022] dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-500 dark:hover:border-rose-400/40 dark:hover:text-rose-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {resp === 'nc' && (
        <div className="mt-3 ml-7 space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-rose-500">
              Descreva o problema *
            </label>
            <textarea
              rows={2}
              data-demo-item-obs={item.id}
              value={obs}
              onChange={(e) => onObs(item.id, e.target.value)}
              placeholder="O que foi encontrado de errado? Seja específico..."
              className="w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-800/60 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:ring-rose-900/30"
            />
          </div>
          {fotoFaltando && (
            <p className="flex items-center gap-1 text-[11px] font-extrabold text-rose-500 dark:text-rose-400">
              📷 Foto obrigatória — anexe ao menos 1 foto
            </p>
          )}
          <FotosItem
            fotos={fotos}
            onAdd={(novos) => onAddFoto(item.id, novos)}
            onRemove={(i) => onRemoveFoto(item.id, i)}
          />
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Formulário principal
// ---------------------------------------------------------------------------
const FORM_SESSION_KEY = 'frota.checklist.form'

function readFormDraft(schemaId: string) {
  try {
    const raw = sessionStorage.getItem(FORM_SESSION_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d?.schemaId !== schemaId) return null
    return d as {
      schemaId: string
      respostas: Record<string, Resposta>
      observacoes: Record<string, string>
      dadosVeiculo: Record<string, string>
      dataInspecao: string
      supervisor: string
      problemas: string
      descricaoProblema: string
      localidadeCoords: { lat: number; lng: number } | null
    }
  } catch { return null }
}

function saveFormDraft(schemaId: string, data: {
  respostas: Record<string, Resposta>
  observacoes: Record<string, string>
  dadosVeiculo: Record<string, string>
  dataInspecao: string
  supervisor: string
  problemas: string
  descricaoProblema: string
  localidadeCoords: { lat: number; lng: number } | null
}) {
  try { sessionStorage.setItem(FORM_SESSION_KEY, JSON.stringify({ schemaId, ...data })) }
  catch { /* storage cheio */ }
}

function clearFormDraft() {
  try { sessionStorage.removeItem(FORM_SESSION_KEY) }
  catch { /* sem acesso */ }
}

function FormularioChecklist({
  schema,
  operador,
  matricula,
  onConcluido,
  onVoltar,
  demoMode,
  onCursorTarget,
  hideSync,
  embeddedInFrame,
}: {
  schema: ChecklistSchemaDef
  operador: string
  matricula: string
  onConcluido?: () => void
  onVoltar?: () => void
  demoMode?: { enabled: boolean; speedFactor: number }
  onCursorTarget?: (t: import('../components/checklist/DemoCursor').DemoCursorTarget | null) => void
  hideSync?: boolean
  embeddedInFrame?: boolean
}) {
  // No modo demo limita os itens visíveis para manter o vídeo ágil
  const DEMO_MAX_ITENS = demoMode?.enabled ? 10 : Infinity
  const gruposDemo = demoMode?.enabled
    ? (() => {
        let restante = DEMO_MAX_ITENS
        return schema.grupos.map((g) => {
          if (restante <= 0) return { ...g, itens: [] }
          const itens = g.itens.slice(0, restante)
          restante -= itens.length
          return { ...g, itens }
        }).filter((g) => g.itens.length > 0)
      })()
    : schema.grupos

  const todosItens = gruposDemo.flatMap((g) => g.itens)
  const totalItens = todosItens.length

  // Mapeamento checklist → tipo de veículo no registro
  const TIPO_MAP: Record<string, string[]> = {
    'sky':          ['SKY'],
    'munck':        ['MUNCK'],
    'picape-leve':  ['PICAPE LEVE'],
    'picape-4x4':   ['PICAPE 4X4'],
    'motocicleta':  ['MOTO'],
    'veiculo-leve': ['VEICULOS LEVES'],
    'empilhadeira': [],
  }

  // Opções dinâmicas vindas do registro de veículos
  const opcoesVeiculo = useMemo(() => {
    const todos = getDisplayedFleetVehicles().filter((v) => v.status === 'ATIVO')
    const tipos = TIPO_MAP[schema.id] ?? []
    const filtrados = tipos.length > 0 ? todos.filter((v) => tipos.includes(v.tipo)) : todos
    return {
      placa:       [...new Set(filtrados.map((v) => formatPlaca(v.placa)).filter(Boolean))].sort(),
      marca_modelo:[...new Set(filtrados.map((v) => v.modelo).filter(Boolean))].sort(),
      prefixo:     [...new Set(filtrados.map((v) => v.prefixo).filter((p) => p && p !== 'N/A'))].sort(),
    }
  }, [schema.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const draft = demoMode?.enabled ? null : readFormDraft(schema.id)

  const [respostas, setRespostas]         = useState<Record<string, Resposta>>(draft?.respostas ?? {})
  const [observacoes, setObservacoes]     = useState<Record<string, string>>(draft?.observacoes ?? {})
  const [fotosItem, setFotosItem]         = useState<Record<string, File[]>>({})
  const [dadosVeiculo, setDadosVeiculo]   = useState<Record<string, string>>(draft?.dadosVeiculo ?? {})
  const [localidadeGeoLoading, setLocalidadeGeoLoading] = useState(false)
  const [localidadeGeoErro, setLocalidadeGeoErro] = useState('')
  const [localidadeCoords, setLocalidadeCoords] = useState<{ lat: number; lng: number } | null>(draft?.localidadeCoords ?? null)
  const [localidadeAccuracy, setLocalidadeAccuracy] = useState<number | null>(null)
  const [gpsPermissao, setGpsPermissao] = useState<'prompt' | 'granted' | 'denied' | 'checking'>(
    demoMode?.enabled ? 'granted' : 'checking'
  )
  const [gpsGuiaAberto, setGpsGuiaAberto] = useState(false)
  const [gpsErroCodigo, setGpsErroCodigo] = useState<1 | 2 | 3 | null>(null)
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState<boolean | undefined>(undefined)
  const [dataInspecao] = useState(draft?.dataInspecao ?? new Date().toISOString().split('T')[0] ?? '')
  const [problemas, setProblemas]         = useState(draft?.problemas ?? '')
  const [descricaoProblema, setDescricaoProblema] = useState(draft?.descricaoProblema ?? '')
  const [supervisor, setSupervisor]       = useState(draft?.supervisor ?? '')
  const [arquivos, setArquivos]           = useState<File[]>([])
  const [enviando, setEnviando]           = useState(false)
  const [erroEnvio, setErroEnvio]         = useState('')
  const [concluido, setConcluido]         = useState(false)
  const [demoAutoWhatsapp, setDemoAutoWhatsapp] = useState(false)
  const demoRan = useRef(false)
  const demoActiveRef = useRef(false) // true enquanto o async demo está rodando — NÃO resetado pelo cleanup
  const [resultadoFinal, setResultadoFinal] = useState<{
    ncCount: number
    ncImperativos: number
    itensNc: { label: string; imperativo: boolean; obs: string }[]
    offline?: boolean
    nomeSupervisor: string
    veiculo: string
    fotosPreview: string[]
    fotosUrls: string[]
    problemas: string
    descricaoProblema: string
  } | null>(null)
  // highlight do item atual após scroll
  const [itemDestacado, setItemDestacado] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [fleetTick, setFleetTick] = useState(0)
  const [placaSuggestOpen, setPlacaSuggestOpen] = useState(false)
  const [placaHighlightIdx, setPlacaHighlightIdx] = useState(0)

  // Mapa de placa → veículo (precisa estar antes do efeito demo)
  const fleetByPlaca = useMemo(() => {
    void fleetTick
    const map = new Map<string, ReturnType<typeof getDisplayedFleetVehicles>[number]>()
    for (const v of getDisplayedFleetVehicles()) {
      map.set(normalizePlaca(v.placa), v)
    }
    return map
  }, [fleetTick])

  // Refs estáveis para o player do demo — evita que re-renders do pai cancelem
  // o preenchimento automático em andamento. Effect usa deps [] e lê tudo via refs.
  const fleetByPlacaRef = useRef(fleetByPlaca)
  fleetByPlacaRef.current = fleetByPlaca
  const onConcluidoRef = useRef(onConcluido)
  onConcluidoRef.current = onConcluido
  const onCursorTargetRef = useRef(onCursorTarget)
  onCursorTargetRef.current = onCursorTarget
  const demoSpeedRef = useRef(demoMode?.speedFactor ?? 1)
  demoSpeedRef.current = demoMode?.speedFactor ?? 1
  const demoEnabledRef = useRef(demoMode?.enabled ?? false)
  demoEnabledRef.current = demoMode?.enabled ?? false
  const schemaIdRef = useRef(schema.id)
  schemaIdRef.current = schema.id
  const schemaCamposRef = useRef(schema.camposExtras)
  schemaCamposRef.current = schema.camposExtras
  const todosItensRef = useRef(todosItens)
  todosItensRef.current = todosItens

  // Auto-save com debounce de 600ms para não salvar a cada keystroke
  useEffect(() => {
    if (concluido) return
    const t = setTimeout(() => {
      saveFormDraft(schema.id, {
        respostas, observacoes, dadosVeiculo,
        dataInspecao, supervisor, problemas, descricaoProblema, localidadeCoords,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [schema.id, respostas, observacoes, dadosVeiculo, dataInspecao, supervisor, problemas, descricaoProblema, localidadeCoords, concluido])

  // Verifica permissão de GPS ao carregar e monitora mudanças
  useEffect(() => {
    if (demoMode?.enabled) {
      setGpsPermissao('granted')
      return
    }
    if (!navigator.geolocation) {
      setGpsPermissao('granted') // sem geolocation, não bloqueia — campo manual disponível
      return
    }
    if (!navigator.permissions) {
      setGpsPermissao('prompt') // API não disponível, trata como não decidido
      return
    }
    let permStatus: PermissionStatus | null = null
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      permStatus = status
      setGpsPermissao(status.state as 'prompt' | 'granted' | 'denied')
      status.onchange = () => {
        setGpsPermissao(status.state as 'prompt' | 'granted' | 'denied')
        // Se acabou de ser concedida, limpa o erro
        if (status.state === 'granted') setLocalidadeGeoErro('')
      }
    }).catch(() => setGpsPermissao('prompt'))
    return () => {
      if (permStatus) permStatus.onchange = null
    }
  }, [demoMode?.enabled])

  // Demo: preenchimento automático para gravação de vídeo.
  // Deps [] — roda uma única vez por mount. Tudo lido via refs para não ser
  // cancelado por re-renders do componente pai.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!demoEnabledRef.current || demoRan.current) return
    demoRan.current = true

    // Reseta o cursor do phase anterior (identify) antes de começar o formulário
    onCursorTargetRef.current?.(null)

    const schemaId = schemaIdRef.current
    const profile = resolveDemoProfile(schemaId)
    const vehicleFields = resolveDemoVehicleFields(schemaId)
    const speed = demoSpeedRef.current

    // demoActiveRef.current = true enquanto o async roda.
    // Nunca é resetado pelo cleanup — só pelo restart (demoKey muda → novo mount).
    demoActiveRef.current = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, demoDelay(ms, speed)))
      })

    // Tempo para o cursor percorrer a animação CSS (450ms) + margem
    const CURSOR_TRAVEL = 520

    const scrollTo = (selector: string) => {
      onCursorTargetRef.current?.(null)
      const scroller = document.querySelector('.checklist-phone-scroll, .overscroll-contain') as HTMLElement | null
      const root = scroller ?? document.body
      const el = root.querySelector(selector) as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const waitForSelector = async (selector: string, maxMs = 4000) => {
      const started = Date.now()
      while (Date.now() - started < maxMs) {
        if (!demoActiveRef.current) return false
        if (document.querySelector(selector)) return true
        await wait(80)
      }
      return false
    }

    // Campos de texto: cursor move → aguarda chegada → digita caractere a caractere
    const typeField = async (fieldId: string, value: string, setter?: (v: string) => void) => {
      scrollTo(`[data-demo-form-field="${fieldId}"]`)
      await wait(DEMO_TIMING.itemScroll)
      onCursorTargetRef.current?.({ selector: `[data-demo-form-field="${fieldId}"]`, tap: true, key: `field-${fieldId}` })
      await wait(CURSOR_TRAVEL) // espera o cursor chegar antes de começar
      for (let i = 1; i <= value.length; i++) {
        if (!demoActiveRef.current) return
        if (setter) setter(value.slice(0, i))
        else setDadosVeiculo((prev) => ({ ...prev, [fieldId]: value.slice(0, i) }))
        await wait(DEMO_TIMING.fieldChar)
      }
      await wait(DEMO_TIMING.fieldPause)
    }

    // Campos select: cursor move → aguarda chegada → preenche de uma vez
    const fillSelect = async (fieldId: string, value: string) => {
      if (!demoActiveRef.current) return
      scrollTo(`[data-demo-form-field="${fieldId}"]`)
      await wait(DEMO_TIMING.itemScroll)
      onCursorTargetRef.current?.({ selector: `[data-demo-form-field="${fieldId}"]`, tap: true, key: `field-${fieldId}` })
      await wait(CURSOR_TRAVEL) // espera o cursor chegar antes de preencher
      if (!demoActiveRef.current) return
      setDadosVeiculo((prev) => ({ ...prev, [fieldId]: value }))
      await wait(DEMO_TIMING.fieldPause)
    }

    void (async () => {
      // Aguarda React terminar os remounts da transição identify→form (pode levar ~1s)
      await wait(Math.max(DEMO_TIMING.formStart, 1500))

      await narrateDemoStep('dados-veiculo')
      if (!demoActiveRef.current) return

      // Placa: cursor + preenche placa + marca_modelo juntos
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.({ selector: '[data-demo-form-field="placa"]', tap: true, key: 'field-placa' })
      await wait(CURSOR_TRAVEL) // espera cursor chegar antes de preencher
      if (!demoActiveRef.current) return
      const placaNorm = normalizePlaca(vehicleFields.placa)
      // Lê fleetByPlaca DEPOIS do delay para garantir que está populado
      const matchedVehicle = fleetByPlacaRef.current.get(placaNorm)
      setDadosVeiculo((p) => ({
        ...p,
        placa: placaNorm,
        marca_modelo: matchedVehicle ? matchedVehicle.modelo : vehicleFields.marca_modelo,
      }))
      await wait(DEMO_TIMING.fieldPause * 2)

      // Demais campos na ordem do schema, pulando placa e marca_modelo (já preenchidos)
      const campos = schemaCamposRef.current ?? []
      for (const campo of campos) {
        if (!demoActiveRef.current) return
        if (campo.id === 'placa' || campo.id === 'marca_modelo') continue

        if (campo.id === 'localidade') {
          // Demonstração: clicar no GPS → loading fake → apagar → digitar manualmente
          onCursorTargetRef.current?.({ selector: '[data-demo-form-field="gps-btn"]', tap: true, key: 'field-gps-btn' })
          await wait(CURSOR_TRAVEL)
          if (!demoActiveRef.current) return
          // Simula loading do GPS
          setLocalidadeGeoLoading(true)
          setDadosVeiculo((p) => ({ ...p, localidade: '' }))
          await wait(1800) // tempo de "buscando GPS..."
          if (!demoActiveRef.current) return
          // GPS "retorna" coordenadas
          setLocalidadeGeoLoading(false)
          setDadosVeiculo((p) => ({ ...p, localidade: '-4.523, -44.301' }))
          await wait(1200)
          if (!demoActiveRef.current) return
          // Apaga e digita manualmente para mostrar que também funciona assim
          setDadosVeiculo((p) => ({ ...p, localidade: '' }))
          await wait(400)
          await typeField('localidade', profile.localidade)
          continue
        }

        const value = (vehicleFields as Record<string, string>)[campo.id] ?? ''
        if (!value) continue
        if (campo.tipo === 'select') {
          await fillSelect(campo.id, value)
        } else {
          await typeField(campo.id, value)
        }
      }

      // Supervisor: rola até o campo → cursor → digita → seleciona sugestão
      if (!demoActiveRef.current) return
      await narrateDemoStep('supervisor')
      if (!demoActiveRef.current) return
      scrollTo('[data-demo-form-field="supervisor"]')
      await wait(DEMO_TIMING.itemScroll)
      if (!demoActiveRef.current) return
      await wait(DEMO_TIMING.supervisorPause)
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.({ selector: '[data-demo-form-field="supervisor"]', tap: true, key: 'field-supervisor' })
      await wait(CURSOR_TRAVEL)
      if (!demoActiveRef.current) return
      // Digita "Italo" letra a letra — abre dropdown forçado para o demo ver as sugestões
      const supervisorQuery = 'Italo'
      setSupervisorDropdownOpen(true)
      for (let i = 1; i <= supervisorQuery.length; i++) {
        if (!demoActiveRef.current) return
        setSupervisor(supervisorQuery.slice(0, i))
        await wait(DEMO_TIMING.identifyChar * 1.5)
      }
      // Aguarda o portal renderizar com a sugestão filtrada (campo visível na tela)
      await wait(DEMO_TIMING.itemScroll)
      if (!demoActiveRef.current) return
      // Cursor vai até a sugestão no dropdown (portal no body)
      const NOME_COMPLETO = 'ITALO BRUNO DA SILVA FONTES'
      onCursorTargetRef.current?.({ selector: `[data-demo-supervisor-option="${NOME_COMPLETO}"]`, tap: true, key: 'supervisor-option' })
      await wait(CURSOR_TRAVEL)
      if (!demoActiveRef.current) return
      // "Clica" na sugestão — fecha dropdown
      setSupervisor(NOME_COMPLETO)
      setSupervisorDropdownOpen(false)
      await wait(DEMO_TIMING.fieldPause)

      // Demo: limita a 10 itens para manter o vídeo ágil.
      // O 2º item (índice 1) recebe NC imperativo + foto fake.
      const DEMO_MAX_ITENS = 10
      const DEMO_NC_INDEX = 1   // sky-02 (Pneus) — imperativo
      const demoItens = todosItensRef.current.slice(0, DEMO_MAX_ITENS)

      // Gera um File de imagem colorida via canvas (sem precisar de arquivo real)
      const makeFakeImage = (label: string, color: string): File => {
        const canvas = document.createElement('canvas')
        canvas.width = 400; canvas.height = 300
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 400, 300)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 22px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, 200, 155)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const bytes = atob(dataUrl.split(',')[1]!)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        return new File([arr], `${label.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' })
      }

      let demoNcItem: (typeof demoItens)[number] | null = null

      await narrateDemoStep('itens-intro')
      if (!demoActiveRef.current) return

      for (let idx = 0; idx < demoItens.length; idx++) {
        const item = demoItens[idx]!
        if (!demoActiveRef.current) return
        onCursorTargetRef.current?.(null)
        itemRefs.current[item.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setItemDestacado(item.id)
        await wait(DEMO_TIMING.itemScroll)
        if (!demoActiveRef.current) return

        if (idx === DEMO_NC_INDEX) {
          // Item NC imperativo: cursor no botão NC → espera chegar → marca NC
          await narrateDemoStep('item-nc-imperativo')
          if (!demoActiveRef.current) return
          demoNcItem = item
          onCursorTargetRef.current?.({ selector: `[data-demo-item-nc="${item.id}"]`, tap: true, key: `nc-${item.id}` })
          await wait(CURSOR_TRAVEL)
          if (!demoActiveRef.current) return
          setRespostas((prev) => ({ ...prev, [item.id]: 'nc' }))
          await wait(DEMO_TIMING.itemAnswer)
          // Observação obrigatória: cursor na textarea → digita descrição
          onCursorTargetRef.current?.({ selector: `[data-demo-item-obs="${item.id}"]`, tap: true, key: `obs-${item.id}` })
          await wait(CURSOR_TRAVEL)
          if (!demoActiveRef.current) return
          const obsText = 'Sulcos abaixo do mínimo legal, risco de aquaplanagem'
          for (let i = 1; i <= obsText.length; i++) {
            if (!demoActiveRef.current) return
            setObservacoes((prev) => ({ ...prev, [item.id]: obsText.slice(0, i) }))
            await wait(DEMO_TIMING.fieldChar)
          }
          await wait(DEMO_TIMING.fieldPause)
          if (!demoActiveRef.current) return
          // Foto fake no item NC
          const fakeItemFoto = makeFakeImage('Pneu danificado', '#7f1022')
          setFotosItem((prev) => ({ ...prev, [item.id]: [fakeItemFoto] }))
          await wait(DEMO_TIMING.fieldPause)
        } else {
          // Item conforme: cursor no botão C → espera chegar → marca C
          onCursorTargetRef.current?.({ selector: `[data-demo-item="${item.id}"]`, tap: true, key: item.id })
          await wait(CURSOR_TRAVEL)
          if (!demoActiveRef.current) return
          setRespostas((prev) => ({ ...prev, [item.id]: 'c' }))
          await wait(DEMO_TIMING.itemAnswer)
        }
        setItemDestacado(null)
      }
      onCursorTargetRef.current?.(null)

      // Problemas adicionais (scroll + cursor + digitação)
      if (!demoActiveRef.current) return
      await narrateDemoStep('problemas')
      if (!demoActiveRef.current) return
      scrollTo('[data-demo-form-field="problemas"]')
      await wait(DEMO_TIMING.itemScroll)
      await typeField('problemas', 'Pneu dianteiro esquerdo com desgaste irregular', setProblemas)
      if (!demoActiveRef.current) return

      // NR12: scroll até o botão → cursor → arquivo aparece
      await narrateDemoStep('evidencia-nr12')
      if (!demoActiveRef.current) return
      scrollTo('[data-demo-form-field="nr12"]')
      await wait(DEMO_TIMING.itemScroll)
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.({ selector: '[data-demo-form-field="nr12"]', tap: true, key: 'field-nr12' })
      await wait(CURSOR_TRAVEL)
      if (!demoActiveRef.current) return
      const fakeNr12 = makeFakeImage('Evidência NR-12', '#1e3a5f')
      setArquivos([fakeNr12])
      await wait(DEMO_TIMING.fieldPause * 2)

      // Botão Enviar: scroll até ele → cursor → clique → loading
      if (!demoActiveRef.current) return
      await narrateDemoStep('enviar')
      if (!demoActiveRef.current) return
      scrollTo('[data-demo-form-field="enviar"]')
      await wait(DEMO_TIMING.itemScroll)
      onCursorTargetRef.current?.({ selector: '[data-demo-form-field="enviar"]', tap: true, key: 'field-enviar' })
      await wait(CURSOR_TRAVEL)
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.(null)
      await wait(DEMO_TIMING.beforeSubmit)
      if (!demoActiveRef.current) return
      setEnviando(true)
      await wait(DEMO_TIMING.submitting)
      if (!demoActiveRef.current) return

      const ncItemLabel = demoNcItem ? (demoNcItem.label ?? demoNcItem.id) : 'Pneus'
      const fakePreview = URL.createObjectURL(makeFakeImage('Pneu danificado', '#7f1022'))
      setResultadoFinal({
        ncCount: 1,
        ncImperativos: 1,
        itensNc: [{ label: ncItemLabel, imperativo: true, obs: 'Sulcos abaixo do mínimo legal, risco de aquaplanagem' }],
        offline: false,
        nomeSupervisor: profile.supervisor,
        veiculo: formatPlaca(vehicleFields.placa),
        fotosPreview: [fakePreview],
        fotosUrls: [],
        problemas: 'Pneu dianteiro esquerdo com desgaste irregular',
        descricaoProblema: '',
      })
      clearFormDraft()
      setConcluido(true)
      setEnviando(false)

      // Tela final → abre WhatsApp → narração → só então marca demo concluído (evita loop cortar)
      await wait(DEMO_TIMING.conclusionScreen)
      if (!demoActiveRef.current) return
      scrollChecklistViewportToTop()
      await wait(DEMO_TIMING.itemScroll)
      if (!demoActiveRef.current) return

      await waitForSelector('[data-demo-whatsapp-btn]')
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.({ selector: '[data-demo-whatsapp-btn]', tap: true, key: 'whatsapp-btn' })
      await wait(CURSOR_TRAVEL)
      if (!demoActiveRef.current) return
      onCursorTargetRef.current?.(null)
      setDemoAutoWhatsapp(true)

      await wait(DEMO_TIMING.conclusionWhatsappOpen)
      if (!demoActiveRef.current) return
      await waitForSelector('[data-demo-whatsapp-modal]')
      if (!demoActiveRef.current) return

      await narrateDemoStep('conclusao-whatsapp')
      if (!demoActiveRef.current) return
      await wait(DEMO_TIMING.conclusionWhatsappHold)
      if (!demoActiveRef.current) return

      onConcluidoRef.current?.()
      await finishDemoNarration()
    })()

    return () => {
      // Para o async em andamento e permite que o próximo mount (StrictMode
      // ou restart via demoKey) inicie um novo ciclo limpo.
      demoActiveRef.current = false
      demoRan.current = false
      timers.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    const bump = () => setFleetTick((t) => t + 1)
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'frota.vehicles.registry' ||
        e.key === 'frota.vehicles.statusByPlaca' ||
        e.key === 'frota.vehicles.manutencaoByPlaca' ||
        e.key === null
      ) {
        bump()
      }
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', bump)
      scrollTimers.current.forEach(clearTimeout)
      scrollTimers.current = []
    }
  }, [])

  const placasOrdenadas = useMemo(
    () => [...fleetByPlaca.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [fleetByPlaca],
  )

  const placasSugeridas = useMemo(() => {
    const q = normalizePlaca(dadosVeiculo.placa ?? '')
    const limite = 20
    if (!q) return placasOrdenadas.slice(0, limite)
    const matches = placasOrdenadas.filter((p) => p.includes(q))
    return matches.slice(0, limite)
  }, [placasOrdenadas, dadosVeiculo.placa])

  const placaHighlightSafe =
    placasSugeridas.length === 0 ? 0 : Math.min(placaHighlightIdx, placasSugeridas.length - 1)

  const selecionarPlacaSugestao = useCallback(
    (placaEscolhida: string) => {
      const raw = normalizePlaca(placaEscolhida)
      const v = fleetByPlaca.get(raw)
      setDadosVeiculo((p) => ({
        ...p,
        placa: raw,
        marca_modelo: v ? v.modelo : '',
      }))
      setPlacaSuggestOpen(false)
    },
    [fleetByPlaca, setDadosVeiculo, setPlacaSuggestOpen],
  )

  const onPlacaChange = useCallback(
    (rawInput: string) => {
      const raw = normalizePlaca(rawInput)
      const v = fleetByPlaca.get(raw)
      setDadosVeiculo((p) => ({
        ...p,
        placa: raw,
        ...(v ? { marca_modelo: v.modelo } : !raw ? { marca_modelo: '' } : {}),
      }))
    },
    [fleetByPlaca, setDadosVeiculo],
  )

  const onPlacaBlur = useCallback(() => {
    setDadosVeiculo((p) => {
      const raw = normalizePlaca(p.placa ?? '')
      const v = fleetByPlaca.get(raw)
      return { ...p, placa: raw, marca_modelo: v ? v.modelo : '' }
    })
  }, [fleetByPlaca, setDadosVeiculo])

  const { respondidos, ncCount, ncImperativos, progresso, tudo100 } = useMemo(() => {
    const vals = Object.values(respostas)
    const respondidos   = vals.filter((v) => v !== null).length
    const ncCount       = vals.filter((v) => v === 'nc').length
    const ncImperativos = todosItens.filter((it) => it.imperativo && respostas[it.id] === 'nc').length
    const progresso     = totalItens > 0 ? Math.round((respondidos / totalItens) * 100) : 0
    return { respondidos, ncCount, ncImperativos, progresso, tudo100: progresso === 100 }
  }, [respostas, todosItens, totalItens])

  const camposPreenchidos = useMemo(
    () => (schema.camposExtras?.filter((c) => c.obrigatorio) ?? []).every((c) => (dadosVeiculo[c.id] ?? '').trim() !== ''),
    [schema.camposExtras, dadosVeiculo],
  )
  const evidenciaNr12Ok = !schema.temEvidencia || arquivos.length > 0

  // itens com NC que ainda não têm nenhuma foto anexada
  const itensNcSemFoto = useMemo(
    () => todosItens.filter((it) => respostas[it.id] === 'nc' && (fotosItem[it.id] ?? []).length === 0),
    [todosItens, respostas, fotosItem],
  )
  const fotosNcOk = itensNcSemFoto.length === 0

  const podEnviar = tudo100 && camposPreenchidos && evidenciaNr12Ok && fotosNcOk
  const mostrarBarraEnvio = tudo100 || enviando

  // Mapa: itemId → número sequencial global (calculado uma vez)
  const numeroItemMap = useMemo(() => {
    const map: Record<string, number> = {}
    let n = 0
    for (const grupo of schema.grupos) {
      for (const item of grupo.itens) {
        map[item.id] = ++n
      }
    }
    return map
  }, [schema.grupos])

  const setResposta = useCallback((id: string, valor: Resposta) => {
    setRespostas((prev) => {
      const nova = prev[id] === valor ? null : valor
      if (nova !== 'nc') {
        setFotosItem((fp) => { const cp = { ...fp }; delete cp[id]; return cp })
      }
      return { ...prev, [id]: nova }
    })

    // Scroll com highlight para o próximo item sem resposta
    const t1 = setTimeout(() => {
      setRespostas((current) => {
        const novas = { ...current, [id]: current[id] === valor ? null : valor }
        const proximoId = todosItens.find((it) => novas[it.id] == null)?.id
        if (proximoId && itemRefs.current[proximoId]) {
          itemRefs.current[proximoId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setItemDestacado(proximoId)
          const t2 = setTimeout(() => setItemDestacado(null), 1200)
          scrollTimers.current.push(t2)
        }
        return current // não alterar state aqui, só lemos
      })
    }, 150)
    scrollTimers.current.push(t1)
  }, [todosItens, setFotosItem, setItemDestacado, setRespostas])

  const setDado = (id: string, valor: string) => {
    setDadosVeiculo((prev) => {
      const next = { ...prev, [id]: valor }
      // Ao escolher uma placa, preenche modelo e prefixo automaticamente
      if (id === 'placa' && valor) {
        const normalizada = normalizePlaca(valor)
        const veiculo = getDisplayedFleetVehicles().find((v) => v.placa === normalizada)
        if (veiculo) {
          if (veiculo.modelo) next['marca_modelo'] = veiculo.modelo
          if (veiculo.prefixo && veiculo.prefixo !== 'N/A') next['prefixo'] = veiculo.prefixo
        }
      }
      return next
    })
  }

  const pedirLocalizacao = useCallback(() => {
    setLocalidadeGeoErro('')
    setGpsErroCodigo(null)
    setGpsGuiaAberto(false)
    if (!navigator.geolocation) {
      setLocalidadeGeoErro('Geolocalização não disponível neste navegador.')
      return
    }
    setLocalidadeGeoLoading(true)

    // Usa watchPosition para aguardar a leitura mais precisa (GPS real, não IP/Wi-Fi)
    // Aceita a posição somente quando accuracy <= 50m ou após 10s (o que vier primeiro)
    const ACCURACY_TARGET = 50   // metros
    const MAX_WAIT_MS     = 10_000
    const watchState = { id: 0 }
    let settled = false

    const finish = async (lat: number, lng: number, accuracy: number) => {
      if (settled) return
      settled = true
      navigator.geolocation.clearWatch(watchState.id)
      setLocalidadeCoords({ lat, lng })
      setLocalidadeAccuracy(Math.round(accuracy))

      const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`

      // Tenta geocoding reverso apenas se online
      if (!navigator.onLine) {
        setDadosVeiculo((p) => ({ ...p, localidade: coordsStr }))
        setLocalidadeGeoLoading(false)
        return
      }

      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
          { headers: { 'User-Agent': 'FrotaWeb/1.0' }, signal: AbortSignal.timeout(8_000) },
        )
        if (resp.ok) {
          const data = await resp.json() as { address?: Record<string, string> }
          const a = data.address ?? {}
          const rua = a.road ?? a.pedestrian ?? a.footway ?? ''
          const bairro = a.neighbourhood ?? a.city_district ?? a.quarter ?? ''
          const cidade = a.city ?? a.town ?? a.village ?? a.municipality ?? ''
          const partes = [rua, bairro, cidade].filter(Boolean)
          const uniq = partes.filter((v, i, arr) => arr.indexOf(v) === i)
          setDadosVeiculo((p) => ({ ...p, localidade: uniq.join(', ') || coordsStr }))
        } else {
          setDadosVeiculo((p) => ({ ...p, localidade: coordsStr }))
        }
      } catch {
        // Sem internet ou timeout — salva coordenadas brutas
        setDadosVeiculo((p) => ({ ...p, localidade: coordsStr }))
      }
      setLocalidadeGeoLoading(false)
    }

    // Fallback: usa a melhor posição obtida até aqui após MAX_WAIT_MS
    let bestPos: GeolocationPosition | null = null
    const fallbackTimer = setTimeout(() => {
      if (!settled && bestPos) void finish(bestPos.coords.latitude, bestPos.coords.longitude, bestPos.coords.accuracy)
      else if (!settled) {
        settled = true
        navigator.geolocation.clearWatch(watchState.id)
        setLocalidadeGeoLoading(false)
        setLocalidadeGeoErro('Tempo esgotado. Tente novamente em área aberta.')
      }
    }, MAX_WAIT_MS)

    watchState.id = navigator.geolocation.watchPosition(
      (pos) => {
        bestPos = pos
        if (pos.coords.accuracy <= ACCURACY_TARGET) {
          clearTimeout(fallbackTimer)
          void finish(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        }
      },
      (err) => {
        clearTimeout(fallbackTimer)
        if (settled) return
        settled = true
        navigator.geolocation.clearWatch(watchState.id)
        setLocalidadeGeoLoading(false)
        setGpsErroCodigo(err.code as 1 | 2 | 3)
        setGpsGuiaAberto(true)
        if (err.code === 1) setGpsPermissao('denied')
        const msg =
          err.code === 1 ? 'GPS bloqueado — ou digite o endereço manualmente.'
          : err.code === 2 ? 'GPS desligado — ou digite o endereço manualmente.'
          : 'Sem sinal de GPS — ou digite o endereço manualmente.'
        setLocalidadeGeoErro(msg)
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )
  }, [setDadosVeiculo, setLocalidadeCoords, setLocalidadeGeoErro, setLocalidadeGeoLoading])

  const addFotoItem = useCallback((id: string, novos: File[]) =>
    setFotosItem((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), ...novos].slice(0, 3) }))
  , [])

  const removeFotoItemCb = useCallback((id: string, idx: number) =>
    setFotosItem((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((_, i) => i !== idx) }))
  , [])

  const setObservacaoCb = useCallback((id: string, valor: string) =>
    setObservacoes((prev) => ({ ...prev, [id]: valor }))
  , [])


  const handleArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const room = Math.max(0, 10 - arquivos.length)
    const novos = Array.from(input.files ?? []).slice(0, room)
    input.value = ''
    if (!novos.length) return
    void (async () => {
      const processed = await Promise.all(
        novos.map((f) =>
          f.type.startsWith('image/') && f.type !== 'image/svg+xml'
            ? compressChecklistImageIfNeeded(f)
            : Promise.resolve(f),
        ),
      )
      setArquivos((prev) => [...prev, ...processed].slice(0, 10))
    })()
  }

  const removerArquivo = (idx: number) =>
    setArquivos((prev) => prev.filter((_, i) => i !== idx))

  const uploadFile = async (file: File, path: string): Promise<string | null> =>
    uploadChecklistEvidenceFile(file, path)

  const buildChecklistPayload = (observacoesFinais: Record<string, string>, evidenciaUrls: string[]) => {
    const respostasLimpas = Object.fromEntries(
      Object.entries(respostas).filter((e): e is [string, 'c' | 'nc' | 'na'] => e[1] !== null),
    )

    return {
      tipo: schema.id,
      nome_operador: operador,
      matricula,
      dados_veiculo: { ...dadosVeiculo, data_inspecao: dataInspecao },
      data_inspecao: dataInspecao,
      respostas: respostasLimpas,
      observacoes: observacoesFinais,
      progresso: 100,
      nc_count: ncCount,
      nc_imperativos: ncImperativos,
      problemas,
      descricao_problema: descricaoProblema,
      nome_supervisor: supervisor,
      evidencia_urls: evidenciaUrls,
    }
  }

  const buildOfflineFiles = (): OfflineChecklistFile[] => {
    const gerais = arquivos.map((file) => ({
      name: file.name,
      type: file.type,
      itemId: null,
      file,
    }))
    const porItem = Object.entries(fotosItem).flatMap(([itemId, fotos]) =>
      fotos.map((file) => ({
        name: file.name,
        type: file.type,
        itemId,
        file,
      })),
    )
    return [...gerais, ...porItem]
  }

  const handleEnviar = async () => {
    if (!podEnviar) return
    if (demoMode?.enabled) return
    setEnviando(true)
    setErroEnvio('')

    try {
      if (!navigator.onLine) {
        try {
          await enqueueChecklist(buildChecklistPayload({ ...observacoes }, []), buildOfflineFiles())
        } catch {
          setErroEnvio('Sem internet e não foi possível salvar offline. Verifique o armazenamento do dispositivo.')
          setEnviando(false)
          return
        }
        const itensNc = todosItens
          .filter((it) => respostas[it.id] === 'nc')
          .map((it) => ({ label: it.label, imperativo: !!it.imperativo, obs: observacoes[it.id] ?? '' }))
        const fotosPreviewOffline = Object.values(fotosItem).flat().map((f) => URL.createObjectURL(f))
        setResultadoFinal({ ncCount, ncImperativos, itensNc, offline: true, nomeSupervisor: supervisor, veiculo: formatPlaca(dadosVeiculo['placa'] ?? ''), fotosPreview: fotosPreviewOffline, fotosUrls: [], problemas, descricaoProblema })
        clearFormDraft()
        onConcluido?.()
        setConcluido(true)
        setEnviando(false)
        return
      }

      const ts = Date.now()

      const evidenciaUrlsGerais = await Promise.all(
        arquivos.map((file) =>
          uploadFile(file, `${schema.id}/${ts}-${file.name.replace(/\s+/g, '_')}`)
        )
      )
      const evidenciaUrls: string[] = evidenciaUrlsGerais.filter(Boolean) as string[]

      const fotasUrls: Record<string, string[]> = {}
      await Promise.all(
        Object.entries(fotosItem).map(async ([itemId, fotos]) => {
          const urls = await Promise.all(
            fotos.map((file, i) => {
              const ext = file.name.split('.').pop() ?? 'jpg'
              return uploadFile(file, `${schema.id}/item-${itemId}-${ts}-${i}.${ext}`)
            })
          )
          fotasUrls[itemId] = urls.filter(Boolean) as string[]
          evidenciaUrls.push(...(fotasUrls[itemId]))
        })
      )

      const observacoesFinais = { ...observacoes }
      for (const [itemId, urls] of Object.entries(fotasUrls)) {
        if (urls.length > 0) {
          const t = observacoesFinais[itemId] ?? ''
          observacoesFinais[itemId] = t
            ? `${t}\n__fotos__:${urls.join('|')}`
            : `__fotos__:${urls.join('|')}`
        }
      }

      const payload = buildChecklistPayload(observacoesFinais, evidenciaUrls)
      const { error } = await supabase.from('checklists').insert(payload)

      if (error) {
        console.error('[checklist] Erro ao inserir no Supabase:', error.code, error.message, error.details)
        setErroEnvio(`Erro ao enviar checklist: ${error.message || error.code || 'erro desconhecido'}. Verifique a conexão e tente novamente.`)
        setEnviando(false)
        return
      }

      const itensNc = todosItens
        .filter((it) => respostas[it.id] === 'nc')
        .map((it) => ({ label: it.label, imperativo: !!it.imperativo, obs: observacoes[it.id] ?? '' }))

      const fotosPreview = Object.values(fotosItem).flat().map((f) => URL.createObjectURL(f))
      setResultadoFinal({ ncCount, ncImperativos, itensNc, offline: false, nomeSupervisor: supervisor, veiculo: formatPlaca(dadosVeiculo['placa'] ?? ''), fotosPreview, fotosUrls: evidenciaUrls, problemas, descricaoProblema })
      clearFormDraft()
      onConcluido?.()
      setConcluido(true)
    } catch {
      setErroEnvio('Erro inesperado ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (concluido && resultadoFinal) {
    return (
      <TelaConclusao
        ncImperativos={resultadoFinal.ncImperativos}
        ncCount={resultadoFinal.ncCount}
        itensNc={resultadoFinal.itensNc}
        offline={resultadoFinal.offline}
        nomeSupervisor={resultadoFinal.nomeSupervisor}
        veiculo={resultadoFinal.veiculo}
        operador={operador}
        fotosPreview={resultadoFinal.fotosPreview}
        fotosUrls={resultadoFinal.fotosUrls}
        problemas={resultadoFinal.problemas}
        descricaoProblema={resultadoFinal.descricaoProblema}
        isDemo={demoMode?.enabled}
        autoOpenWhatsapp={demoAutoWhatsapp}
        embeddedInFrame={embeddedInFrame}
      />
    )
  }

  // Aguarda verificação de permissão (evita piscar)
  if (gpsPermissao === 'checking') {
    return (
      <div className={`flex min-h-dvh items-center justify-center ${CHECKLIST_PAGE_BG}`}>
        <Loader2 className="size-8 animate-spin text-rose-500" />
      </div>
    )
  }

  return (
    <div
      className={`${embeddedInFrame ? 'flex min-h-full flex-col overflow-x-hidden' : 'min-h-dvh overflow-x-hidden'} ${CHECKLIST_PAGE_BG}`}
      style={!embeddedInFrame && mostrarBarraEnvio ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' } : undefined}
    >

      {/* ── Header fixo ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1020] px-3 py-3 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] dark:bg-slate-950 sm:px-4">
        <div className={`mx-auto flex items-center gap-3 ${embeddedInFrame ? 'max-w-full' : 'max-w-2xl'}`}>
          {onVoltar ? (
            <button
              type="button"
              onClick={onVoltar}
              title="Voltar para escolha do checklist"
              className="shrink-0 rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <CollapsedNavMark size="md" className="ring-1 ring-white/15" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-white">{schema.nome}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ncImperativos > 0 ? 'bg-rose-500' :
                    tudo100        ? 'bg-emerald-500' :
                    'bg-[#c81e55]'
                  }`}
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-slate-300">
                {respondidos}/{totalItens}
              </span>
              <span className="shrink-0 text-[11px] font-black tabular-nums text-white">
                {progresso}%
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-extrabold text-white">{operador}</div>
            <div className="text-[10px] font-semibold text-slate-400">Mat. {matricula}</div>
          </div>
        </div>
      </header>

      <div className={`mx-auto space-y-4 px-3 pt-4 pb-4 sm:px-4 ${embeddedInFrame ? 'max-w-full flex-1' : 'max-w-2xl'}`}>
        {!hideSync && <SyncStatus />}

        {/* ── Legenda C / NC / NA ──────────────────────────────────── */}
        <div className={`overflow-hidden rounded-2xl ${FA_CARD}`}>
          <div className={FA_SECTION_HEADER}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-rose-100">Como responder</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
            {[
              { cor: 'bg-emerald-500', label: 'C', nome: 'Conforme', desc: 'Item ok, sem problemas' },
              { cor: 'bg-rose-500',    label: 'NC', nome: 'Não Conforme', desc: 'Problema encontrado' },
              { cor: 'bg-slate-400',   label: 'NA', nome: 'Não se Aplica', desc: 'Item não existe no veículo' },
            ].map(({ cor, label, nome, desc }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 px-2 py-3 text-center">
                <span className={`flex h-8 w-12 items-center justify-center rounded-lg text-xs font-extrabold text-white ${cor}`}>
                  {label}
                </span>
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">{nome}</span>
                <span className="text-[10px] font-semibold leading-tight text-slate-400 dark:text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
          {schema.grupos.some((g) => g.itens.some((i) => i.imperativo)) && (
            <div className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 dark:border-amber-900/30 dark:bg-amber-900/10">
              <p className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
                🚫 Itens marcados com este símbolo são <strong>IMPEDITIVOS</strong> — NC neles impede a condução do veículo.
              </p>
            </div>
          )}
        </div>

        {/* ── Dados do Veículo ─────────────────────────────────────── */}
        <div className={`overflow-visible rounded-2xl ${FA_CARD}`}>
          <div className={FA_SECTION_HEADER}>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-white">
              Dados do Veículo
            </p>
            <p className="mt-0.5 text-xs font-semibold text-rose-100/85">Preencha antes de iniciar a inspeção</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
            <div className="flex flex-col gap-0.5 bg-white px-4 py-3 dark:bg-slate-950">
              <label className={FA_FIELD_LABEL}>Data *</label>
              <input
                type="date"
                value={dataInspecao}
                readOnly
                className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none pointer-events-none select-none dark:[color-scheme:dark] dark:text-slate-100"
              />
            </div>
            {(schema.camposExtras ?? []).map((campo) => (
              <div
                key={campo.id}
                className={`flex flex-col gap-0.5 bg-white px-4 py-3 dark:bg-slate-950 ${
                  campo.id === 'localidade' ? 'col-span-2' : ''
                }`}
              >
                <label className={FA_FIELD_LABEL}>
                  {campo.label}{campo.obrigatorio ? ' *' : ''}
                </label>
                {campo.id === 'placa' ? (
                  <div className="relative z-10">
                    <input
                      type="text"
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={placaSuggestOpen}
                      aria-controls={`checklist-placa-sugestoes-${schema.id}`}
                      role="combobox"
                      data-demo-form-field="placa"
                      value={formatPlaca(dadosVeiculo.placa ?? '')}
                      onChange={(e) => {
                        onPlacaChange(e.target.value)
                        setPlacaSuggestOpen(true)
                      }}
                      onFocus={() => setPlacaSuggestOpen(true)}
                      onBlur={() => {
                        onPlacaBlur()
                        window.setTimeout(() => setPlacaSuggestOpen(false), 200)
                      }}
                      onKeyDown={(e) => {
                        if (!placaSuggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                          setPlacaSuggestOpen(true)
                          return
                        }
                        if (e.key === 'Escape') {
                          setPlacaSuggestOpen(false)
                          return
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setPlacaHighlightIdx((i) => {
                            const len = placasSugeridas.length
                            if (len === 0) return 0
                            const cur = Math.min(i, len - 1)
                            return Math.min(len - 1, cur + 1)
                          })
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setPlacaHighlightIdx((i) => {
                            const len = placasSugeridas.length
                            if (len === 0) return 0
                            const cur = Math.min(i, len - 1)
                            return Math.max(0, cur - 1)
                          })
                        } else if (e.key === 'Enter' && placaSuggestOpen && placasSugeridas[placaHighlightSafe]) {
                          e.preventDefault()
                          const p = placasSugeridas[placaHighlightSafe]
                          if (p) selecionarPlacaSugestao(p)
                        }
                      }}
                      placeholder="Digite para buscar..."
                      className="w-full bg-transparent text-base font-semibold uppercase tracking-wide text-slate-900 outline-none placeholder:normal-case placeholder:text-slate-300 dark:text-slate-100"
                    />
                    {placaSuggestOpen && placasSugeridas.length > 0 ? (
                      <ul
                        id={`checklist-placa-sugestoes-${schema.id}`}
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-900"
                      >
                        {placasSugeridas.map((placaVal, idx) => (
                          <li key={placaVal}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={idx === placaHighlightSafe}
                              className={`flex w-full px-3 py-2 text-left text-sm font-bold uppercase tracking-wide ${
                                idx === placaHighlightSafe
                                  ? 'bg-[#7f1022]/12 text-[#7f1022] dark:bg-rose-500/20 dark:text-rose-200'
                                  : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
                              }`}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onMouseEnter={() => setPlacaHighlightIdx(idx)}
                              onClick={() => selecionarPlacaSugestao(placaVal)}
                            >
                              {formatPlaca(placaVal)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : placaSuggestOpen && (dadosVeiculo.placa ?? '').length > 0 && placasSugeridas.length === 0 ? (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Placa não encontrada no cadastro.{' '}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Continue digitando para usar manualmente.
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : campo.id === 'localidade' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-stretch gap-2">
                      <input
                        type="text"
                        inputMode="text"
                        data-demo-form-field="localidade"
                        value={dadosVeiculo.localidade ?? ''}
                        onChange={(e) => {
                          setLocalidadeGeoErro('')
                          setGpsErroCodigo(null)
                          setDado('localidade', e.target.value)
                        }}
                        placeholder="Endereço ou use o GPS"
                        className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        data-demo-form-field="gps-btn"
                        onClick={pedirLocalizacao}
                        disabled={localidadeGeoLoading}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7f1022]/35 bg-[#7f1022]/[0.08] px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#7f1022] transition hover:bg-[#7f1022]/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                      >
                        {localidadeGeoLoading ? (
                          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <MapPin className="size-4 shrink-0" aria-hidden />
                        )}
                        GPS
                      </button>
                    </div>
                    {localidadeGeoErro && gpsErroCodigo ? (
                      <div className="overflow-hidden rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40">
                        {/* Cabeçalho sempre visível */}
                        <button
                          type="button"
                          onClick={() => setGpsGuiaAberto((v) => !v)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                        >
                          <MapPin className="size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                          <span className="flex-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                            {localidadeGeoErro}
                          </span>
                          <ChevronDown
                            className={`size-4 shrink-0 text-rose-500 transition-transform duration-200 ${gpsGuiaAberto ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                        </button>

                        {/* Instruções dobráveis */}
                        {gpsGuiaAberto && (
                          <div className="border-t border-rose-200 px-3 pb-3 pt-2 dark:border-rose-800/40">
                            {gpsErroCodigo === 2 ? (
                              /* GPS do sistema desligado */
                              <>
                                <p className="mb-2 text-xs font-extrabold text-rose-700 dark:text-rose-300">
                                  Ative o GPS do celular:
                                </p>
                                <ol className="space-y-2">
                                  {[
                                    { n: '1', texto: <>Abra as <strong>Configurações</strong> do celular</> },
                                    { n: '2', texto: <>Toque em <strong>Localização</strong></> },
                                    { n: '3', texto: <>Ative a chave de <strong>Localização</strong></> },
                                    { n: '4', texto: <>Volte aqui e toque em <strong>Tentar novamente</strong></> },
                                  ].map(({ n, texto }) => (
                                    <li key={n} className="flex items-start gap-2">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-200 text-[10px] font-black text-rose-700 dark:bg-rose-900 dark:text-rose-300">{n}</span>
                                      <span className="text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-300">{texto}</span>
                                    </li>
                                  ))}
                                </ol>
                              </>
                            ) : gpsErroCodigo === 1 ? (
                              /* Permissão negada no navegador */
                              <>
                                <p className="mb-2 text-xs font-extrabold text-rose-700 dark:text-rose-300">
                                  Libere a permissão no Chrome:
                                </p>
                                <ol className="space-y-2">
                                  {[
                                    { n: '1', texto: <>Toque nos <strong>3 pontos ⋮</strong> no canto superior direito</> },
                                    { n: '2', texto: <>Toque em <strong>Configurações</strong></> },
                                    { n: '3', texto: <>Toque em <strong>Configurações do site</strong></> },
                                    { n: '4', texto: <>Toque em <strong>Localização</strong></> },
                                    { n: '5', texto: <>Encontre <strong>c-frota.vercel.app</strong> em "Bloqueados" e toque para <strong>Permitir</strong></> },
                                    { n: '6', texto: <>Volte aqui e toque em <strong>Tentar novamente</strong></> },
                                  ].map(({ n, texto }) => (
                                    <li key={n} className="flex items-start gap-2">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-200 text-[10px] font-black text-rose-700 dark:bg-rose-900 dark:text-rose-300">{n}</span>
                                      <span className="text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-300">{texto}</span>
                                    </li>
                                  ))}
                                </ol>
                              </>
                            ) : (
                              /* Timeout / sem sinal */
                              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                                Vá para um local com melhor sinal e tente novamente, ou digite o endereço manualmente.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={pedirLocalizacao}
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-rose-700 active:scale-95 dark:bg-rose-700 dark:hover:bg-rose-600"
                            >
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              Tentar novamente
                            </button>
                            <p className="mt-2 text-center text-[11px] text-rose-500 dark:text-rose-400">
                              ou digite o endereço manualmente no campo acima
                            </p>
                          </div>
                        )}
                      </div>
                    ) : localidadeGeoErro ? (
                      <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{localidadeGeoErro}</p>
                    ) : null}
                    {localidadeCoords && !localidadeGeoLoading ? (() => {
                      const isCoords = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(dadosVeiculo.localidade ?? '')
                      const [latStr, lngStr] = (dadosVeiculo.localidade ?? '').split(',')
                      const latDMS = isCoords ? `${Math.abs(parseFloat(latStr ?? '0')).toFixed(4)}° ${parseFloat(latStr ?? '0') >= 0 ? 'N' : 'S'}` : null
                      const lngDMS = isCoords ? `${Math.abs(parseFloat(lngStr ?? '0')).toFixed(4)}° ${parseFloat(lngStr ?? '0') >= 0 ? 'L' : 'O'}` : null
                      return (
                        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
                              <MapPin className="size-4 text-white" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                Localização capturada{localidadeAccuracy ? ` · ±${localidadeAccuracy}m` : ''}
                              </p>
                              {isCoords ? (
                                <p className="mt-0.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                                  {latDMS} &nbsp;{lngDMS}
                                </p>
                              ) : (
                                <p className="mt-0.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  {dadosVeiculo.localidade}
                                </p>
                              )}
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${localidadeCoords.lat},${localidadeCoords.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-50 active:scale-95 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            >
                              Ver mapa
                            </a>
                          </div>
                          {isCoords && (
                            <div className="border-t border-emerald-100 bg-emerald-100/60 px-3 py-1.5 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                📡 Sem internet — endereço será registrado ao reconectar
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })() : null}
                  </div>
                ) : campo.tipo === 'select' ? (() => {
                  // Opções: schema estático OU dinâmico do registro de veículos
                  const opcoesDinamicas = (opcoesVeiculo as Record<string, string[]>)[campo.id] ?? []
                  const opcoesEstaticas = campo.opcoes ?? []
                  const opcoes = opcoesEstaticas.length > 0 ? opcoesEstaticas : opcoesDinamicas
                  const listId = `datalist-${campo.id}`
                  return (
                    <>
                      <input
                        list={listId}
                        data-demo-form-field={campo.id}
                        value={dadosVeiculo[campo.id] ?? ''}
                        onChange={(e) => setDado(campo.id, e.target.value)}
                        placeholder={opcoes.length > 0 ? 'Escolher ou digitar...' : '—'}
                        className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
                      />
                      <datalist id={listId}>
                        {opcoes.map((op) => <option key={op} value={op} />)}
                      </datalist>
                    </>
                  )
                })() : (
                  <input
                    type={campo.tipo === 'number' ? 'number' : 'text'}
                    inputMode={campo.tipo === 'number' ? 'numeric' : 'text'}
                    data-demo-form-field={campo.id}
                    value={dadosVeiculo[campo.id] ?? ''}
                    onChange={(e) => setDado(campo.id, e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
                  />
                )}
              </div>
            ))}
          </div>
          {!camposPreenchidos && tudo100 && (
            <div className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 dark:border-rose-900/30 dark:bg-rose-900/10">
              <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                ⚠ Preencha todos os campos obrigatórios (*) para poder enviar.
              </p>
            </div>
          )}
        </div>

        {/* ── Supervisor ───────────────────────────────────────────── */}
        {schema.temSupervisor && (
          <SupervisorField value={supervisor} onChange={setSupervisor} forceOpen={supervisorDropdownOpen} />
        )}

        {/* ── Grupos de itens ──────────────────────────────────────── */}
        {gruposDemo.map((grupo) => {
          const respondidosGrupo = grupo.itens.filter((it) => respostas[it.id] != null).length
          const grupoCompleto    = respondidosGrupo === grupo.itens.length

          return (
            <div
              key={grupo.id}
              className={`overflow-hidden rounded-2xl ${FA_CARD}`}
            >
              {/* Cabeçalho do grupo */}
              <div className="flex items-center justify-between border-b border-[#7f1022]/10 bg-gradient-to-r from-white to-rose-50/80 px-4 py-3 dark:border-white/10 dark:from-slate-950 dark:to-rose-950/20">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#7f1022] dark:text-rose-200">
                  {grupo.titulo}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                  grupoCompleto
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-[#7f1022]/10 text-[#7f1022] dark:bg-rose-500/10 dark:text-rose-200'
                }`}>
                  {grupoCompleto ? '✓ ' : ''}{respondidosGrupo}/{grupo.itens.length}
                </span>
              </div>

              {/* Rótulos das colunas */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white/70 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/30 sm:px-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#7f1022]/50 dark:text-rose-200/50">#  Item</span>
                <div className="flex gap-1 sm:gap-2">
                  {['C', 'NC', 'NA'].map((l) => (
                    <span key={l} className="w-10 text-center text-[10px] font-extrabold uppercase tracking-widest text-[#7f1022]/50 sm:w-14 md:w-16 dark:text-rose-200/50">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {grupo.itens.map((item, itemIdx) => (
                <ItemChecklist
                  key={item.id}
                  item={item}
                  numero={numeroItemMap[item.id] ?? itemIdx + 1}
                  isLast={itemIdx === grupo.itens.length - 1}
                  resp={respostas[item.id] ?? null}
                  obs={observacoes[item.id] ?? ''}
                  fotos={fotosItem[item.id] ?? []}
                  destacado={itemDestacado === item.id}
                  fotoFaltando={respostas[item.id] === 'nc' && (fotosItem[item.id] ?? []).length === 0 && !fotosNcOk}
                  onResposta={setResposta}
                  onObs={setObservacaoCb}
                  onAddFoto={addFotoItem}
                  onRemoveFoto={removeFotoItemCb}
                  itemRef={(el) => { itemRefs.current[item.id] = el }}
                />
              ))}
            </div>
          )
        })}

        {/* ── Problemas Verificados ────────────────────────────────── */}
        {schema.temProblemas && (
          <div className={`overflow-hidden rounded-2xl ${FA_CARD}`}>
            <div className={FA_SECTION_HEADER}>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-white">
                Problemas Adicionais
              </p>
              <p className="mt-0.5 text-xs font-semibold text-rose-100/85">
                Registre qualquer problema não coberto pelos itens acima (freios, motor, câmbio, pneus, etc.)
              </p>
            </div>
            <div className="px-4 py-3">
              <textarea
                rows={4}
                data-demo-form-field="problemas"
                value={problemas}
                onChange={(e) => setProblemas(e.target.value)}
                placeholder="Ex: 'Barulho no câmbio ao trocar de marcha' ou 'Nenhum problema adicional'..."
                className="w-full resize-none bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-slate-100"
              />
              {problemas && (
                <>
                  <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                  <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Detalhe / local do problema
                  </label>
                  <textarea
                    rows={2}
                    value={descricaoProblema}
                    onChange={(e) => setDescricaoProblema(e.target.value)}
                    placeholder="Ex: 'Lado traseiro direito', 'Ao frear em alta velocidade'..."
                    className="w-full resize-none bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-slate-100"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Evidência NR12 ───────────────────────────────────────── */}
        {schema.temEvidencia && (
          <div className={`overflow-hidden rounded-2xl ${FA_CARD}`}>
            <div className={FA_SECTION_HEADER}>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-white">
                Evidência NR12 *
              </p>
              <p className="mt-0.5 text-xs font-semibold text-rose-100/85">
                Obrigatório — anexe fotos ou PDFs da inspeção geral (máx. 10 arquivos · imagens até 800 KB, ajuste automático)
              </p>
            </div>
            <div className="px-4 py-3">
              {arquivos.length > 0 && (
                <div className="mb-3 space-y-2">
                  {arquivos.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                      <Paperclip size={13} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button type="button" onClick={() => removerArquivo(idx)} className="shrink-0 text-slate-400 hover:text-rose-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {arquivos.length < 10 && (
                <>
                  <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleArquivos} />
                  <button
                    type="button"
                    data-demo-form-field="nr12"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#7f1022]/20 bg-[#7f1022]/[0.08] px-4 py-2.5 text-sm font-extrabold text-[#7f1022] transition hover:bg-[#7f1022]/[0.12] dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    <Paperclip size={15} />
                    Adicionar arquivo
                    {arquivos.length > 0 && (
                      <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {arquivos.length}/10
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
            {tudo100 && camposPreenchidos && arquivos.length === 0 && (
              <div className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 dark:border-rose-900/30 dark:bg-rose-900/10">
                <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                  ⚠ Anexe pelo menos um arquivo de evidência NR12 para enviar o checklist.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Aviso bloqueio ───────────────────────────────────────── */}
        {ncImperativos > 0 && (
          <div className="rounded-2xl border-2 border-rose-400 bg-rose-50 px-4 py-4 dark:border-rose-700 dark:bg-rose-900/20">
            <p className="text-sm font-extrabold text-rose-700 dark:text-rose-400">
              🚫 ATENÇÃO — VEÍCULO IMPEDIDO DE SER CONDUZIDO
            </p>
            <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-500">
              {ncImperativos} item(s) impeditivo(s) marcado(s) como Não Conforme. Acione o supervisor antes de mover o veículo.
            </p>
          </div>
        )}

      </div>

      {/* ── Barra de envio fixa (só após todos os itens respondidos) ─── */}
      {mostrarBarraEnvio && (
      <div
        className={`${embeddedInFrame ? 'shrink-0' : 'fixed bottom-0 left-0 right-0'} z-20 border-t border-white/10 bg-[#0b1020] px-3 pt-3 text-white shadow-[0_-18px_45px_rgba(15,23,42,0.18)] dark:bg-slate-950 sm:px-4`}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className={`mx-auto flex items-center justify-between gap-3 ${embeddedInFrame ? 'max-w-full' : 'max-w-2xl'}`}>
          <div className="min-w-0">
            {erroEnvio ? (
              <p className="text-sm font-extrabold text-rose-500">{erroEnvio}</p>
            ) : ncImperativos > 0 ? (
              <p className="text-sm font-extrabold text-rose-500">🚫 {ncImperativos} item(s) impeditivo(s)</p>
            ) : ncCount > 0 ? (
              <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{ncCount} NC registrado(s)</p>
            ) : tudo100 && camposPreenchidos && evidenciaNr12Ok ? (
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> Pronto para enviar
              </p>
            ) : tudo100 && camposPreenchidos && evidenciaNr12Ok && !fotosNcOk ? (
              <p className="text-sm font-semibold text-rose-500 dark:text-rose-400">
                📷 {itensNcSemFoto.length} item(s) NC sem foto — obrigatória
              </p>
            ) : tudo100 && camposPreenchidos && schema.temEvidencia && !evidenciaNr12Ok ? (
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Anexe a evidência NR12 (obrigatória)
              </p>
            ) : tudo100 ? (
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Preencha os dados obrigatórios</p>
            ) : (
              <p className="text-sm font-semibold text-slate-300">
                Faltam {totalItens - respondidos} item(s)
              </p>
            )}
          </div>
          <button
            type="button"
            data-demo-form-field="enviar"
            onClick={handleEnviar}
            disabled={!podEnviar || enviando}
            className={`h-12 shrink-0 rounded-xl px-6 text-sm font-extrabold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              ncImperativos > 0
                ? 'bg-rose-600 dark:bg-rose-700'
                : FA_PRIMARY_BUTTON
            }`}
          >
            {enviando ? 'Enviando…' : ncImperativos > 0 ? 'Enviar e Reportar' : 'Enviar Checklist'}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página raiz
// ---------------------------------------------------------------------------
const DRAFT_SESSION_KEY = 'frota.checklist.draft'

function readDraftSession(): { tipo: string; operador: string; matricula: string } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function writeDraftSession(tipo: string, operador: string, matricula: string) {
  try { sessionStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify({ tipo, operador, matricula })) }
  catch { /* storage cheio */ }
}

function clearDraftSession() {
  try { sessionStorage.removeItem(DRAFT_SESSION_KEY) }
  catch { /* sem acesso */ }
}

function DemoOutroScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0b1020] px-6 text-center">
      {/* Logo animada */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Anel pulsante externo */}
        <div className="absolute h-36 w-36 animate-ping rounded-full bg-[#b51649]/20" style={{ animationDuration: '2.5s' }} />
        {/* Anel médio */}
        <div className="absolute h-28 w-28 animate-ping rounded-full bg-[#b51649]/30" style={{ animationDuration: '2.5s', animationDelay: '0.4s' }} />
        {/* Logo central */}
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[#b51649] via-[#9f1239] to-[#7f1022] shadow-[0_0_60px_rgba(181,22,73,0.6)] ring-2 ring-white/20"
          style={{ animation: 'cgb-outro-logo 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <img src="/branding/favicon.png" alt="FA" className="h-[70%] w-[70%] object-contain" />
        </div>
      </div>

      {/* Texto */}
      <div style={{ animation: 'cgb-outro-text 0.5s ease 0.4s both' }}>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-rose-400">FrotaApp</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Até logo! 👋</h2>
        <p className="mx-auto mt-3 max-w-[260px] text-sm font-semibold leading-relaxed text-slate-400">
          Obrigado por conhecer o <span className="font-extrabold text-white">FrotaApp</span>. Gestão inteligente para sua frota.
        </p>
      </div>

      {/* Divisor */}
      <div className="my-6 h-px w-16 rounded-full bg-white/10" style={{ animation: 'cgb-outro-text 0.5s ease 0.7s both' }} />

      {/* Slogan */}
      <p
        className="text-xs font-extrabold uppercase tracking-widest text-slate-500"
        style={{ animation: 'cgb-outro-text 0.5s ease 0.9s both' }}
      >
        Segurança · Eficiência · Controle
      </p>

      {/* Botão reiniciar */}
      <button
        type="button"
        onClick={onRestart}
        className="mt-10 rounded-2xl bg-white/10 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/15 active:scale-95"
        style={{ animation: 'cgb-outro-text 0.5s ease 1.1s both' }}
      >
        ↺ Ver novamente
      </button>

      <style>{`
        @keyframes cgb-outro-logo {
          from { opacity: 0; transform: scale(0.3) rotate(-15deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes cgb-outro-text {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export function ChecklistPublicoPage({ forceDemo = false }: { forceDemo?: boolean } = {}) {
  const [searchParams] = useSearchParams()
  const isDemo = forceDemo || searchParams.get('demo') === '1'
  const withFrame = forceDemo || searchParams.get('frame') !== '0'
  const loop = searchParams.get('loop') === '1'
  const speedFactor = Math.max(0.25, Number(searchParams.get('speed') ?? '1') || 1)
  const tipoParam = searchParams.get('tipo')
  const narrationEnabled = searchParams.get('narration') !== '0'

  const draft = isDemo ? null : readDraftSession()
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(draft?.tipo ?? null)
  const [operador, setOperador]   = useState<string | null>(draft?.operador ?? null)
  const [matricula, setMatricula] = useState<string | null>(draft?.matricula ?? null)
  const [demoConcluido, setDemoConcluido] = useState(false)
  const [demoKey, setDemoKey] = useState(0)
  const [demoStarted, setDemoStarted] = useState(() => !isDemo || !narrationEnabled)

  useEffect(() => {
    configureDemoNarrator({ enabled: isDemo && narrationEnabled, speedFactor })
  }, [isDemo, narrationEnabled, speedFactor])

  // Para o áudio apenas quando o componente desmonta de verdade
  useEffect(() => () => stopDemoNarration(), [])

  const handleStartDemo = useCallback(() => {
    void unlockDemoNarrator().then(() => setDemoStarted(true))
  }, [])

  const handleDemoRestart = useCallback(() => {
    stopDemoNarration()
    clearDraftSession()
    clearFormDraft()
    setTipoSelecionado(null)
    setOperador(null)
    setMatricula(null)
    setDemoConcluido(false)
    if (isDemoNarratorUnlocked() || !narrationEnabled) {
      setDemoStarted(true)
    } else {
      setDemoStarted(false)
    }
    setDemoKey((k) => k + 1)
  }, [narrationEnabled])

  const handleTipo = useCallback((tipo: string) => {
    setTipoSelecionado(tipo)
    if (!isDemo) writeDraftSession(tipo, '', '')
  }, [isDemo])

  const tipoSelecionadoRef = useRef(tipoSelecionado)
  useEffect(() => { tipoSelecionadoRef.current = tipoSelecionado }, [tipoSelecionado])

  const handleOperador = useCallback((nome: string, mat: string) => {
    setOperador(nome)
    setMatricula(mat)
    if (!isDemo && tipoSelecionadoRef.current) writeDraftSession(tipoSelecionadoRef.current, nome, mat)
  }, [isDemo])

  const demo = useChecklistDemoPlayer({
    enabled: isDemo && demoStarted,
    speedFactor,
    tipoOverride: tipoParam,
    loop,
    hasTipo: !!tipoSelecionado,
    hasOperador: !!(operador && matricula),
    isConcluido: demoConcluido,
    onSelectTipo: handleTipo,
    onConfirmOperador: handleOperador,
    onRestart: handleDemoRestart,
  })

  useEffect(() => {
    if (!isDemo) return
    clearDraftSession()
    clearFormDraft()
  }, [isDemo, demoKey])

  let content: React.ReactNode
  const embeddedInFrame = isDemo && withFrame

  if (isDemo && demoConcluido) {
    content = <DemoOutroScreen onRestart={handleDemoRestart} />
  } else if (!tipoSelecionado) {
    content = (
      <TelaEscolhaChecklist
        onSelecionar={handleTipo}
        highlightTipo={isDemo ? demo.highlightTipo : null}
        hideSync={isDemo}
        embeddedInFrame={embeddedInFrame}
      />
    )
  } else {
    const schema = SCHEMA_MAP[tipoSelecionado]
    if (!schema) {
      content = <Navigate to="/checklist" replace />
    } else if (!operador || !matricula) {
      content = (
        <TelaIdentificacao
          schema={schema}
          onConfirmar={handleOperador}
          onVoltar={() => setTipoSelecionado(null)}
          demoNome={isDemo ? demo.demoNome : undefined}
          demoMatricula={isDemo ? demo.demoMatricula : undefined}
          pulseSubmit={isDemo ? demo.pulseSubmit : false}
          embeddedInFrame={embeddedInFrame}
        />
      )
    } else {
      content = (
        <FormularioChecklist
          key={isDemo ? `${tipoSelecionado}-${demoKey}` : tipoSelecionado}
          schema={schema}
          operador={operador}
          matricula={matricula}
          onConcluido={() => {
            if (isDemo) setDemoConcluido(true)
            else clearDraftSession()
          }}
          onVoltar={isDemo ? undefined : () => { setOperador(''); setMatricula('') }}
          demoMode={isDemo && demoStarted ? { enabled: true, speedFactor } : undefined}
          onCursorTarget={isDemo ? demo.setCursorTarget : undefined}
          hideSync={isDemo}
          embeddedInFrame={embeddedInFrame}
        />
      )
    }
  }

  if (isDemo && withFrame) {
    return (
      <>
        <ChecklistPhoneFrame key={demoKey}>
          {narrationEnabled && !demoStarted && (
            <ChecklistDemoStartOverlay onStart={handleStartDemo} embeddedInFrame />
          )}
          {!demoStarted && (
            <ChecklistDemoBanner phase={demo.phase} onRestart={handleDemoRestart} embeddedInFrame narrationEnabled={narrationEnabled} />
          )}
          {content}
        </ChecklistPhoneFrame>
        <DemoCursor target={demo.cursorTarget} visible={isDemo && demoStarted} />
      </>
    )
  }

  if (isDemo) {
    return (
      <>
        {narrationEnabled && !demoStarted && (
          <ChecklistDemoStartOverlay onStart={handleStartDemo} />
        )}
        {!demoStarted && (
          <ChecklistDemoBanner phase={demo.phase} onRestart={handleDemoRestart} narrationEnabled={narrationEnabled} />
        )}
        {content}
        <DemoCursor target={demo.cursorTarget} visible={isDemo && demoStarted} />
      </>
    )
  }

  return <>{content}</>
}

function ChecklistDemoStartOverlay({
  onStart,
  embeddedInFrame = false,
}: {
  onStart: () => void
  embeddedInFrame?: boolean
}) {
  return (
    <div
      className={`z-50 flex items-center justify-center bg-[#0b1020]/92 p-6 backdrop-blur-sm ${
        embeddedInFrame ? 'absolute inset-0 rounded-[2.1rem]' : 'fixed inset-0'
      }`}
    >
      <div className="max-w-xs text-center">
        <p className="text-lg font-black text-white">Demo do Checklist</p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-300">
          Narração passo a passo sincronizada com o preenchimento automático.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c81e55] px-6 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#a81848] active:scale-95"
        >
          <span aria-hidden>▶</span>
          Iniciar com narração
        </button>
        <p className="mt-3 text-[11px] font-semibold text-slate-500">
          Clique para liberar o áudio no navegador
        </p>
      </div>
    </div>
  )
}

function ChecklistDemoBanner({
  phase,
  onRestart,
  embeddedInFrame = false,
  narrationEnabled = true,
}: {
  phase: string
  onRestart: () => void
  embeddedInFrame?: boolean
  narrationEnabled?: boolean
}) {
  const labels: Record<string, string> = {
    select: 'Escolhendo checklist…',
    identify: 'Identificação…',
    form: 'Preenchendo formulário…',
    done: 'Concluído!',
  }

  return (
    <div className={`pointer-events-none z-40 flex justify-center ${embeddedInFrame ? 'sticky top-0 p-2 pt-9' : 'fixed inset-x-0 top-0 p-3'}`}>
      <div className="pointer-events-auto flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-[#0b1020]/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2 sm:text-xs">
        <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
        <span className="truncate">Modo vídeo — {labels[phase] ?? phase}</span>
        {narrationEnabled && (
          <span className="hidden shrink-0 text-[9px] font-bold uppercase tracking-wide text-emerald-400/90 sm:inline">
            🔊 Narração
          </span>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide transition hover:bg-white/20 sm:px-2.5 sm:text-[10px]"
        >
          Reiniciar
        </button>
      </div>
    </div>
  )
}
