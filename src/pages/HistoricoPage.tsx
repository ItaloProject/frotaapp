import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarCheck2, ChevronLeft, ChevronRight, FileDown, History, Search, TrendingUp, Truck, X } from 'lucide-react'
import { useApontamentos, type Apontamento } from '../apontamentos/ApontamentosContext'
import { formatDefeitoParaExibicao } from '../apontamentos/defeitoExibicao'
import { buildHistoricoResolvidoEntries, type HistoricoResolvidoEntry } from '../apontamentos/groupApontamentos'
import { Portal } from '../components/ui/Portal'
import { Select } from '../components/ui/Select'
import { BASE_FILTER_SELECT_OPTIONS, matchesBaseFilter } from '../data/baseFilterOptions'
import { COORDENADOR_FILTER_SELECT_OPTIONS, matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'

function DefeitoSeveridadeIcon({ imperativo, size = 14 }: { imperativo: boolean; size?: number }) {
  if (imperativo) {
    return (
      <span
        title="Impeditivo — impede condução do veículo"
        className="inline-flex shrink-0 leading-none select-none"
        style={{ fontSize: size }}
        aria-hidden
      >
        🚫
      </span>
    )
  }
  return (
    <span title="Não impeditivo — precisa de atenção" className="inline-flex shrink-0">
      <AlertCircle size={size} className="text-amber-600 dark:text-amber-400" aria-hidden />
    </span>
  )
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoneyBRL(v: number | null) {
  if (v == null || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/** Ordenação do histórico: data + hora local da resolução (mais recente primeiro). */
function resolvedAtMs(dataResolvido: string, horaResolvido: string | null): number {
  const [yy, mm, dd] = dataResolvido.split('-').map(Number)
  let hh = 0
  let min = 0
  const h = horaResolvido?.trim()
  if (h) {
    const p = h.split(':').map(Number)
    hh = p[0] ?? 0
    min = p[1] ?? 0
  }
  return new Date(yy || 1970, (mm || 1) - 1, dd || 1, hh, min, 0, 0).getTime()
}

function fileSafeName(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

async function dataUrlToJpeg(dataUrl: string): Promise<{ data: string; w: number; h: number }> {
  const img = new Image()
  img.decoding = 'async'
  img.src = dataUrl
  await img.decode()
  const maxW = 1600
  const scale = img.width > maxW ? maxW / img.width : 1
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { data: dataUrl, w: img.width, h: img.height }
  ctx.drawImage(img, 0, 0, w, h)
  const jpg = canvas.toDataURL('image/jpeg', 0.88)
  return { data: jpg, w, h }
}

async function urlToPngData(url: string): Promise<{ data: string; w: number; h: number }> {
  // Fetch first so the canvas doesn't get tainted by cross-origin img elements
  let dataUrl: string
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    // Fallback: load as img without crossOrigin (works for display, may taint canvas)
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { data: url, w: img.width, h: img.height }
    ctx.drawImage(img, 0, 0)
    return { data: canvas.toDataURL('image/png'), w: img.width, h: img.height }
  }
  const img = new Image()
  img.decoding = 'async'
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { data: dataUrl, w: img.width, h: img.height }
  ctx.drawImage(img, 0, 0)
  return { data: canvas.toDataURL('image/png'), w: img.width, h: img.height }
}

/** Data URL (reparo) ou URL http(s) (fotos da NC no storage) → raster para jsPDF. */
async function rasterSrcForPdf(src: string): Promise<{ data: string; kind: 'JPEG' | 'PNG'; w: number; h: number }> {
  const s = src.trim()
  if (!s) throw new Error('empty src')
  if (s.startsWith('data:')) {
    const jpeg = await dataUrlToJpeg(s)
    return { data: jpeg.data, kind: 'JPEG', w: jpeg.w, h: jpeg.h }
  }
  const png = await urlToPngData(s)
  return { data: png.data, kind: 'PNG', w: png.w, h: png.h }
}

function dataUrlMime(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;,]+)/)
  return m?.[1] ?? ''
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const b64 = dataUrl.slice(comma + 1)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function ensurePngOrJpegDataUrl(dataUrl: string): Promise<{ bytes: Uint8Array; mime: 'png' | 'jpeg' }> {
  const mime = dataUrlMime(dataUrl)
  if (mime === 'image/png') return { bytes: dataUrlToBytes(dataUrl), mime: 'png' }
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { bytes: dataUrlToBytes(dataUrl), mime: 'jpeg' }
  // Outros formatos (webp, gif…): converter para JPEG via canvas
  const { data } = await dataUrlToJpeg(dataUrl)
  return { bytes: dataUrlToBytes(data), mime: 'jpeg' }
}

async function mergeOsIntoReport(reportBytes: ArrayBuffer, osDataUrl: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.load(reportBytes)
  const mime = dataUrlMime(osDataUrl)

  if (mime === 'application/pdf') {
    const osPdf = await PDFDocument.load(dataUrlToBytes(osDataUrl))
    const copied = await merged.copyPages(osPdf, osPdf.getPageIndices())
    copied.forEach((p) => merged.addPage(p))
  } else {
    // Imagem → nova página A4 centralizada
    const pageW = 595.28
    const pageH = 841.89
    const margin = 28
    const { bytes, mime: imgMime } = await ensurePngOrJpegDataUrl(osDataUrl)
    const img = imgMime === 'png' ? await merged.embedPng(bytes) : await merged.embedJpg(bytes)
    const { width, height } = img
    const scale = Math.min((pageW - margin * 2) / width, (pageH - margin * 2) / height, 1)
    const drawW = width * scale
    const drawH = height * scale
    const page = merged.addPage([pageW, pageH])
    page.drawImage(img, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    })
  }

  return merged.save()
}

export function HistoricoPage() {
  const { rows } = useApontamentos()
  const [query, setQuery] = useState('')
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [imgOpen, setImgOpen] = useState<string | null>(null)
  const [base, setBase] = useState('todos')
  const [coordenador, setCoordenador] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 25

  const historico = useMemo(() => {
    const q = query.trim().toLowerCase()
    const parseMoney = (s: string) => {
      const t = s.trim()
      if (!t) return null
      const n = Number(t.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    const min = parseMoney(valorMin)
    const max = parseMoney(valorMax)

    let list = buildHistoricoResolvidoEntries(rows)
    if (q) {
      list = list.filter(
        (e) =>
          e.representative.defeito.toLowerCase().includes(q) ||
          e.representative.veiculoLabel.toLowerCase().includes(q),
      )
    }
    if (min != null || max != null) {
      list = list.filter((e) => {
        const v = e.representative.reparoValor
        if (v == null || !Number.isFinite(v)) return false
        if (min != null && v < min) return false
        if (max != null && v > max) return false
        return true
      })
    }
    if (dataInicio) {
      list = list.filter((e) => e.dataResolvido >= dataInicio)
    }
    if (dataFim) {
      list = list.filter((e) => e.dataResolvido <= dataFim)
    }
    if (base !== 'todos') list = list.filter((e) => matchesBaseFilter(e.representative.base, base))
    if (coordenador !== 'todos') list = list.filter((e) => matchesCoordenadorFilter(e.representative.coordenador, coordenador))
    return [...list].sort((a, b) => {
      const tb = resolvedAtMs(b.dataResolvido, b.representative.horaResolvido)
      const ta = resolvedAtMs(a.dataResolvido, a.representative.horaResolvido)
      if (tb !== ta) return tb - ta
      return b.key.localeCompare(a.key)
    })
  }, [rows, query, valorMin, valorMax, dataInicio, dataFim, base, coordenador])

  const totalGastoHistorico = useMemo(() => {
    let s = 0
    for (const e of historico) {
      const v = e.representative.reparoValor
      if (v != null && Number.isFinite(v)) s += v
    }
    return s
  }, [historico])

  const totalPaginas = Math.max(1, Math.ceil(historico.length / PAGE_SIZE))
  const paginaRows = historico.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  const apontamentoParaPdf = (e: HistoricoResolvidoEntry): Apontamento => ({
    ...e.representative,
    dataApontamento: e.dataPrimeiroApontamento,
  })

  const gerarPdf = async (e: HistoricoResolvidoEntry) => {
    const r = apontamentoParaPdf(e)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    const margin = 40
    let y = margin

    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

    const FONT = {
      tiny: 9,
      sm: 10,
      base: 11,
      md: 12,
      lg: 14,
      h3: 16,
      h2: 18,
      h1: 20,
      title: 22,
    } as const

    const fitOneLine = (text: string, maxW: number, maxSize: number, minSize = 9) => {
      let size = maxSize
      doc.setFontSize(size)
      while (size > minSize && doc.getTextWidth(text) > maxW) {
        size -= 1
        doc.setFontSize(size)
      }
      return size
    }

    const drawWrapped = (opts: {
      text: string
      x: number
      y: number
      maxW: number
      fontSize: number
      lineH: number
      align?: 'left' | 'center' | 'right'
      maxLines?: number
    }) => {
      const align = opts.align ?? 'left'
      doc.setFontSize(opts.fontSize)
      const lines = doc.splitTextToSize(opts.text, opts.maxW) as string[]
      const sliced = typeof opts.maxLines === 'number' ? lines.slice(0, opts.maxLines) : lines
      for (let i = 0; i < sliced.length; i += 1) {
        doc.text(sliced[i]!, opts.x, opts.y + i * opts.lineH, { align, maxWidth: opts.maxW })
      }
      return sliced.length * opts.lineH
    }

    const icon = {
      calendar: (x: number, y: number, s: number) => {
        doc.setDrawColor(140)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(x, y, s, s, 3, 3, 'FD')
        doc.setFillColor(200, 200, 200)
        doc.rect(x, y, s, s * 0.28, 'F')
        doc.setDrawColor(140)
        doc.line(x + s * 0.25, y + s * 0.12, x + s * 0.25, y - 1)
        doc.line(x + s * 0.75, y + s * 0.12, x + s * 0.75, y - 1)
      },
      check: (x: number, y: number, s: number) => {
        doc.setDrawColor(30, 120, 60)
        doc.setFillColor(45, 170, 90)
        doc.circle(x + s / 2, y + s / 2, s / 2, 'FD')
        doc.setDrawColor(255)
        doc.setLineWidth(2)
        doc.line(x + s * 0.28, y + s * 0.52, x + s * 0.44, y + s * 0.68)
        doc.line(x + s * 0.44, y + s * 0.68, x + s * 0.74, y + s * 0.34)
        doc.setLineWidth(1)
      },
      clock: (x: number, y: number, s: number) => {
        doc.setDrawColor(150)
        doc.setFillColor(255, 255, 255)
        doc.circle(x + s / 2, y + s / 2, s / 2, 'FD')
        doc.setDrawColor(140)
        doc.line(x + s / 2, y + s / 2, x + s / 2, y + s * 0.28)
        doc.line(x + s / 2, y + s / 2, x + s * 0.72, y + s * 0.58)
      },
      money: (x: number, y: number, s: number) => {
        doc.setDrawColor(160, 120, 40)
        doc.setFillColor(245, 210, 120)
        doc.circle(x + s / 2, y + s / 2, s / 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(Math.max(8, Math.round(s * 0.6)))
        doc.setTextColor(120, 80, 20)
        doc.text('$', x + s / 2, y + s * 0.72, { align: 'center' })
        doc.setTextColor(0)
      },
    } as const

    const parseIsoParts = (iso: string) => {
      const [yy, mm, dd] = iso.split('-').map(Number)
      return { yy: yy || 1970, mm: mm || 1, dd: dd || 1 }
    }
    const daysBetweenIso = (a: string, b: string) => {
      const pa = parseIsoParts(a)
      const pb = parseIsoParts(b)
      const da = new Date(pa.yy, pa.mm - 1, pa.dd).getTime()
      const db = new Date(pb.yy, pb.mm - 1, pb.dd).getTime()
      const diff = Math.round((db - da) / (1000 * 60 * 60 * 24))
      return Number.isFinite(diff) ? Math.max(0, diff) : 0
    }
    const parseVeiculoLabel = (label: string) => {
      const parts = label.split('·').map((s) => s.trim()).filter(Boolean)
      if (parts.length >= 2) return { id: parts[0]!, placa: parts.slice(1).join(' · ') }
      const parts2 = label.split('-').map((s) => s.trim()).filter(Boolean)
      if (parts2.length >= 2) return { id: parts2[0]!, placa: parts2.slice(1).join(' - ') }
      return { id: label.trim(), placa: label.trim() }
    }

    const geradoEm = `Gerado em: ${new Date().toLocaleString('pt-BR')}`
    const { id: veiculoId, placa } = parseVeiculoLabel(r.veiculoLabel)
    const inicioIso = r.dataApontamento
    const entregaIso = r.dataResolvido || r.dataApontamento
    const duracao = daysBetweenIso(inicioIso, entregaIso)
    const custo = formatMoneyBRL(r.reparoValor)
    const servico = (r.reparoDescricao ?? '').trim()

    // Header: logo (esquerda), "Gerado em" (direita) e título central (como exemplo)
    const headerTop = y
    let logoW = 0
    let logoH = 0
    try {
      const logo = await urlToPngData('/images/a4c8c162-f15e-4de4-b0c7-1806b3f4a3ee.png')
      const maxH = 48
      const ratio = maxH / Math.max(1, logo.h)
      logoW = Math.max(1, Math.round(logo.w * ratio))
      logoH = Math.max(1, Math.round(logo.h * ratio))
      doc.addImage(logo.data, 'PNG', margin, headerTop, logoW, logoH)
    } catch {
      // segue sem logo
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT.sm)
    doc.setTextColor(60)
    doc.text(geradoEm, pageW - margin, headerTop + 12, { align: 'right' })
    doc.setTextColor(0)

    // Subtítulo sob o logo (sem sobrepor)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT.base)
    doc.setTextColor(80)
    doc.text('FrotaApp — Manutenção', margin, headerTop + logoH + 16)
    doc.setTextColor(0)

    // Título centralizado no espaço à direita do logo (evita sobreposição)
    doc.setFont('helvetica', 'bold')
    const title = 'RELATÓRIO DE CORREÇÃO'
    const safeLeft = margin + (logoW > 0 ? logoW + 18 : 180)
    const safeRight = pageW - margin
    const titleMaxW = Math.max(120, safeRight - safeLeft)
    fitOneLine(title, titleMaxW, FONT.title, 14)
    // um pouco mais para baixo (como solicitado)
    doc.text(title, (safeLeft + safeRight) / 2, headerTop + 42, { align: 'center' })

    // Começo do conteúdo abaixo do header (garante não colidir com o logo/subtítulo)
    y = headerTop + Math.max(logoH + 34, 78)

    const reportId = (() => {
      const p = parseIsoParts(entregaIso)
      const suffix = (r.prefixo || veiculoId || r.id).toString().slice(-3)
      return `#${p.yy}-${String(p.mm).padStart(2, '0')}-${suffix.padStart(3, '0')}`
    })()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT.h3)
    const sub = `Relatório de Correção e Manutenção de Veículos ${reportId}`
    const subH = drawWrapped({
      text: sub,
      x: margin,
      y,
      maxW: pageW - margin * 2,
      fontSize: FONT.h3,
      lineH: 18,
      align: 'left',
      maxLines: 2,
    })
    y += subH - 2

    // Badge / Status
    const badgeH = 34
    const badgeX = margin
    const badgeW = pageW - margin * 2
    doc.setDrawColor(200)
    doc.setFillColor(232, 245, 236) // leve esverdeado como o modelo
    doc.roundedRect(badgeX, y, badgeW, badgeH, 10, 10, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT.md)
    doc.setTextColor(30)
    doc.text('Badge', badgeX + 12, y + 22)

    const statusText = 'STATUS: FINALIZADO'
    const statusBoxW = 210
    doc.setFillColor(205, 235, 206)
    doc.setDrawColor(170)
    doc.roundedRect(badgeX + 110, y + 6, statusBoxW, badgeH - 12, 8, 8, 'FD')
    doc.setTextColor(25, 80, 35)
    doc.text(statusText, badgeX + 110 + statusBoxW / 2, y + 22, { align: 'center' })
    doc.setTextColor(30)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40)
    doc.text('(Concluído)', badgeX + 110 + statusBoxW + 10, y + 22)
    doc.setTextColor(0)
    y += badgeH + 12

    // Caixa dupla: Informações do veículo / Dados da manutenção
    const boxX = margin
    const boxW = pageW - margin * 2
    const boxH = 110
    if (y + boxH + 12 > pageH) {
      doc.addPage()
      y = margin
    }
    doc.setDrawColor(200)
    doc.setFillColor(248, 249, 251)
    doc.roundedRect(boxX, y, boxW, boxH, 10, 10, 'FD')
    doc.setFillColor(232, 245, 236) // header verde claro
    doc.roundedRect(boxX, y, boxW, 26, 10, 10, 'F')
    // linha do meio
    doc.setDrawColor(210)
    doc.line(boxX + boxW / 2, y, boxX + boxW / 2, y + boxH)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(60)
    doc.text('INFORMAÇÕES DO VEÍCULO', boxX + boxW / 4, y + 18, { align: 'center' })
    doc.text('DADOS DA MANUTENÇÃO', boxX + (boxW * 3) / 4, y + 18, { align: 'center' })
    doc.setTextColor(0)

    const leftXBox = boxX + 14
    const rightXBox = boxX + boxW / 2 + 14
    const line1 = y + 44
    const line2 = y + 60
    const line3 = y + 76

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(40)
    doc.text('ID:', leftXBox, line1)
    doc.text('Placa:', leftXBox, line2)
    doc.text('Modelo:', leftXBox, line3)
    doc.text('Defeito:', rightXBox, line1)
    doc.text('Tipo:', rightXBox, line2)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(veiculoId, leftXBox + 34, line1)
    doc.text(placa, leftXBox + 46, line2)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(r.modelo || '—', leftXBox + 58, line3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const defectX = rightXBox + 54
    const defectW = boxW / 2 - 80
    const defectLines = doc.splitTextToSize(formatDefeitoParaExibicao(r.defeito), defectW) as string[]
    const used = defectLines.slice(0, 2)
    doc.text(used, defectX, line1, { maxWidth: defectW })
    const defectExtra = clamp(used.length - 1, 0, 1) * 12
    doc.text('Manutenção Corretiva', rightXBox + 34, line2 + defectExtra)
    doc.setFont('helvetica', 'normal')
    y += boxH + 10

    // Cronologia
    const secH = 34
    doc.setDrawColor(200)
    doc.setFillColor(248, 249, 251)
    doc.roundedRect(margin, y, pageW - margin * 2, secH, 10, 10, 'FD')
    doc.setFillColor(235, 238, 242)
    doc.roundedRect(margin, y, 110, secH, 10, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT.md)
    doc.setTextColor(30)
    doc.text('Cronologia', margin + 14, y + 22)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT.sm)
    doc.setTextColor(30)
    const baseX = margin + 120
    const secW = pageW - margin * 2 - 120
    const segW = secW / 3
    const iS = 14
    const iconY = y + (secH - iS) / 2 + 1
    const padX = 10
    const seg0 = baseX + segW * 0
    const seg1 = baseX + segW * 1
    const seg2 = baseX + segW * 2
    icon.calendar(seg0 + padX, iconY, iS)
    const tPad = padX + iS + 8
    const tW = segW - tPad - 10
    const tY = y + 22
    const t0 = `Início: ${formatDateBR(inicioIso)}`
    const t1 = `Entrega: ${formatDateBR(entregaIso)}`
    const t2 = `Duração: ${duracao} dias`
    doc.setFont('helvetica', 'normal')
    fitOneLine(t0, tW, FONT.sm, 8)
    doc.text(t0, seg0 + tPad, tY)
    icon.check(seg1 + padX, iconY, iS)
    doc.setFont('helvetica', 'normal')
    fitOneLine(t1, tW, FONT.sm, 8)
    doc.text(t1, seg1 + tPad, tY)
    icon.clock(seg2 + padX, iconY, iS)
    doc.setFont('helvetica', 'normal')
    fitOneLine(t2, tW, FONT.sm, 8)
    doc.text(t2, seg2 + tPad, tY)
    doc.setTextColor(0)
    y += secH + 10

    // Financeiro
    doc.setDrawColor(200)
    doc.setFillColor(248, 249, 251)
    doc.roundedRect(margin, y, pageW - margin * 2, secH, 10, 10, 'FD')
    doc.setFillColor(235, 238, 242)
    doc.roundedRect(margin, y, 110, secH, 10, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT.md)
    doc.setTextColor(30)
    doc.text('Financeiro', margin + 14, y + 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT.base)
    const finX = margin + 140
    const finW = pageW - margin * 2 - 140
    const left = `Custo Total: ${custo}`
    const right = '(Inclui: Peças e Mão de Obra)'
    const leftW = Math.min(190, finW * 0.45)
    icon.money(finX - 24, y + 12, 14)
    doc.text(left, finX, y + 22, { maxWidth: leftW })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    doc.text(right, finX + leftW + 10, y + 22, { maxWidth: finW - leftW - 10 })
    doc.setTextColor(0)
    y += secH + 34

    // Serviço executado (opcional)
    if (servico) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(30)
      doc.text('Serviço executado', margin, y)
      doc.setTextColor(0)
      y += 12

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(40)
      const usedH = drawWrapped({
        text: servico,
        x: margin,
        y: y + 10,
        maxW: pageW - margin * 2,
        fontSize: 11,
        lineH: 14,
        align: 'left',
        maxLines: 6,
      })
      doc.setTextColor(0)
      y += usedH + 18
    }

    // Evidências: duas colunas — esquerda defeito (antes) · direita corrigido (depois)
    const maxEvidenceEach = 3
    const antes = (r.ncFotos ?? []).filter(Boolean).slice(0, maxEvidenceEach)
    const depois = (r.reparoImagens ?? []).filter(Boolean).slice(0, maxEvidenceEach)
    const colMiddleGap = 14
    const colW = (pageW - margin * 2 - colMiddleGap) / 2
    const leftX = margin
    const rightX = margin + colW + colMiddleGap
    const rowH = 152
    const rowGap = 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30)
    doc.text('Evidências', margin, y)
    doc.setTextColor(0)
    y += 18

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(55)
    const headY = y
    doc.text('Antes (defeito)', leftX + colW / 2, headY, { align: 'center' })
    doc.text('Depois (corrigido)', rightX + colW / 2, headY, { align: 'center' })
    doc.setTextColor(0)
    y = headY + 16

    const drawEvidenceCell = async (src: string | undefined, x0: number, top: number, emptyMsg: string) => {
      doc.setDrawColor(210)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x0, top, colW, rowH, 10, 10, 'FD')
      if (!src) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(150)
        doc.text(emptyMsg, x0 + colW / 2, top + rowH / 2, { align: 'center' })
        doc.setTextColor(0)
        doc.setFont('helvetica', 'normal')
        return
      }
      try {
        const raster = await rasterSrcForPdf(src)
        const ratio = Math.min((colW - 16) / raster.w, (rowH - 16) / raster.h)
        const iw = raster.w * ratio
        const ih = raster.h * ratio
        const ix = x0 + (colW - iw) / 2
        const iy = top + (rowH - ih) / 2
        doc.addImage(raster.data, raster.kind, ix, iy, iw, ih)
      } catch {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(140)
        doc.text('Imagem indisponível.', x0 + colW / 2, top + rowH / 2, { align: 'center' })
        doc.setTextColor(0)
        doc.setFont('helvetica', 'normal')
      }
    }

    const hasAny = antes.length > 0 || depois.length > 0
    const nRows = hasAny ? Math.max(antes.length, depois.length) : 1

    for (let row = 0; row < nRows; row += 1) {
      if (y + rowH + 30 > pageH) {
        doc.addPage()
        y = margin
      }
      const top = y
      const leftSrc = hasAny ? antes[row] : undefined
      const rightSrc = hasAny ? depois[row] : undefined
      await drawEvidenceCell(
        hasAny ? leftSrc : undefined,
        leftX,
        top,
        hasAny ? 'Sem foto nesta posição.' : 'Sem fotos da não conformidade registradas.',
      )
      await drawEvidenceCell(
        hasAny ? rightSrc : undefined,
        rightX,
        top,
        hasAny ? 'Sem foto nesta posição.' : 'Sem imagens anexadas na resolução.',
      )
      y = top + rowH + rowGap
    }
    y += 12

    // Rodapé com paginação
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 22, { align: 'right' })
      doc.setTextColor(0)
    }

    const fileName = `relatorio-${fileSafeName(`${r.prefixo}-${formatDefeitoParaExibicao(r.defeito)}-${r.dataResolvido ?? ''}`) || r.id}.pdf`

    if (r.osArquivo) {
      const reportBytes = doc.output('arraybuffer') as ArrayBuffer
      const mergedBytes = await mergeOsIntoReport(reportBytes, r.osArquivo)
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      doc.save(fileName)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/gerenciar"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Voltar para Gerenciar"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">
              <History size={18} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Histórico
              </div>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Data do apontamento e data em que o defeito foi resolvido
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Link
            to="/gerenciar/evolucao"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <TrendingUp size={18} aria-hidden />
            Evolução
          </Link>
        </div>
      </div>

      <div data-tour="historico-lista" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div data-tour="historico-filtros" className="mb-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Select label="Base" value={base} options={BASE_FILTER_SELECT_OPTIONS} onChange={(v) => { setBase(v); setPagina(1) }} />
          <Select label="Gerência" value={coordenador} options={COORDENADOR_FILTER_SELECT_OPTIONS} onChange={(v) => { setCoordenador(v); setPagina(1) }} />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-3xl sm:flex-row sm:items-center">
            <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPagina(1) }}
                placeholder="Buscar por defeito ou veículo..."
                className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex w-full max-w-md items-center gap-2">
              <div className="flex w-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Valor mín.
                </span>
                <input
                  value={valorMin}
                  onChange={(e) => { setValorMin(e.target.value); setPagina(1) }}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div className="flex w-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Valor máx.
                </span>
                <input
                  value={valorMax}
                  onChange={(e) => { setValorMax(e.target.value); setPagina(1) }}
                  inputMode="decimal"
                  placeholder="9999"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-w-[10rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total gasto
              </span>
              <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoneyBRL(totalGastoHistorico)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <CalendarCheck2 size={14} />
              {historico.length} registro(s) resolvido(s)
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              De
            </span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setPagina(1) }}
              className="bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Até
            </span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setPagina(1) }}
              className="bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </div>
          {(dataInicio || dataFim) && (
            <button
              type="button"
              onClick={() => { setDataInicio(''); setDataFim('') }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              <X size={12} aria-hidden />
              Limpar datas
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-[1080px] w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                <th className="px-4 py-3">Veículo</th>
                <th className="px-2 py-3" title="Severidade">Sev.</th>
                <th className="px-4 py-3">Defeito</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Apontado em</th>
                <th className="px-4 py-3">Resolvido em</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Imagens</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-800 dark:text-slate-200">
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Nenhum defeito resolvido no histórico. Marque itens como resolvidos em{' '}
                    <Link to="/gerenciar" className="font-extrabold text-brand-600 underline dark:text-brand-400">
                      Gerenciar
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                paginaRows.map((e) => {
                  const r = e.representative
                  return (
                  <tr
                    key={e.key}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className="inline-flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                            <Truck size={14} />
                          </span>
                          <span className="font-mono text-xs tracking-tight">{r.veiculoLabel}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <DefeitoSeveridadeIcon imperativo={r.imperativo} size={15} />
                    </td>
                    <td className="max-w-[300px] px-4 py-3 text-xs leading-snug sm:text-sm">{formatDefeitoParaExibicao(r.defeito)}</td>
                    <td className="max-w-[340px] px-4 py-3 text-xs leading-snug text-slate-700 dark:text-slate-300 sm:text-sm">
                      {r.reparoDescricao?.trim() ? (
                        r.reparoDescricao
                      ) : (
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                      <div className="flex flex-col items-center gap-1">
                        <span>{formatDateBR(e.dataPrimeiroApontamento)}</span>
                        {e.count > 1 ? (
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                            1º de {e.count} apontamentos
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                      <div className="flex flex-col items-center font-black text-emerald-700 dark:text-emerald-400">
                        <span>{formatDateBR(e.dataResolvido)}</span>
                        {r.horaResolvido ? (
                          <span className="mt-0.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                            {r.horaResolvido}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-900 dark:text-slate-100 sm:text-sm">
                      {formatMoneyBRL(r.reparoValor)}
                    </td>
                    <td className="px-4 py-3">
                      {r.reparoImagens?.length ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <div className="flex flex-wrap justify-center gap-2">
                            {r.reparoImagens.slice(0, 3).map((src, idx) => (
                              <button
                                key={src}
                                type="button"
                                onClick={() => setImgOpen(src)}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm hover:opacity-90 dark:border-slate-800 dark:bg-slate-900/40"
                                aria-label={`Ver imagem ${idx + 1}`}
                              >
                                <img src={src} alt={`Anexo ${idx + 1}`} className="h-10 w-14 object-cover" />
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => void gerarPdf(e)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                            title="Gerar relatório em PDF"
                            aria-label="Gerar relatório em PDF"
                          >
                            <FileDown size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">—</span>
                          <button
                            type="button"
                            onClick={() => void gerarPdf(e)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                            title="Gerar relatório em PDF"
                            aria-label="Gerar relatório em PDF"
                          >
                            <FileDown size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {historico.length === 0 ? 'Nenhum registro' : (
                <>
                  Mostrando{' '}
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">{(pagina - 1) * PAGE_SIZE + 1}</span>
                  {' — '}
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">{Math.min(pagina * PAGE_SIZE, historico.length)}</span>
                  {' de '}
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">{historico.length}</span>
                  {' registro(s)'}
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Página anterior"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <span className="min-w-[7.5rem] px-2 text-center text-xs font-extrabold tabular-nums text-slate-600 dark:text-slate-300">
                {pagina} / {totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Próxima página"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>

      {imgOpen ? (
        <Portal>
          <button
            type="button"
            className="fixed inset-0 z-[9998] bg-black/70"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setImgOpen(null)
            }}
            aria-label="Fechar"
          />
          <div className="fixed inset-0 z-[9999] grid place-items-center p-4">
            <div className="relative max-h-[85vh] w-full max-w-5xl">
              <button
                type="button"
                onClick={() => setImgOpen(null)}
                className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/60 text-white hover:bg-black/75"
                aria-label="Fechar imagem"
              >
                <X size={18} />
              </button>
              <img
                src={imgOpen}
                alt="Anexo ampliado"
                className="max-h-[85vh] w-full rounded-2xl border border-white/10 object-contain shadow-2xl"
              />
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  )
}
