import type { Apontamento } from './ApontamentosContext'
import { normalizePlaca } from '../frota/vehicleRegistry'

export type ApontamentoGroup = {
  key: string
  placa: string
  ncItemId: string
  ocorrencias: Apontamento[]
  /** Ocorrência mais recente (primeira em `ocorrencias`). */
  representative: Apontamento
  count: number
  /** Maior sequência de dias consecutivos entre as datas de apontamento. */
  diasConsecutivos: number
}

export type ManageTableRow =
  | { type: 'single'; row: Apontamento; sortKey: string }
  | { type: 'group'; group: ApontamentoGroup; sortKey: string }

function parseSortMs(r: Apontamento): number {
  const h = r.horaApontamento?.trim() || '00:00'
  const t = new Date(`${r.dataApontamento.slice(0, 10)}T${h}`).getTime()
  return Number.isFinite(t) ? t : new Date(r.dataApontamento).getTime()
}

function sortKeyFromMs(ms: number, id: string): string {
  return `${String(ms).padStart(14, '0')}__${id}`
}

/** Chave de agrupamento opção A: placa + item NC do checklist. */
export function apontamentoGroupKey(r: Apontamento): string | null {
  if (r.resolvido) return null
  const placa = normalizePlaca(r.placa)
  const ncItemId = r.ncItemId?.trim()
  if (!placa || !ncItemId) return null
  return `${placa}__${ncItemId}`
}

function parseIsoDayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Maior sequência de dias consecutivos na lista de datas ISO. */
export function countConsecutiveDays(isoDates: string[]): number {
  const unique = [...new Set(isoDates.map((d) => d.slice(0, 10)))].sort()
  if (unique.length === 0) return 0
  if (unique.length === 1) return 1
  let maxStreak = 1
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const diffDays = Math.round((parseIsoDayMs(unique[i]!) - parseIsoDayMs(unique[i - 1]!)) / 86_400_000)
    if (diffDays === 1) {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else {
      streak = 1
    }
  }
  return maxStreak
}

function buildGroupsFromPending(pending: Apontamento[]): {
  groups: ApontamentoGroup[]
  singles: Apontamento[]
} {
  const map = new Map<string, Apontamento[]>()
  const singles: Apontamento[] = []

  for (const r of pending) {
    const key = apontamentoGroupKey(r)
    if (!key) {
      singles.push(r)
      continue
    }
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  const groups: ApontamentoGroup[] = []
  for (const [key, list] of map) {
    if (list.length < 2) {
      singles.push(...list)
      continue
    }
    const ocorrencias = [...list].sort((a, b) => parseSortMs(b) - parseSortMs(a))
    const representative = ocorrencias[0]!
    groups.push({
      key,
      placa: normalizePlaca(representative.placa),
      ncItemId: representative.ncItemId,
      ocorrencias,
      representative,
      count: ocorrencias.length,
      diasConsecutivos: countConsecutiveDays(ocorrencias.map((o) => o.dataApontamento)),
    })
  }

  return { groups, singles }
}

/**
 * Agrupa apontamentos pendentes repetidos (placa + ncItemId).
 * Resolvidos e pendentes sem par sempre aparecem como linha única.
 */
export function buildManageTableRows(
  rows: Apontamento[],
  agrupar: boolean,
  dataOrdem: 'asc' | 'desc',
): ManageTableRow[] {
  if (!agrupar) {
    const out = rows.map((row) => ({
      type: 'single' as const,
      row,
      sortKey: sortKeyFromMs(parseSortMs(row), row.id),
    }))
    const dir = dataOrdem === 'asc' ? 1 : -1
    return out.sort((a, b) => dir * a.sortKey.localeCompare(b.sortKey))
  }

  const resolved: Apontamento[] = []
  const pending: Apontamento[] = []
  for (const r of rows) {
    if (r.resolvido) resolved.push(r)
    else pending.push(r)
  }

  const { groups, singles } = buildGroupsFromPending(pending)

  const tableRows: ManageTableRow[] = [
    ...resolved.map((row) => ({
      type: 'single' as const,
      row,
      sortKey: sortKeyFromMs(parseSortMs(row), row.id),
    })),
    ...singles.map((row) => ({
      type: 'single' as const,
      row,
      sortKey: sortKeyFromMs(parseSortMs(row), row.id),
    })),
    ...groups.map((group) => ({
      type: 'group' as const,
      group,
      sortKey: sortKeyFromMs(parseSortMs(group.representative), group.key),
    })),
  ]

  const dir = dataOrdem === 'asc' ? 1 : -1
  return tableRows.sort((a, b) => dir * a.sortKey.localeCompare(b.sortKey))
}

/** IDs de todos os apontamentos pendentes do mesmo defeito (placa + ncItemId). */
export function findRecorrenteSiblingIds(allRows: Apontamento[], apontamentoId: string): string[] {
  const target = allRows.find((r) => r.id === apontamentoId)
  if (!target || target.resolvido) return [apontamentoId]

  const key = apontamentoGroupKey(target)
  if (!key) return [apontamentoId]

  const siblings = allRows.filter((r) => !r.resolvido && apontamentoGroupKey(r) === key)
  if (siblings.length <= 1) return [apontamentoId]
  return siblings.map((s) => s.id)
}

export type HistoricoResolvidoEntry = {
  key: string
  representative: Apontamento
  /** Primeiro dia em que o defeito foi apontado (mesma placa + ncItemId). */
  dataPrimeiroApontamento: string
  dataResolvido: string
  count: number
  ocorrencias: Apontamento[]
}

function resolvedHistoricoGroupKey(r: Apontamento): string | null {
  if (!r.resolvido || !r.dataResolvido) return null
  const placa = normalizePlaca(r.placa)
  const ncItemId = r.ncItemId?.trim()
  if (!placa || !ncItemId) return null
  return `${placa}__${ncItemId}__${r.dataResolvido.slice(0, 10)}`
}

/** Consolida resoluções do mesmo defeito (placa + ncItemId) no histórico. */
export function buildHistoricoResolvidoEntries(rows: Apontamento[]): HistoricoResolvidoEntry[] {
  const resolved = rows.filter((r) => r.resolvido && r.dataResolvido)
  const map = new Map<string, Apontamento[]>()
  const standalone: Apontamento[] = []

  for (const r of resolved) {
    const key = resolvedHistoricoGroupKey(r)
    if (!key) {
      standalone.push(r)
      continue
    }
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  const entries: HistoricoResolvidoEntry[] = []

  for (const r of standalone) {
    entries.push({
      key: r.id,
      representative: r,
      dataPrimeiroApontamento: r.dataApontamento,
      dataResolvido: r.dataResolvido!,
      count: 1,
      ocorrencias: [r],
    })
  }

  for (const [key, list] of map) {
    const ocorrencias = [...list].sort((a, b) => a.dataApontamento.localeCompare(b.dataApontamento))
    const dataPrimeiroApontamento = ocorrencias[0]!.dataApontamento
    const dataResolvido = ocorrencias[0]!.dataResolvido!
    const representative =
      ocorrencias.find((o) => o.reparoDescricao?.trim() || o.reparoValor != null || (o.reparoImagens?.length ?? 0) > 0) ??
      ocorrencias[ocorrencias.length - 1]!
    entries.push({
      key,
      representative,
      dataPrimeiroApontamento,
      dataResolvido,
      count: ocorrencias.length,
      ocorrencias,
    })
  }

  return entries
}
