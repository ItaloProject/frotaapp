import type { ChecklistAdherenceEntry } from './checklistTop10Ranking'

export type RankingScreenshotInput = {
  periodoLabel: string
  periodoResumo: string
  diasNoPeriodo: number
  groupLabel: string
  pior: ChecklistAdherenceEntry[]
  melhor: ChecklistAdherenceEntry[]
}

/** Tamanho nativo amplo, mas sem gerar um PNG gigante que fique borrado ao ser reduzido no preview. */
const SCALE = 1
const W = 1920

const L = {
  pad: 48,
  gap: 32,
  arenaH: 150,
  colHeaderH: 88,
  innerPad: 24,
  rowH: 82,
  rowGap: 12,
  podiumListGap: 30,
  podiumH: 240,
  spotlightH: 132,
  radius: 30,
  radiusSm: 18,
} as const

const PODIUM_ORDER = [1, 0, 2] as const
// Mantém os pilares abaixo do bloco medalha/nome/% para evitar sobreposição no PNG exportado.
const MEDAL = [
  { bg: ['#cbd5e1', '#64748b'], text: '#0f172a', label: '2º' },
  { bg: ['#fde68a', '#f59e0b'], text: '#78350f', label: '1º' },
  { bg: ['#fdba74', '#ea580c'], text: '#7c2d12', label: '3º' },
] as const

const FONT = '"Segoe UI", Inter, system-ui, -apple-system, sans-serif'

type Ctx = CanvasRenderingContext2D

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function setFont(ctx: Ctx, size: number, weight: string | number = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

function truncateText(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxW) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

function firstName(label: string): string {
  return label.trim().split(/\s+/)[0] ?? label
}

function fillRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function strokeRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, stroke: string, lineWidth = 1) {
  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawProgressBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  from: string,
  to: string,
) {
  fillRoundRect(ctx, x, y, w, h, h / 2, '#1e293b')
  const fillW = Math.max(h, (w * Math.min(100, Math.max(0, pct))) / 100)
  if (fillW <= h) return
  const grad = ctx.createLinearGradient(x, y, x + fillW, y)
  grad.addColorStop(0, from)
  grad.addColorStop(1, to)
  fillRoundRect(ctx, x, y, fillW, h, h / 2, grad)
}

function drawGlowEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCup(ctx: Ctx, cx: number, cy: number, size: number) {
  const s = size
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = '#78350f'
  ctx.fillStyle = '#78350f'
  ctx.lineWidth = Math.max(2, s * 0.055)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.roundRect(-s * 0.22, -s * 0.23, s * 0.44, s * 0.34, s * 0.08)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(-s * 0.26, -s * 0.08, s * 0.16, Math.PI * 0.75, Math.PI * 1.58)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(s * 0.26, -s * 0.08, s * 0.16, Math.PI * 1.42, Math.PI * 0.25)
  ctx.stroke()

  ctx.fillRect(-s * 0.055, s * 0.09, s * 0.11, s * 0.21)
  ctx.beginPath()
  ctx.roundRect(-s * 0.24, s * 0.28, s * 0.48, s * 0.11, s * 0.05)
  ctx.fill()
  ctx.restore()
}

function drawArenaHeader(ctx: Ctx, x: number, y: number, w: number, h: number, input: RankingScreenshotInput) {
  drawGlowEllipse(ctx, x + 120, y + h / 2, 100, 60, '#10b981')
  drawGlowEllipse(ctx, x + w - 120, y + h / 2, 100, 60, '#f43f5e')

  fillRoundRect(ctx, x, y, w, h, L.radius, '#0f172a')
  strokeRoundRect(ctx, x, y, w, h, L.radius, 'rgba(255,255,255,0.1)', 1.5)

  const badgeSize = 76
  const badgeX = x + 30
  const badgeY = y + (h - badgeSize) / 2
  const gold = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize)
  gold.addColorStop(0, '#fde047')
  gold.addColorStop(0.5, '#fbbf24')
  gold.addColorStop(1, '#f97316')
  fillRoundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 16, gold)
  ctx.save()
  ctx.shadowColor = 'rgba(251,191,36,0.55)'
  ctx.shadowBlur = 20
  drawCup(ctx, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1, 48)
  ctx.restore()

  const tx = badgeX + badgeSize + 26
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  setFont(ctx, 15, 800)
  ctx.fillStyle = '#fbbf24'
  ctx.fillText('COMPETIÇÃO DE ADERÊNCIA', tx, y + 28)

  setFont(ctx, 32, 800)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${input.periodoLabel} · ${input.periodoResumo}`, tx, y + 52)

  setFont(ctx, 18, 600)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(
    `${input.diasNoPeriodo} dia(s) · agrupado por ${input.groupLabel.toLowerCase()}`,
    tx,
    y + 96,
  )

  ctx.textAlign = 'right'
  setFont(ctx, 14, 600)
  ctx.fillStyle = '#64748b'
  ctx.fillText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, x + w - 30, y + 32)
  ctx.textAlign = 'left'
}

function drawRankBadge(ctx: Ctx, cx: number, cy: number, rank: number, variant: 'nao' | 'sim', highlight: boolean) {
  const r = 21
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  if (highlight) {
    ctx.fillStyle = variant === 'nao' ? '#e11d48' : '#059669'
  } else {
    ctx.fillStyle = '#334155'
  }
  ctx.fill()
  setFont(ctx, 16, 800)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(rank), cx, cy)
  ctx.textAlign = 'left'
}

function drawLeaderRow(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  entry: ChecklistAdherenceEntry,
  rank: number,
  variant: 'nao' | 'sim',
) {
  const isNao = variant === 'nao'
  const barPct = isNao ? 100 - entry.pct : entry.pct
  const highlight = isNao && rank === 1

  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    L.radiusSm,
    highlight ? 'rgba(69,10,10,0.92)' : 'rgba(15,23,42,0.88)',
  )
  strokeRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    L.radiusSm,
    highlight ? 'rgba(244,63,94,0.55)' : 'rgba(255,255,255,0.07)',
    1.5,
  )

  drawRankBadge(ctx, x + 36, y + h / 2, rank, variant, highlight || (!isNao && rank <= 3))

  const textX = x + 72
  const textW = w - 205
  ctx.textBaseline = 'top'

  setFont(ctx, 18, 750)
  ctx.fillStyle = '#f8fafc'
  ctx.fillText(truncateText(ctx, entry.label, textW), textX, y + 12)

  setFont(ctx, 14, 600)
  ctx.fillStyle = '#64748b'
  ctx.fillText(
    `${entry.veiculos} veíc. · ${entry.realizados}/${entry.esperados} dias-veículo`,
    textX,
    y + 32,
  )

  drawProgressBar(
    ctx,
    textX,
    y + h - 23,
    textW,
    13,
    barPct,
    isNao ? '#fb7185' : '#34d399',
    isNao ? '#e11d48' : '#059669',
  )

  ctx.textAlign = 'right'
  setFont(ctx, 27, 850)
  ctx.fillStyle = isNao ? '#fb7185' : '#34d399'
  ctx.fillText(`${entry.pct}%`, x + w - 22, y + 15)

  setFont(ctx, 13, 700)
  ctx.fillStyle = isNao ? '#fda4af' : '#64748b'
  ctx.fillText(isNao ? `${100 - entry.pct}% pendente` : 'aderência', x + w - 22, y + 49)
  ctx.textAlign = 'left'
}

function drawSpotlight(ctx: Ctx, x: number, y: number, w: number, h: number, entry: ChecklistAdherenceEntry) {
  ctx.save()
  ctx.shadowColor = 'rgba(244,63,94,0.45)'
  ctx.shadowBlur = 24
  const bg = ctx.createLinearGradient(x, y, x + w, y + h)
  bg.addColorStop(0, '#7f1d1d')
  bg.addColorStop(1, '#0f172a')
  fillRoundRect(ctx, x, y, w, h, L.radiusSm, bg)
  ctx.restore()
  strokeRoundRect(ctx, x, y, w, h, L.radiusSm, 'rgba(244,63,94,0.65)', 2)

  setFont(ctx, 14, 800)
  ctx.fillStyle = '#fda4af'
  ctx.textBaseline = 'top'
  ctx.fillText('MAIOR GAP NO PERÍODO', x + 26, y + 20)

  setFont(ctx, 30, 850)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(truncateText(ctx, entry.label, w - 210), x + 26, y + 46)

  setFont(ctx, 15, 600)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(
    `${entry.veiculos} veíc. · ${entry.realizados}/${entry.esperados} dias-veículo`,
    x + 26,
    y + 86,
  )

  ctx.textAlign = 'right'
  setFont(ctx, 46, 850)
  ctx.fillStyle = '#fb7185'
  ctx.fillText(`${entry.pct}%`, x + w - 26, y + 38)
  setFont(ctx, 14, 750)
  ctx.fillStyle = '#fecdd3'
  ctx.fillText(`${100 - entry.pct}% pendente`, x + w - 26, y + 90)
  ctx.textAlign = 'left'
}

function drawPodium(ctx: Ctx, x: number, y: number, w: number, h: number, entries: ChecklistAdherenceEntry[]) {
  fillRoundRect(ctx, x, y, w, h, L.radiusSm, 'rgba(2,6,23,0.75)')
  strokeRoundRect(ctx, x, y, w, h, L.radiusSm, 'rgba(16,185,129,0.35)', 1.5)

  setFont(ctx, 14, 800)
  ctx.fillStyle = 'rgba(52,211,153,0.9)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('PÓDIO', x + w / 2, y + 18)

  const colW = (w - 72) / 3
  const gap = 18
  const baseY = y + h - 18

  PODIUM_ORDER.forEach((entryIndex, slotIndex) => {
    const entry = entries[entryIndex]
    const colX = x + 16 + slotIndex * (colW + gap)
    const cx = colX + colW / 2
    const medal = MEDAL[slotIndex]!
    const isWinner = slotIndex === 1
    const cardY = y + (isWinner ? 46 : 58)
    const cardHeight = baseY - cardY

    const cardGrad = ctx.createLinearGradient(colX, cardY, colX, cardY + cardHeight)
    cardGrad.addColorStop(0, isWinner ? 'rgba(16,185,129,0.72)' : 'rgba(15,118,110,0.58)')
    cardGrad.addColorStop(0.62, isWinner ? 'rgba(5,150,105,0.62)' : 'rgba(5,95,85,0.52)')
    cardGrad.addColorStop(1, 'rgba(2,44,34,0.9)')
    fillRoundRect(ctx, colX, cardY, colW, cardHeight, 14, cardGrad)
    strokeRoundRect(
      ctx,
      colX,
      cardY,
      colW,
      cardHeight,
      14,
      isWinner ? 'rgba(251,191,36,0.75)' : 'rgba(52,211,153,0.28)',
      isWinner ? 2.5 : 1.5,
    )

    if (entry) {
      const fillW = Math.max(16, ((colW - 20) * entry.pct) / 100)
      fillRoundRect(ctx, colX + 10, cardY + cardHeight - 19, colW - 20, 10, 5, 'rgba(2,6,23,0.18)')
      fillRoundRect(ctx, colX + 10, cardY + cardHeight - 19, fillW, 10, 5, 'rgba(110,231,183,0.85)')
    }

    if (entry) {
      if (isWinner) {
        setFont(ctx, 28, 900)
        ctx.fillStyle = '#fbbf24'
        ctx.fillText('♛', cx, cardY + 4)
      }

      const medalR = 22
      const medalY = cardY + (isWinner ? 34 : 28)
      const medalGrad = ctx.createLinearGradient(cx - medalR, medalY - medalR, cx + medalR, medalY + medalR)
      medalGrad.addColorStop(0, medal.bg[0]!)
      medalGrad.addColorStop(1, medal.bg[1]!)
      ctx.beginPath()
      ctx.arc(cx, medalY, medalR, 0, Math.PI * 2)
      ctx.fillStyle = medalGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      setFont(ctx, 15, 800)
      ctx.fillStyle = medal.text
      ctx.textBaseline = 'middle'
      ctx.fillText(medal.label, cx, medalY)

      setFont(ctx, 18, 750)
      ctx.fillStyle = '#f8fafc'
      ctx.textBaseline = 'top'
      ctx.fillText(truncateText(ctx, firstName(entry.label), colW - 18), cx, cardY + (isWinner ? 62 : 56))

      setFont(ctx, 22, 850)
      ctx.fillStyle = '#d1fae5'
      ctx.fillText(`${entry.pct}%`, cx, cardY + (isWinner ? 90 : 84))
    }
  })

  ctx.textAlign = 'left'
}

function measureColumnHeight(variant: 'nao' | 'sim', entries: ChecklistAdherenceEntry[]): number {
  const rows = entries.slice(0, 10)
  if (rows.length === 0) return L.colHeaderH + 80

  if (variant === 'sim') {
    const listCount = Math.max(0, rows.length - 3)
    return L.colHeaderH + L.innerPad + L.podiumH + L.podiumListGap + listCount * (L.rowH + L.rowGap) + L.innerPad
  }

  const listCount = Math.max(0, rows.length - 1)
  return L.colHeaderH + L.innerPad + L.spotlightH + L.innerPad + listCount * (L.rowH + L.rowGap) + L.innerPad
}

function drawCompetitionBoard(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  boardH: number,
  variant: 'nao' | 'sim',
  entries: ChecklistAdherenceEntry[],
  groupLabel: string,
  diasNoPeriodo: number,
) {
  const isNao = variant === 'nao'
  const rows = entries.slice(0, 10)

  drawGlowEllipse(ctx, x + w / 2, y + 80, w * 0.42, 50, isNao ? '#f43f5e' : '#10b981')

  const colBg = ctx.createLinearGradient(x, y, x, y + boardH)
  colBg.addColorStop(0, isNao ? 'rgba(127,29,29,0.55)' : 'rgba(6,78,59,0.5)')
  colBg.addColorStop(0.25, '#020617')
  colBg.addColorStop(1, '#020617')
  fillRoundRect(ctx, x, y, w, boardH, L.radius, colBg)
  strokeRoundRect(ctx, x, y, w, boardH, L.radius, isNao ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)', 2)

  fillRoundRect(ctx, x, y, w, L.colHeaderH, L.radius, isNao ? 'rgba(76,5,25,0.75)' : 'rgba(6,78,59,0.65)')
  ctx.fillStyle = isNao ? 'rgba(76,5,25,0.75)' : 'rgba(6,78,59,0.65)'
  ctx.fillRect(x, y + L.colHeaderH - 20, w, 20)

  setFont(ctx, 19, 850)
  ctx.fillStyle = isNao ? '#fda4af' : '#6ee7b7'
  ctx.textBaseline = 'top'
  ctx.fillText(isNao ? 'ZONA CRÍTICA' : 'HALL DA FAMA', x + 28, y + 20)

  setFont(ctx, 15, 600)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(`Top 10 · ${groupLabel.toLowerCase()} · ${diasNoPeriodo} dia(s)`, x + 28, y + 48)

  const pillW = 116
  const pillH = 36
  const pillX = x + w - pillW - 24
  const pillY = y + 24
  fillRoundRect(
    ctx,
    pillX,
    pillY,
    pillW,
    pillH,
    pillH / 2,
    isNao ? 'rgba(244,63,94,0.2)' : 'rgba(251,191,36,0.18)',
  )
  strokeRoundRect(
    ctx,
    pillX,
    pillY,
    pillW,
    pillH,
    pillH / 2,
    isNao ? 'rgba(244,63,94,0.45)' : 'rgba(251,191,36,0.45)',
    1.5,
  )
  setFont(ctx, 13, 800)
  ctx.fillStyle = isNao ? '#fda4af' : '#fcd34d'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(isNao ? 'ALERTA' : 'LÍDERES', pillX + pillW / 2, pillY + pillH / 2)
  ctx.textAlign = 'left'

  let cursorY = y + L.colHeaderH + L.innerPad
  const contentW = w - L.innerPad * 2
  const contentX = x + L.innerPad

  if (rows.length === 0) {
    setFont(ctx, 14, 600)
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Nenhum competidor no recorte atual.', x + w / 2, y + boardH / 2)
    ctx.textAlign = 'left'
    return
  }

  if (isNao && rows[0]) {
    drawSpotlight(ctx, contentX, cursorY, contentW, L.spotlightH, rows[0])
    cursorY += L.spotlightH + L.rowGap
    rows.slice(1).forEach((entry, i) => {
      drawLeaderRow(ctx, contentX, cursorY, contentW, L.rowH, entry, i + 2, variant)
      cursorY += L.rowH + L.rowGap
    })
  } else {
    drawPodium(ctx, contentX, cursorY, contentW, L.podiumH, rows)
    cursorY += L.podiumH + L.podiumListGap
    rows.slice(3).forEach((entry, i) => {
      drawLeaderRow(ctx, contentX, cursorY, contentW, L.rowH, entry, i + 4, variant)
      cursorY += L.rowH + L.rowGap
    })
  }
}

export function generateRankingScreenshot(input: RankingScreenshotInput): string {
  const cardW = (W - L.pad * 2 - L.gap) / 2
  const leftH = measureColumnHeight('nao', input.pior)
  const rightH = measureColumnHeight('sim', input.melhor)
  const boardsH = Math.max(leftH, rightH)
  const H = L.pad + L.arenaH + L.gap + boardsH + L.pad

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#020617'
  ctx.fillRect(0, 0, W, H)

  drawArenaHeader(ctx, L.pad, L.pad, W - L.pad * 2, L.arenaH, input)

  const boardsY = L.pad + L.arenaH + L.gap
  drawCompetitionBoard(ctx, L.pad, boardsY, cardW, boardsH, 'nao', input.pior, input.groupLabel, input.diasNoPeriodo)
  drawCompetitionBoard(
    ctx,
    L.pad + cardW + L.gap,
    boardsY,
    cardW,
    boardsH,
    'sim',
    input.melhor,
    input.groupLabel,
    input.diasNoPeriodo,
  )

  return canvas.toDataURL('image/png')
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
