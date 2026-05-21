import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectCustom } from '../components/ui/SelectCustom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase, type ChecklistRow } from '../lib/supabase'
import { SCHEMA_MAP } from '../data/checklistSchemas'
import { useAuth } from '../auth/AuthContext'
import { formatPlaca, normalizePlaca } from '../frota/vehicleRegistry'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'sky', label: 'SKY' },
  { id: 'munck', label: 'Munck' },
  { id: 'picape-leve', label: 'Picape Leve' },
  { id: 'picape-4x4', label: 'Picape 4x4' },
  { id: 'motocicleta', label: 'Motocicleta' },
  { id: 'veiculo-leve', label: 'Veículo Leve' },
  { id: 'empilhadeira', label: 'Empilhadeira' },
]

// Badge colorido por tipo
const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  sky:           { label: 'SKY',          cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  munck:         { label: 'Munck',        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'picape-leve': { label: 'Picape Leve',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'picape-4x4':  { label: 'Picape 4x4',  cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  motocicleta:   { label: 'Moto',         cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  'veiculo-leve':  { label: 'Veíc. Leve',    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  'empilhadeira':  { label: 'Empilhadeira',  cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
}

// Exportação CSV
function exportarCSV(rows: ChecklistRow[]) {
  const cols = ['Data', 'Tipo', 'Operador', 'Matrícula', 'Placa', 'KM', 'Prefixo', 'Processo', 'Localidade', 'C', 'NC', 'Problemas', 'Supervisor']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const linhas = rows.map((r) => {
    const dv = r.dados_veiculo ?? {}
    const c  = Object.values(r.respostas).filter((v) => v === 'c').length
    return [
      r.data_inspecao,
      TIPO_BADGE[r.tipo]?.label ?? r.tipo,
      r.nome_operador,
      r.matricula,
      formatPlaca(String(dv.placa ?? '')),
      dv.km_atual ?? '',
      dv.prefixo ?? '',
      dv.processo ?? '',
      dv.localidade ?? '',
      c,
      r.nc_count,
      r.problemas ?? '',
      r.nome_supervisor ?? '',
    ].map(String).map(escape).join(',')
  })
  const csv = [cols.map(escape).join(','), ...linhas].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `checklists_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Sparkline SVG — tendência semanal de NC
function Sparkline({ semanas }: { semanas: { label: string; nc: number; total: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (semanas.length < 2) return null

  const maxNc = Math.max(...semanas.map((s) => s.nc), 1)
  const W = 1000, H = 120, padX = 24, padY = 16

  const xs = semanas.map((_, i) => padX + (i / (semanas.length - 1)) * (W - padX * 2))
  const ys = semanas.map((s) => padY + (1 - s.nc / maxNc) * (H - padY * 2))

  // curva suave via bezier
  function smoothPath(xArr: number[], yArr: number[]) {
    let d = `M${xArr[0]!.toFixed(1)},${yArr[0]!.toFixed(1)}`
    for (let i = 1; i < xArr.length; i++) {
      const cpx = (xArr[i - 1]! + xArr[i]!) / 2
      d += ` C${cpx.toFixed(1)},${yArr[i - 1]!.toFixed(1)} ${cpx.toFixed(1)},${yArr[i]!.toFixed(1)} ${xArr[i]!.toFixed(1)},${yArr[i]!.toFixed(1)}`
    }
    return d
  }

  const linePath = smoothPath(xs, ys)
  const areaPath = `${linePath} L${xs[xs.length - 1]!.toFixed(1)},${H} L${xs[0]!.toFixed(1)},${H} Z`

  const ultima = semanas[semanas.length - 1]
  const penultima = semanas[semanas.length - 2]
  const tendencia = ultima && penultima
    ? ultima.nc > penultima.nc ? 'alta' : ultima.nc < penultima.nc ? 'queda' : 'estável'
    : 'estável'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Tendência NC
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Últimas {semanas.length} semanas
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            tendencia === 'alta'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
              : tendencia === 'queda'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {tendencia === 'alta' ? '↑ Em alta' : tendencia === 'queda' ? '↓ Em queda' : '→ Estável'}
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-rose-500">{ultima?.nc ?? 0}</div>
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">esta semana</div>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="relative px-2 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H + 4}`}
          className="w-full overflow-visible"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="sparkGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(239,68,68)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="rgb(239,68,68)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* linhas de grade horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + t * (H - padY * 2)
            const val = Math.round(maxNc * (1 - t))
            return (
              <g key={t}>
                <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" className="text-slate-900 dark:text-slate-100" />
                <text x={padX - 6} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.3" className="text-slate-900 dark:text-slate-100 font-semibold">{val}</text>
              </g>
            )
          })}

          {/* área */}
          <path d={areaPath} fill="url(#sparkGrad2)" />

          {/* linha */}
          <path d={linePath} fill="none" stroke="rgb(239,68,68)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {/* pontos + hover targets */}
          {xs.map((x, i) => (
            <g key={i}>
              <circle
                cx={x} cy={ys[i]} r="16"
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
              <circle
                cx={x} cy={ys[i]} r={hovered === i ? 5 : 3.5}
                fill={hovered === i ? 'white' : 'rgb(239,68,68)'}
                stroke="rgb(239,68,68)"
                strokeWidth="2"
                style={{ transition: 'r 0.1s' }}
              />
              {/* tooltip */}
              {hovered === i && (
                <g>
                  <rect
                    x={x - 38} y={(ys[i] ?? 0) - 36}
                    width="76" height="26"
                    rx="5" ry="5"
                    fill="rgb(15,23,42)"
                    stroke="rgb(239,68,68)"
                    strokeWidth="1"
                    strokeOpacity="0.5"
                  />
                  <text x={x} y={(ys[i] ?? 0) - 19} textAnchor="middle" fontSize="12" fill="rgb(239,68,68)" fontWeight="800">
                    {semanas[i]?.nc} NC
                  </text>
                  <text x={x} y={(ys[i] ?? 0) - 7} textAnchor="middle" fontSize="10" fill="rgb(148,163,184)">
                    {semanas[i]?.label}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* labels semana */}
        <div className="flex justify-between px-4 pb-3">
          {semanas.map((s, i) => (
            <span
              key={i}
              className={`text-[10px] font-semibold transition ${hovered === i ? 'text-rose-500' : 'text-slate-400 dark:text-slate-600'}`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: extrai texto e URLs de fotos de uma observação
// ---------------------------------------------------------------------------
function parseObs(raw: string): { texto: string; fotos: string[] } {
  const marker = '__fotos__:'
  const idx = raw.indexOf(marker)
  if (idx === -1) return { texto: raw, fotos: [] }
  const texto = raw.slice(0, idx).replace(/\n$/, '').trim()
  const fotos = raw.slice(idx + marker.length).split('|').filter(Boolean)
  return { texto, fotos }
}

// ---------------------------------------------------------------------------
// Lightbox de imagens
// ---------------------------------------------------------------------------
function Lightbox({ urls, index, onClose, onPrev, onNext }: {
  urls: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const url = urls[index]!
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X size={20} />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <img
        src={url}
        alt={`Evidência ${index + 1}`}
        className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-extrabold text-white">
        {index + 1} / {urls.length}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de detalhe
// ---------------------------------------------------------------------------

function ModalDetalhe({ row, onClose }: { row: ChecklistRow; onClose: () => void }) {
  const schema = SCHEMA_MAP[row.tipo]
  const placa = formatPlaca(row.dados_veiculo?.placa ?? '')
  const km = row.dados_veiculo?.km_atual ?? ''

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [lightboxUrls, setLightboxUrls] = useState<string[]>([])

  const openLightbox = (urls: string[], idx: number) => {
    setLightboxUrls(urls)
    setLightboxIdx(idx)
  }

  const fotos = (row.evidencia_urls ?? []).filter((u) => /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(u))
  const pdfs  = (row.evidencia_urls ?? []).filter((u) => /\.pdf(\?|$)/i.test(u))
  const outros = (row.evidencia_urls ?? []).filter((u) => !fotos.includes(u) && !pdfs.includes(u))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100">
              {schema?.nome ?? row.tipo}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {row.nome_operador} · Mat. {row.matricula}
              {placa ? ` · ${placa}` : ''}
              {km ? ` · ${km} km` : ''}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>{formatDateBR(row.data_inspecao)}</span>
              <span>·</span>
              <span>Enviado em {formatDateTimeBR(row.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {row.nc_count > 0 && (
              <Link
                to={`/gerenciar?placa=${encodeURIComponent(normalizePlaca(row.dados_veiculo?.placa ?? ''))}&checklist=${row.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                <ExternalLink size={13} />
                Ver no Gerenciar
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* resumo */}
        <div className="flex flex-wrap gap-4 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={15} />
            {Object.values(row.respostas).filter((v) => v === 'c').length} C
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-extrabold ${row.nc_count > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            <AlertTriangle size={15} />
            {row.nc_count} NC
          </div>
          {row.nc_imperativos > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-rose-600">
              🚫 {row.nc_imperativos} imperativos com NC
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-400">
            {Object.values(row.respostas).filter((v) => v === 'na').length} N/A
          </div>
        </div>

        {/* dados extras do veículo */}
        {Object.keys(row.dados_veiculo ?? {}).length > 0 && (
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Dados do Veículo
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {Object.entries(row.dados_veiculo).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="font-extrabold uppercase text-slate-500">{k.replace(/_/g, ' ')}</span>
                  {': '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {k === 'placa' ? formatPlaca(String(v ?? '')) : v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* problemas */}
        {(row.problemas || row.descricao_problema) && (
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-500">
              Problemas Verificados
            </p>
            {row.problemas && (
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{row.problemas}</p>
            )}
            {row.descricao_problema && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{row.descricao_problema}</p>
            )}
            {row.nome_supervisor && (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Supervisor: {row.nome_supervisor}
              </p>
            )}
          </div>
        )}

        {/* evidências */}
        {row.evidencia_urls?.length > 0 && (
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Evidências ({row.evidencia_urls.length})
            </p>

            {/* Galeria de fotos */}
            {fotos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {fotos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => openLightbox(fotos, i)}
                    className="group relative h-20 w-20 overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100 shadow-sm transition hover:border-brand-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                  >
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                      <ExternalLink size={16} className="text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* PDFs */}
            {pdfs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pdfs.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <FileText size={13} className="text-rose-400" />
                    PDF {i + 1}
                  </a>
                ))}
              </div>
            )}

            {/* Outros arquivos */}
            {outros.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {outros.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <ExternalLink size={11} />
                    Arquivo {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIdx !== null && lightboxUrls.length > 0 && (
          <Lightbox
            urls={lightboxUrls}
            index={lightboxIdx}
            onClose={() => { setLightboxIdx(null); setLightboxUrls([]) }}
            onPrev={() => setLightboxIdx((i) => (i! - 1 + lightboxUrls.length) % lightboxUrls.length)}
            onNext={() => setLightboxIdx((i) => (i! + 1) % lightboxUrls.length)}
          />
        )}

        {/* itens por grupo */}
        <div className="max-h-[50vh] overflow-y-auto p-5 space-y-4">
          {schema?.grupos.map((grupo) => (
            <div key={grupo.id}>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {grupo.titulo}
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                {grupo.itens.map((item, idx) => {
                  const resp = row.respostas[item.id]
                  const obsRaw = row.observacoes[item.id] ?? ''
                  const { texto: obsTexto, fotos: obsFotos } = parseObs(obsRaw)
                  const isLast = idx === grupo.itens.length - 1
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 ${!isLast ? 'border-b border-slate-100 dark:border-slate-800' : ''} ${resp === 'nc' ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item.imperativo && <span className="mr-1">🚫</span>}
                            {item.label}
                          </p>
                          {obsTexto && (
                            <p className="mt-0.5 text-xs font-semibold text-rose-500">{obsTexto}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                            resp === 'c'  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            resp === 'nc' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                            resp === 'na' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {resp === 'c' ? 'C' : resp === 'nc' ? 'NC' : resp === 'na' ? 'N/A' : '—'}
                          </span>
                        </div>
                      </div>
                      {/* Fotos do item NC inline */}
                      {obsFotos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {obsFotos.map((url, fi) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => openLightbox(obsFotos, fi)}
                              className="group relative h-16 w-16 overflow-hidden rounded-lg border-2 border-rose-200 bg-slate-100 shadow-sm transition hover:border-rose-400 dark:border-rose-900/50 dark:bg-slate-800"
                            >
                              <img
                                src={url}
                                alt={`Foto NC ${fi + 1}`}
                                className="h-full w-full object-cover transition group-hover:scale-105"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de edição
// ---------------------------------------------------------------------------

function ModalEditar({ row, onClose, onSalvo }: { row: ChecklistRow; onClose: () => void; onSalvo: (updated: ChecklistRow) => void }) {
  const [nomeOperador, setNomeOperador] = useState(row.nome_operador)
  const [matricula, setMatricula]       = useState(row.matricula)
  const [dataInspecao, setDataInspecao] = useState(row.data_inspecao)
  const [nomeSupervisor, setNomeSupervisor] = useState(row.nome_supervisor ?? '')
  const [problemas, setProblemas]       = useState(row.problemas ?? '')
  const [dadosVeiculo, setDadosVeiculo] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(row.dados_veiculo ?? {}).map(([k, v]) => [k, String(v ?? '')]))
  )
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')

  const handleSalvar = async () => {
    setSalvando(true)
    setErro('')
    const { data, error } = await supabase
      .from('checklists')
      .update({
        nome_operador: nomeOperador.trim(),
        matricula: matricula.trim(),
        data_inspecao: dataInspecao,
        nome_supervisor: nomeSupervisor.trim(),
        problemas: problemas.trim(),
        dados_veiculo: dadosVeiculo,
      })
      .eq('id', row.id)
      .select()
      .single()
    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    onSalvo(data as ChecklistRow)
    onClose()
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
  const labelCls = 'mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-blue-500" />
            <div className="text-base font-black text-slate-900 dark:text-slate-100">Editar Checklist</div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Operador */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Operador</label>
              <input value={nomeOperador} onChange={(e) => setNomeOperador(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Data + Supervisor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data da Inspeção</label>
              <input type="date" value={dataInspecao} onChange={(e) => setDataInspecao(e.target.value)} className={inputCls + ' dark:[color-scheme:dark]'} />
            </div>
            <div>
              <label className={labelCls}>Supervisor</label>
              <input value={nomeSupervisor} onChange={(e) => setNomeSupervisor(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Dados do veículo */}
          {Object.keys(dadosVeiculo).length > 0 && (
            <div>
              <p className={labelCls}>Dados do Veículo</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(dadosVeiculo).map(([k, v]) => (
                  <div key={k}>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">{k.replace(/_/g, ' ')}</label>
                    <input
                      value={v}
                      onChange={(e) => setDadosVeiculo((prev) => ({ ...prev, [k]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Problemas */}
          <div>
            <label className={labelCls}>Problemas</label>
            <textarea
              value={problemas}
              onChange={(e) => setProblemas(e.target.value)}
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </div>

          {erro && <p className="text-sm font-extrabold text-rose-500">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={salvando} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              Cancelar
            </button>
            <button type="button" onClick={() => void handleSalvar()} disabled={salvando} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50">
              <Save size={14} />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linha da tabela expansível (mobile)
// ---------------------------------------------------------------------------

function LinhaChecklist({
  row,
  onVerDetalhe,
  onApagar,
  onEditar,
}: {
  row: ChecklistRow
  onVerDetalhe: () => void
  onApagar?: () => void
  onEditar?: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const schema = SCHEMA_MAP[row.tipo]
  const placa = formatPlaca(row.dados_veiculo?.placa ?? '')
  const km = row.dados_veiculo?.km_atual ?? ''

  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-900/40"
        onClick={onVerDetalhe}
      >
        <td className="px-4 py-3">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {row.nome_operador}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Mat. {row.matricula}
          </div>
        </td>
        <td className="px-4 py-3">
          {(() => {
            const b = TIPO_BADGE[row.tipo]
            return b
              ? <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${b.cls}`}>{b.label}</span>
              : <span className="text-sm font-semibold text-slate-500">{row.tipo}</span>
          })()}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {placa || <span className="text-slate-400">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <div>{formatDateBR(row.data_inspecao)}</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <Clock size={11} />
            {new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {Object.values(row.respostas).filter((v) => v === 'c').length} C
            </span>
            {row.nc_count > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                row.nc_imperativos > 0
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {row.nc_count} NC{row.nc_imperativos > 0 ? ' 🚫' : ''}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {onEditar && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditar() }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                aria-label="Editar"
                title="Editar checklist"
              >
                <Pencil size={13} />
              </button>
            )}
            {onApagar && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onApagar() }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40"
                aria-label="Apagar"
                title="Apagar checklist"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v) }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 md:hidden"
              aria-label="Expandir"
            >
              {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </td>
      </tr>
      {/* linha expandida no mobile */}
      {expandido && (
        <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 md:hidden">
          <td colSpan={6} className="px-4 py-3">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Enviado em {formatDateTimeBR(row.created_at)}
              {km ? ` · ${km} km` : ''}
            </div>
            {row.nc_count > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(row.observacoes).filter(([, v]) => v).map(([id, obs]) => {
                  const item = schema?.grupos.flatMap((g) => g.itens).find((i) => i.id === id)
                  return (
                    <div key={id} className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-900/20">
                      <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                        {item?.label ?? id}
                      </p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{obs}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100

type OrdemCol = 'data_inspecao' | 'created_at' | 'nc_count' | 'nome_operador'
type OrdemDir = 'asc' | 'desc'

// Agrupa rows por semana ISO e retorna até N semanas mais recentes
function calcSemanas(rows: ChecklistRow[], n = 8) {
  const map = new Map<string, { nc: number; total: number }>()
  for (const r of rows) {
    const d = new Date(r.data_inspecao)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    const cur = map.get(key) ?? { nc: 0, total: 0 }
    cur.total++
    if (r.nc_count > 0) cur.nc++
    map.set(key, cur)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(n === Infinity ? 0 : -n)
    .map(([key, val]) => ({
      label: key.slice(5).replace('-', '/'),
      ...val,
    }))
}

export function ChecklistResultadosPage() {
  const { user } = useAuth()
  const podeGerenciar = user?.role === 'admin' || user?.role === 'super_admin'

  const [capturando, setCapturando]   = useState(false)
  const [rows, setRows]               = useState<ChecklistRow[]>([])
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => {
    try { return localStorage.getItem('frota.filtros.checklists') === 'true' }
    catch { return false }
  })
  const [carregando, setCarregando]   = useState(true)
  const [exportando, setExportando]   = useState(false)
  const [erro, setErro]               = useState('')
  const [totalRegistros, setTotal]    = useState(0)
  const [totalComNc, setTotalComNc]   = useState(0)
  const [totalSemNc, setTotalSemNc]   = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<ChecklistRow | null>(null)
  const [apagando, setApagando]       = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [query, setQuery]             = useState('')
  const [queryInput, setQueryInput]   = useState('')
  const [tipoFiltro, setTipoFiltro]   = useState('')
  const [somenteNc, setSomenteNc]     = useState(false)
  const [dataInicio, setDataInicio]   = useState('')
  const [dataFim, setDataFim]         = useState('')
  const [ordemCol, setOrdemCol]       = useState<OrdemCol>('created_at')
  const [ordemDir, setOrdemDir]       = useState<OrdemDir>('desc')
  const [detalhe, setDetalhe]         = useState<ChecklistRow | null>(null)
  const [editando, setEditando]       = useState<ChecklistRow | null>(null)
  const [sparkRows, setSparkRows]     = useState<ChecklistRow[]>([])
  const [reloadNonce, setReloadNonce] = useState(0)

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any): any => {
    if (tipoFiltro) q = q.eq('tipo', tipoFiltro)
    if (somenteNc)  q = q.gt('nc_count', 0)
    if (dataInicio) q = q.gte('data_inspecao', dataInicio)
    if (dataFim)    q = q.lte('data_inspecao', dataFim)
    if (query) {
      const placaBusca = normalizePlaca(query)
      const filtrosTexto = [`nome_operador.ilike.%${query}%`, `matricula.ilike.%${query}%`]
      if (placaBusca) {
        filtrosTexto.push(`dados_veiculo->>placa.ilike.%${placaBusca}%`)
        filtrosTexto.push(`dados_veiculo->>placa.ilike.%${formatPlaca(placaBusca)}%`)
      }
      q = q.or(filtrosTexto.join(','))
    }
    return q
  }

  const buildQuery = (pagina: number) => {
    const from = (pagina - 1) * PAGE_SIZE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = supabase
      .from('checklists')
      .select('*', { count: 'exact' })
      .order(ordemCol, { ascending: ordemDir === 'asc' })
      .range(from, from + PAGE_SIZE - 1)
    return applyFilters(base) as ReturnType<typeof supabase.from> & { then: unknown }
  }

  const apagarChecklist = async (row: ChecklistRow) => {
    setApagando(true)
    const r1 = await supabase.from('apontamentos').delete().like('id', `${row.id}__%`)
    const r2 = await supabase.from('checklists').delete().eq('id', row.id)
    if (r1.error) console.error('Erro ao apagar apontamentos:', r1.error)
    if (r2.error) console.error('Erro ao apagar checklist:', r2.error)
    setConfirmDelete(null)
    setApagando(false)
    setReloadNonce((n) => n + 1)
  }

  // Debounce na busca por texto
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(queryInput)
      setPaginaAtual(1)
    }, 400)
    return () => clearTimeout(t)
  }, [queryInput])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setCarregando(true)
      setErro('')
      try {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const [{ data, error, count }, comNcRes, semNcRes] = await Promise.all([
          (buildQuery(paginaAtual) as any),
          applyFilters(supabase.from('checklists').select('id', { count: 'exact', head: true }).gt('nc_count', 0)) as any,
          applyFilters(supabase.from('checklists').select('id', { count: 'exact', head: true }).eq('nc_count', 0)) as any,
        ])
        /* eslint-enable @typescript-eslint/no-explicit-any */
        if (cancelled) return
        if (error) {
          setErro('Erro ao carregar dados do Supabase.')
        } else {
          setRows((data as ChecklistRow[]) ?? [])
          setTotal(count ?? 0)
          setTotalComNc(comNcRes.count ?? 0)
          setTotalSemNc(semNcRes.count ?? 0)
        }
      } catch (e) {
        if (!cancelled) {
          setErro('Erro inesperado ao carregar dados.')
          console.error(e)
        }
      } finally {
        if (!cancelled) setCarregando(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paginaAtual, tipoFiltro, somenteNc, dataInicio, dataFim, query, ordemCol, ordemDir, reloadNonce]) // eslint-disable-line react-hooks/exhaustive-deps -- buildQuery/applyFilters só refletem esses filtros

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let q = supabase
        .from('checklists')
        .select('data_inspecao,nc_count')
        .order('data_inspecao', { ascending: true })

      if (dataInicio || dataFim) {
        if (dataInicio) q = q.gte('data_inspecao', dataInicio) as typeof q
        if (dataFim) q = q.lte('data_inspecao', dataFim) as typeof q
      } else {
        const oitoSemanas = new Date()
        oitoSemanas.setDate(oitoSemanas.getDate() - 56)
        q = q.gte('data_inspecao', oitoSemanas.toISOString().slice(0, 10)) as typeof q
      }

      const { data } = await q
      if (cancelled) return
      await Promise.resolve()
      if (data) setSparkRows(data as ChecklistRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [dataInicio, dataFim])

  const irParaPagina = (p: number) => {
    if (p < 1 || p > totalPaginas || p === paginaAtual) return
    setPaginaAtual(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleOrdem = (col: OrdemCol) => {
    setPaginaAtual(1)
    if (ordemCol === col) {
      setOrdemDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setOrdemCol(col)
      setOrdemDir('desc')
    }
  }

  const semanas = calcSemanas(sparkRows, (dataInicio || dataFim) ? Infinity : 8)

  const handleExportar = async () => {
    setExportando(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = supabase
      .from('checklists')
      .select('*')
      .order(ordemCol, { ascending: ordemDir === 'asc' })
      .limit(50000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (applyFilters(base) as any)
    if (data) exportarCSV(data as ChecklistRow[])
    setExportando(false)
  }

  const handleCapturar = () => {
    setCapturando(true)

    const S = 2 // escala
    const W = 900 * S
    const cardH = 110 * S
    const chartH = 220 * S
    const headerH = 44 * S
    const pad = 20 * S
    const gap = 12 * S
    const totalH = headerH + pad + cardH + gap + chartH + pad

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = totalH
    const ctx = canvas.getContext('2d')!
    ctx.scale(S, S)

    const W1 = W / S
    const font = (size: number, weight = '700') => `${weight} ${size}px Inter,system-ui,sans-serif`

    // --- fundo ---
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W1, totalH / S)

    // --- header do período ---
    ctx.fillStyle = '#1e293b'
    roundRect(ctx, 0, 0, W1, headerH / S, 0)
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = font(11, '800')
    ctx.textBaseline = 'middle'
    const periodoLabel = dataInicio && dataFim
      ? `Período: ${formatDateBR(dataInicio)} — ${formatDateBR(dataFim)}`
      : dataInicio ? `A partir de: ${formatDateBR(dataInicio)}`
      : dataFim ? `Até: ${formatDateBR(dataFim)}`
      : 'Todos os períodos'
    ctx.fillText(`📋  ${periodoLabel.toUpperCase()}`, pad / S, (headerH / S) / 2)

    // --- 4 cards ---
    const cardY = headerH / S + pad / S
    const cardW = (W1 - (pad / S) * 2 - gap / S * 3) / 4
    const cards = [
      { label: 'CHECKLISTS', value: String(totalRegistros), sub: 'no período filtrado', bg: '#1e293b', accent: '#94a3b8', val: '#f1f5f9' },
      { label: 'CONFORMES', value: String(totalSemNc), sub: 'todos conformes', bg: '#052e16', accent: '#4ade80', val: '#4ade80' },
      { label: 'SEM IMPEDIMENTO', value: String(totalRegistros - totalSemNc), sub: `${totalRegistros > 0 ? Math.round(((totalRegistros - totalSemNc) / totalRegistros) * 100) : 0}% dos checklists`, bg: '#1c1400', accent: '#f59e0b', val: '#f59e0b' },
      { label: 'COM IMPEDIMENTO', value: String(totalComNc), sub: `~${totalRegistros > 0 ? (totalComNc / totalRegistros).toFixed(1) : '0'} por checklist`, bg: '#1a0a0a', accent: '#f87171', val: '#f87171' },
    ]

    cards.forEach((card, i) => {
      const x = pad / S + i * (cardW + gap / S)
      roundRect(ctx, x, cardY, cardW, cardH / S, 14)
      ctx.fillStyle = card.bg
      ctx.fill()
      ctx.strokeStyle = card.accent + '33'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = card.val
      ctx.font = font(28, '900')
      ctx.textBaseline = 'top'
      ctx.fillText(card.value, x + 14, cardY + 14)

      ctx.fillStyle = card.accent
      ctx.font = font(9, '800')
      ctx.fillText(card.label, x + 14, cardY + 50)

      ctx.fillStyle = '#64748b'
      ctx.font = font(9, '600')
      ctx.fillText(card.sub, x + 14, cardY + 66)
    })

    // --- gráfico sparkline ---
    const chartY = cardY + cardH / S + gap / S
    roundRect(ctx, pad / S, chartY, W1 - (pad / S) * 2, chartH / S, 14)
    ctx.fillStyle = '#0f1f38'
    ctx.fill()
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 1
    ctx.stroke()

    // título do gráfico
    ctx.fillStyle = '#64748b'
    ctx.font = font(9, '800')
    ctx.textBaseline = 'top'
    ctx.fillText('TENDÊNCIA NC', pad / S + 14, chartY + 14)
    ctx.fillStyle = '#475569'
    ctx.font = font(9, '600')
    ctx.fillText(`Últimas ${semanas.length} semanas`, pad / S + 14, chartY + 28)

    if (semanas.length >= 2) {
      const maxNc = Math.max(...semanas.map((s) => s.nc), 1)
      const gx0 = pad / S + 44, gx1 = W1 - pad / S - 14
      const gy0 = chartY + 50, gy1 = chartY + chartH / S - 30
      const gW = gx1 - gx0, gH = gy1 - gy0

      const xs = semanas.map((_, i) => gx0 + (i / (semanas.length - 1)) * gW)
      const ys = semanas.map((s) => gy0 + (1 - s.nc / maxNc) * gH)

      // grid lines
      ctx.strokeStyle = 'rgba(148,163,184,0.08)'
      ctx.lineWidth = 1
      for (let t = 0; t <= 4; t++) {
        const y = gy0 + (t / 4) * gH
        const val = Math.round(maxNc * (1 - t / 4))
        ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); ctx.stroke()
        ctx.fillStyle = 'rgba(148,163,184,0.4)'
        ctx.font = font(9, '600')
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'right'
        ctx.fillText(String(val), gx0 - 6, y)
      }

      // labels eixo X
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      semanas.forEach((s, i) => {
        if (i === 0 || i === semanas.length - 1 || i === Math.floor(semanas.length / 2)) {
          ctx.fillStyle = 'rgba(148,163,184,0.5)'
          ctx.font = font(9, '600')
          ctx.fillText(s.label, xs[i]!, gy1 + 8)
        }
      })

      // área preenchida
      const grad = ctx.createLinearGradient(0, gy0, 0, gy1)
      grad.addColorStop(0, 'rgba(239,68,68,0.25)')
      grad.addColorStop(1, 'rgba(239,68,68,0)')
      ctx.beginPath()
      ctx.moveTo(xs[0]!, ys[0]!)
      for (let i = 1; i < xs.length; i++) {
        const cpx = (xs[i - 1]! + xs[i]!) / 2
        ctx.bezierCurveTo(cpx, ys[i - 1]!, cpx, ys[i]!, xs[i]!, ys[i]!)
      }
      ctx.lineTo(xs[xs.length - 1]!, gy1)
      ctx.lineTo(xs[0]!, gy1)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // linha
      ctx.beginPath()
      ctx.moveTo(xs[0]!, ys[0]!)
      for (let i = 1; i < xs.length; i++) {
        const cpx = (xs[i - 1]! + xs[i]!) / 2
        ctx.bezierCurveTo(cpx, ys[i - 1]!, cpx, ys[i]!, xs[i]!, ys[i]!)
      }
      ctx.strokeStyle = 'rgb(239,68,68)'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      // pontos
      xs.forEach((x, i) => {
        if (i === 0 || i === xs.length - 1) {
          ctx.beginPath()
          ctx.arc(x, ys[i]!, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgb(239,68,68)'
          ctx.fill()
        }
      })

      // badge tendência
      const ultima = semanas[semanas.length - 1]!
      const penultima = semanas[semanas.length - 2]!
      const tend = ultima.nc > penultima.nc ? '↑ Em alta' : ultima.nc < penultima.nc ? '↓ Em queda' : '→ Estável'
      const tendColor = ultima.nc > penultima.nc ? '#f87171' : ultima.nc < penultima.nc ? '#4ade80' : '#94a3b8'
      const tendBg = ultima.nc > penultima.nc ? 'rgba(239,68,68,0.15)' : ultima.nc < penultima.nc ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)'
      ctx.font = font(9, '800')
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      const badgeW = ctx.measureText(tend).width + 16
      roundRect(ctx, gx1 - badgeW - 60, chartY + 10, badgeW, 20, 10)
      ctx.fillStyle = tendBg
      ctx.fill()
      ctx.fillStyle = tendColor
      ctx.fillText(tend, gx1 - 60 - 8, chartY + 15)

      ctx.fillStyle = '#f87171'
      ctx.font = font(18, '900')
      ctx.textAlign = 'right'
      ctx.fillText(String(ultima.nc), gx1, chartY + 8)
      ctx.fillStyle = '#64748b'
      ctx.font = font(8, '700')
      ctx.fillText('ESTA SEMANA', gx1, chartY + 30)
    }

    // download
    const periodo = dataInicio && dataFim
      ? `${dataInicio}_a_${dataFim}`
      : dataInicio ? `a_partir_de_${dataInicio}`
      : dataFim ? `ate_${dataFim}`
      : 'todos'
    const link = document.createElement('a')
    link.download = `checklists_${periodo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setCapturando(false)
  }

  const filtrados = rows  // filtro de texto já vai pro servidor
  const totalNc = filtrados.reduce((acc, r) => acc + r.nc_count, 0)

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/gerenciar/checklists"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">
              <ClipboardList size={18} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Resultados dos Checklists
              </div>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Checklists enviados pelos operadores
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCapturar()}
            disabled={capturando || carregando}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            title="Baixar imagem dos cards e gráfico"
          >
            <Image size={16} className={capturando ? 'animate-pulse' : ''} />
            {capturando ? 'Gerando...' : 'Capturar'}
          </button>
          <button
            type="button"
            onClick={() => void handleExportar()}
            disabled={exportando || carregando}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <Download size={16} className={exportando ? 'animate-bounce' : ''} />
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      {(() => {
        const comNc = totalComNc
        const semNc = totalSemNc
        const taxaNc = totalRegistros > 0 ? Math.round((comNc / totalRegistros) * 100) : 0
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalRegistros}</div>
                  <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Checklists
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <ClipboardList size={17} className="text-slate-500 dark:text-slate-400" />
                </div>
              </div>
              <div className="mt-2 text-[10px] font-semibold text-slate-400">no período filtrado</div>
            </div>

            {/* Aprovados */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-soft dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{semNc}</div>
                  <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                    Conformes
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <CheckCircle2 size={17} className="text-emerald-500" />
                </div>
              </div>
              <div className="mt-2 text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-500/60">todos conformes</div>
            </div>

            {/* Checklists com NC */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-soft dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{comNc}</div>
                  <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-500">
                    Sem Impedimento
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle size={17} className="text-amber-500" />
                </div>
              </div>
              <div className="mt-2 text-[10px] font-semibold text-amber-600/70 dark:text-amber-500/60">{taxaNc}% dos checklists</div>
            </div>

            {/* Total de itens NC */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-soft dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{totalNc}</div>
                  <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-500">
                    Com Impedimento
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 dark:bg-rose-900/40">
                  <CalendarCheck2 size={17} className="text-rose-500" />
                </div>
              </div>
              <div className="mt-2 text-[10px] font-semibold text-rose-600/70 dark:text-rose-500/60">
                {comNc > 0 ? `~${(totalNc / comNc).toFixed(1)} por checklist` : 'nenhum'}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Sparkline de tendência NC */}
      <Sparkline semanas={semanas} />

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtros</span>
          <button
            type="button"
            onClick={() => setFiltrosVisiveis((v) => {
              const next = !v
              try { localStorage.setItem('frota.filtros.checklists', String(next)) } catch { /* ignore */ }
              return next
            })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-transparent px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600/60 dark:text-slate-200 dark:hover:bg-white/5"
          >
            {filtrosVisiveis
              ? <><ChevronUp size={13} className="text-slate-400" /> Ocultar filtros</>
              : <><ChevronDown size={13} className="text-slate-400" /> Mostrar filtros</>
            }
          </button>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filtrosVisiveis ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
              {/* linha 1: busca + tipo + toggle NC */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Operador, matrícula ou placa..."
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                </div>

                <SelectCustom
                  value={tipoFiltro}
                  onChange={(v) => { setTipoFiltro(v); setPaginaAtual(1) }}
                  options={TIPOS.map((t) => ({ value: t.id, label: t.label }))}
                  placeholder="Todos"
                />

                <button
                  type="button"
                  onClick={() => { setSomenteNc((v) => !v); setPaginaAtual(1) }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-extrabold transition-all duration-150 active:scale-95 ${
                    somenteNc
                      ? 'border-rose-300 bg-rose-50 text-rose-600 shadow-sm shadow-rose-200/60 hover:border-rose-400 hover:bg-rose-100 hover:shadow-rose-300/50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/35'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-800 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle size={14} className={`transition-transform duration-150 ${somenteNc ? 'scale-110' : ''}`} />
                  Somente NC
                </button>
              </div>

              {/* linha 2: datas */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">De</span>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => { setDataInicio(e.target.value); setPaginaAtual(1) }}
                    className="bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Até</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => { setDataFim(e.target.value); setPaginaAtual(1) }}
                    className="bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                </div>
                {(dataInicio || dataFim || tipoFiltro || somenteNc || queryInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicio('')
                      setDataFim('')
                      setTipoFiltro('')
                      setSomenteNc(false)
                      setQueryInput('')
                      setQuery('')
                      setPaginaAtual(1)
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400"
                  >
                    <X size={12} />
                    Limpar filtros
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <CalendarCheck2 size={14} />
                  {totalRegistros.toLocaleString('pt-BR')} resultado{totalRegistros !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        {erro ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle size={32} className="text-rose-400" />
            <p className="text-sm font-extrabold text-rose-500">{erro}</p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
            >
              Tentar novamente
            </button>
          </div>
        ) : carregando ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                  {(
                    [
                      { label: 'Operador', col: 'nome_operador' as OrdemCol },
                      { label: 'Tipo',     col: null },
                      { label: 'Placa',    col: null },
                      { label: 'Data / Hora', col: 'data_inspecao' as OrdemCol },
                      { label: 'Resultado',col: 'nc_count' as OrdemCol },
                    ] as { label: string; col: OrdemCol | null }[]
                  ).map(({ label, col }) => (
                    <th key={label} className="px-4 py-3">
                      {col ? (
                        <button
                          type="button"
                          onClick={() => toggleOrdem(col)}
                          className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          {label}
                          {ordemCol === col
                            ? (ordemDir === 'desc'
                              ? <ChevronDown size={12} className="text-blue-500" />
                              : <ChevronUp size={12} className="text-blue-500" />)
                            : <ArrowUpDown size={11} className="opacity-40" />}
                        </button>
                      ) : label}
                    </th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-slate-200">
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-sm font-semibold text-slate-400">
                      Nenhum checklist encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((row) => (
                    <LinhaChecklist
                      key={row.id}
                      row={row}
                      onVerDetalhe={() => setDetalhe(row)}
                      onApagar={podeGerenciar ? () => setConfirmDelete(row) : undefined}
                      onEditar={podeGerenciar ? () => setEditando(row) : undefined}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && !carregando && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => irParaPagina(paginaAtual - 1)}
            disabled={paginaAtual === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          {(() => {
            const pages: (number | '...')[] = []
            if (totalPaginas <= 7) {
              for (let i = 1; i <= totalPaginas; i++) pages.push(i)
            } else {
              pages.push(1)
              if (paginaAtual > 3) pages.push('...')
              for (let i = Math.max(2, paginaAtual - 1); i <= Math.min(totalPaginas - 1, paginaAtual + 1); i++) pages.push(i)
              if (paginaAtual < totalPaginas - 2) pages.push('...')
              pages.push(totalPaginas)
            }
            return pages.map((p, i) =>
              p === '...'
                ? <span key={`e${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-slate-400 dark:text-slate-600">…</span>
                : <button
                    key={p}
                    type="button"
                    onClick={() => irParaPagina(p as number)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-extrabold transition ${
                      p === paginaAtual
                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'
                    }`}
                  >
                    {p}
                  </button>
            )
          })()}

          <button
            type="button"
            onClick={() => irParaPagina(paginaAtual + 1)}
            disabled={paginaAtual === totalPaginas}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Próxima página"
          >
            <ChevronRight size={16} />
          </button>

          <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            Pág. {paginaAtual} de {totalPaginas.toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {detalhe && <ModalDetalhe row={detalhe} onClose={() => setDetalhe(null)} />}

      {editando && (
        <ModalEditar
          row={editando}
          onClose={() => setEditando(null)}
          onSalvo={(updated) => {
            setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r))
            setEditando(null)
          }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <Trash2 size={18} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <div className="text-base font-black text-slate-900 dark:text-slate-100">Apagar checklist?</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</div>
              </div>
            </div>
            <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{confirmDelete.nome_operador}</div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {TIPO_BADGE[confirmDelete.tipo]?.label ?? confirmDelete.tipo} · {formatPlaca(confirmDelete.dados_veiculo?.placa ?? '') || '—'} · {formatDateBR(confirmDelete.data_inspecao)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={apagando}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void apagarChecklist(confirmDelete)}
                disabled={apagando}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {apagando ? 'Apagando...' : 'Sim, apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
