import { matchesBaseFilter } from '../data/baseFilterOptions'
import { matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'
import type { Apontamento } from './ApontamentosContext'
import { formatDefeitoParaExibicao } from './defeitoExibicao'

export type EvolucaoFiltros = {
  base: string
  coordenador: string
  responsavel: string
  prefixo: string
  data: 'todos' | '30' | '90' | '365' | 'ano'
}

export type PontoEvolucao = {
  periodo: string
  chave: string
  resolvidos: number
  diasMedios: number | null
  exemplos: string[]
}

export function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function diasEntreApontamentoEResolucao(r: Apontamento): number {
  const [ya, ma, da] = r.dataApontamento.split('-').map(Number)
  const [yr, mr, dr] = (r.dataResolvido ?? r.dataApontamento).split('-').map(Number)
  const a = new Date(ya, ma - 1, da).getTime()
  const b = new Date(yr, mr - 1, dr).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function filterResolvidosParaEvolucao(rows: Apontamento[], f: EvolucaoFiltros): Apontamento[] {
  let list = rows.filter((r) => r.resolvido && r.dataResolvido)
  if (f.base !== 'todos') list = list.filter((r) => matchesBaseFilter(r.base, f.base))
  if (f.coordenador !== 'todos') list = list.filter((r) => matchesCoordenadorFilter(r.coordenador, f.coordenador))
  if (f.responsavel !== 'todos') list = list.filter((r) => r.responsavel === f.responsavel)
  if (f.prefixo !== 'todos') list = list.filter((r) => r.prefixo === f.prefixo)

  if (f.data !== 'todos') {
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    const nowMs = now.getTime()
    const ano = now.getFullYear()

    if (f.data === 'ano') {
      list = list.filter((r) => Number(r.dataResolvido!.slice(0, 4)) === ano)
    } else {
      const dias = f.data === '30' ? 30 : f.data === '90' ? 90 : 365
      const min = nowMs - dias * 86_400_000
      list = list.filter((r) => parseIsoDate(r.dataResolvido!) >= min)
    }
  }
  return list
}

export function mondayKeyFromDateIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const toMon = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + toMon)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function formatWeekLabel(mondayIso: string): string {
  const [y, m, d] = mondayIso.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('pt-BR', opt)} – ${end.toLocaleDateString('pt-BR', opt)}`
}

export function buildWeeklyChartPoints(
  resolvidos: Apontamento[],
  boundary?: { from: string; to: string },
): PontoEvolucao[] {
  const map = new Map<string, Apontamento[]>()
  for (const r of resolvidos) {
    const key = mondayKeyFromDateIso(r.dataResolvido!)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }

  let fromKey: string | undefined
  let toKey: string | undefined
  if (map.size > 0) {
    const sorted = [...map.keys()].sort()
    fromKey = sorted[0]
    toKey = sorted[sorted.length - 1]
  }
  if (boundary) {
    const bFrom = mondayKeyFromDateIso(boundary.from)
    const bTo = mondayKeyFromDateIso(boundary.to)
    fromKey = fromKey ? (fromKey < bFrom ? fromKey : bFrom) : bFrom
    toKey = toKey ? (toKey > bTo ? toKey : bTo) : bTo
  }
  if (!fromKey || !toKey) return []

  const weeks: string[] = []
  let cur = fromKey
  while (cur <= toKey) {
    weeks.push(cur)
    cur = addDaysIso(cur, 7)
  }

  return weeks.map((chave) => {
    const itens = map.get(chave) ?? []
    const dias = itens.map(diasEntreApontamentoEResolucao)
    const diasMedios =
      itens.length > 0
        ? Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10
        : null
    const exemplos = itens.map((r) => `${r.prefixo} — ${formatDefeitoParaExibicao(r.defeito)}`)
    return { periodo: formatWeekLabel(chave), chave, resolvidos: itens.length, diasMedios, exemplos }
  })
}

function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7)
}

function nextMonthYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const next = new Date(y, m - 1 + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

export function buildMonthlyChartPoints(
  resolvidos: Apontamento[],
  boundary?: { from: string; to: string },
): PontoEvolucao[] {
  const map = new Map<string, Apontamento[]>()
  for (const r of resolvidos) {
    const key = monthKeyFromIso(r.dataResolvido!)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }

  let fromKey: string | undefined
  let toKey: string | undefined
  if (map.size > 0) {
    const sorted = [...map.keys()].sort()
    fromKey = sorted[0]
    toKey = sorted[sorted.length - 1]
  }
  if (boundary) {
    const bFrom = monthKeyFromIso(boundary.from)
    const bTo = monthKeyFromIso(boundary.to)
    fromKey = fromKey ? (fromKey < bFrom ? fromKey : bFrom) : bFrom
    toKey = toKey ? (toKey > bTo ? toKey : bTo) : bTo
  }
  if (!fromKey || !toKey) return []

  const months: string[] = []
  let cur = fromKey
  while (cur <= toKey) {
    months.push(cur)
    cur = nextMonthYm(cur)
  }

  return months.map((chave) => {
    const itens = map.get(chave) ?? []
    const dias = itens.map(diasEntreApontamentoEResolucao)
    const diasMedios =
      itens.length > 0
        ? Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10
        : null
    const exemplos = itens.map((r) => `${r.prefixo} — ${formatDefeitoParaExibicao(r.defeito)}`)
    return { periodo: formatMonthLabel(chave), chave, resolvidos: itens.length, diasMedios, exemplos }
  })
}

export function mediaDiasApontamentoResolucao(rows: Apontamento[]): number | null {
  if (!rows.length) return null
  const dias = rows.map(diasEntreApontamentoEResolucao)
  return Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10
}

export function mediaDiasNosPontosDoGrafico(pontos: PontoEvolucao[]): number | null {
  const vals = pontos.map((p) => p.diasMedios).filter((v): v is number => v != null)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

/** CSV com separador ; para Excel em pt-BR */
export function buildResolvidosCsv(rows: Apontamento[]): string {
  const header = [
    'id',
    'prefixo',
    'veiculo',
    'defeito',
    'processo',
    'base',
    'coordenador',
    'responsavel',
    'data_apontamento',
    'data_resolvido',
    'dias_ate_resolver',
  ].join(';')

  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`

  const lines = rows.map((r) => {
    const d = diasEntreApontamentoEResolucao(r)
    return [
      r.id,
      r.prefixo,
      r.veiculoLabel,
      formatDefeitoParaExibicao(r.defeito),
      r.processo,
      r.base,
      r.coordenador,
      r.responsavel,
      r.dataApontamento,
      r.dataResolvido ?? '',
      String(d),
    ]
      .map((c) => esc(String(c)))
      .join(';')
  })

  return [header, ...lines].join('\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
