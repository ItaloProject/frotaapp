export type ChecklistDetalharPdfScope = 'nao' | 'sim' | 'ambos'

export type ChecklistDetalharVeiculoRow = {
  placa: string
  modelo: string
  base: string
  supervisor: string
  coordenador: string
}

export type ChecklistDetalharChecklistRow = ChecklistDetalharVeiculoRow & {
  hora: string
  temNc: boolean
}

export type ChecklistDetalharPdfMeta = {
  periodoLabel: string
  periodoResumo: string
  busca?: string
}

type PdfColumn = { header: string; width: number; get: (row: Record<string, unknown>) => string }

function truncate(text: string, maxLen: number): string {
  const t = text.trim() || '—'
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`
}

function buildFilename(scope: ChecklistDetalharPdfScope): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const suffix =
    scope === 'nao' ? 'nao-realizados' : scope === 'sim' ? 'realizados' : 'completo'
  return `checklist-detalhar-${suffix}-${stamp}.pdf`
}

function drawTable(
  doc: import('jspdf').jsPDF,
  opts: {
    title: string
    titleColor: [number, number, number]
    columns: PdfColumn[]
    rows: Record<string, unknown>[]
    startY: number
    margin: number
    pageW: number
    pageH: number
  },
): number {
  const { margin, pageW, pageH, columns } = opts
  const tableW = pageW - margin * 2
  const rowH = 16
  const headerH = 18
  let y = opts.startY

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - margin) return
    doc.addPage()
    y = margin
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...opts.titleColor)
  doc.text(opts.title, margin, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80)

  const drawHeader = () => {
    ensureSpace(headerH + rowH)
    let x = margin
    doc.setFillColor(...opts.titleColor)
    doc.rect(margin, y - 11, tableW, headerH, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    for (const col of columns) {
      doc.text(col.header, x + 3, y, { maxWidth: col.width - 6 })
      x += col.width
    }
    y += headerH - 6
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30)
  }

  drawHeader()

  for (let i = 0; i < opts.rows.length; i += 1) {
    ensureSpace(rowH + 4)
    if (y <= margin + 4) drawHeader()

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248)
      doc.rect(margin, y - 10, tableW, rowH, 'F')
    }

    let x = margin
    doc.setFontSize(8)
    for (const col of columns) {
      const raw = col.get(opts.rows[i]!)
      doc.text(raw, x + 3, y, { maxWidth: col.width - 6 })
      x += col.width
    }
    y += rowH
  }

  if (opts.rows.length === 0) {
    ensureSpace(rowH)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('Nenhum registro.', margin, y)
    y += rowH
  }

  doc.setTextColor(0)
  return y + 10
}

export async function generateChecklistDetalharPdf(
  scope: ChecklistDetalharPdfScope,
  meta: ChecklistDetalharPdfMeta,
  naoRealizados: ChecklistDetalharVeiculoRow[],
  realizados: ChecklistDetalharChecklistRow[],
): Promise<void> {
  const includeNao = scope === 'nao' || scope === 'ambos'
  const includeSim = scope === 'sim' || scope === 'ambos'

  if (includeNao && naoRealizados.length === 0 && !includeSim) {
    throw new Error('Não há checklists não realizados para exportar.')
  }
  if (includeSim && realizados.length === 0 && !includeNao) {
    throw new Error('Não há checklists realizados para exportar.')
  }
  if (includeNao && includeSim && naoRealizados.length === 0 && realizados.length === 0) {
    throw new Error('Não há registros para exportar.')
  }

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: includeSim ? 'landscape' : 'portrait',
  })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20)
  doc.text('Resultados por veículo — Checklist', margin, y)
  y += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60)
  doc.text(`Período: ${meta.periodoLabel} (${meta.periodoResumo})`, margin, y)
  y += 14

  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(`Gerado em: ${geradoEm}`, margin, y)
  y += 14

  if (meta.busca?.trim()) {
    doc.text(`Busca aplicada: "${meta.busca.trim()}"`, margin, y)
    y += 14
  }

  const scopeLabel =
    scope === 'nao'
      ? 'Somente não realizados'
      : scope === 'sim'
        ? 'Somente realizados'
        : 'Não realizados e realizados'
  doc.text(`Conteúdo: ${scopeLabel}`, margin, y)
  y += 20

  const naoCols: PdfColumn[] = [
    { header: 'Placa', width: 72, get: (r) => String(r.placa ?? '') },
    { header: 'Base', width: 90, get: (r) => truncate(String(r.base ?? ''), 18) },
    { header: 'Modelo', width: 110, get: (r) => truncate(String(r.modelo ?? ''), 22) },
    { header: 'Supervisor', width: 120, get: (r) => truncate(String(r.supervisor ?? ''), 24) },
    { header: 'Gerência', width: 120, get: (r) => truncate(String(r.coordenador ?? ''), 24) },
  ]

  const simCols: PdfColumn[] = [
    { header: 'Placa', width: 68, get: (r) => String(r.placa ?? '') },
    { header: 'Base', width: 78, get: (r) => truncate(String(r.base ?? ''), 16) },
    { header: 'Modelo', width: 96, get: (r) => truncate(String(r.modelo ?? ''), 18) },
    { header: 'Hora', width: 44, get: (r) => String(r.hora ?? '—') },
    { header: 'NC', width: 32, get: (r) => (r.temNc ? 'Sim' : '—') },
    { header: 'Supervisor', width: 110, get: (r) => truncate(String(r.supervisor ?? ''), 20) },
    { header: 'Gerência', width: 110, get: (r) => truncate(String(r.coordenador ?? ''), 20) },
  ]

  if (includeNao) {
    y = drawTable(doc, {
      title: `Não realizaram (${naoRealizados.length})`,
      titleColor: [190, 24, 93],
      columns: naoCols,
      rows: naoRealizados as Record<string, unknown>[],
      startY: y,
      margin,
      pageW,
      pageH,
    })
  }

  if (includeSim) {
    if (includeNao && y > margin + 40) {
      doc.addPage()
      y = margin
    }
    drawTable(doc, {
      title: `Realizaram (${realizados.length})`,
      titleColor: [5, 150, 105],
      columns: simCols,
      rows: realizados as Record<string, unknown>[],
      startY: y,
      margin,
      pageW,
      pageH,
    })
  }

  doc.save(buildFilename(scope))
}
