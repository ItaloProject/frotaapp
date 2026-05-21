import { useMemo } from 'react'
import { AlertTriangle, Crown, Flame, Medal, Sparkles, Trophy, Zap } from 'lucide-react'

import {
  buildChecklistAdherenceRanking,
  CHECKLIST_TOP10_GROUP_OPTIONS,
  type ChecklistAdherenceEntry,
  type ChecklistTop10GroupBy,
  type ChecklistTop10Row,
} from '../../checklists/checklistTop10Ranking'

type Variant = 'nao' | 'sim'

const PODIUM_ORDER = [1, 0, 2] as const
const PODIUM_HEIGHT = ['h-[88px]', 'h-[112px]', 'h-[72px]'] as const
const PODIUM_MEDAL = [
  { ring: 'ring-slate-300/80', bg: 'bg-gradient-to-br from-slate-200 to-slate-400', text: 'text-slate-900', label: '2º' },
  { ring: 'ring-amber-300/90', bg: 'rank-gold-shimmer', text: 'text-amber-950', label: '1º' },
  { ring: 'ring-orange-400/80', bg: 'bg-gradient-to-br from-orange-300 to-orange-600', text: 'text-orange-950', label: '3º' },
] as const

function firstName(label: string): string {
  return label.trim().split(/\s+/)[0] ?? label
}

function PodiumBlock({
  entry,
  slotIndex,
  variant,
}: {
  entry: ChecklistAdherenceEntry | undefined
  slotIndex: number
  variant: Variant
}) {
  const medal = PODIUM_MEDAL[slotIndex]!
  const height = PODIUM_HEIGHT[slotIndex]!
  const isFirst = slotIndex === 1

  if (!entry) {
    return (
      <div className="flex flex-1 flex-col items-center justify-end opacity-30">
        <div className={`w-full rounded-t-2xl border border-dashed border-slate-600/40 bg-slate-800/20 ${height}`} />
      </div>
    )
  }

  const barPct = variant === 'nao' ? 100 - entry.pct : entry.pct

  return (
    <div
      className="rank-podium-enter flex flex-1 flex-col items-center justify-end"
      style={{ ['--podium-i' as string]: slotIndex }}
    >
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        {isFirst ? <Crown size={18} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" /> : null}
        <div
          className={`grid h-9 w-9 place-items-center rounded-full ring-2 ${medal.ring} ${medal.bg} shadow-lg`}
        >
          <span className={`text-[10px] font-black ${medal.text}`}>{medal.label}</span>
        </div>
        <p className="max-w-[96px] truncate text-[11px] font-black text-white">{firstName(entry.label)}</p>
        <p className="text-sm font-black tabular-nums text-emerald-300">{entry.pct}%</p>
      </div>
      <div
        className={`relative w-full overflow-hidden rounded-t-2xl border border-emerald-400/30 bg-gradient-to-t from-emerald-950/90 via-emerald-900/70 to-emerald-700/40 shadow-[0_-8px_30px_rgba(16,185,129,0.25)] ${height} ${
          isFirst ? 'ring-1 ring-amber-400/40' : ''
        }`}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-emerald-500/25 transition-all"
          style={{ height: `${Math.max(12, barPct)}%` }}
        />
        {isFirst ? (
          <Sparkles
            size={14}
            className="absolute right-2 top-2 text-amber-300/80"
          />
        ) : null}
      </div>
    </div>
  )
}

function LeaderboardRow({
  entry,
  index,
  variant,
}: {
  entry: ChecklistAdherenceEntry
  index: number
  variant: Variant
}) {
  const isNao = variant === 'nao'
  const barPct = isNao ? 100 - entry.pct : entry.pct
  const isWorst = isNao && index === 0
  const isTop = !isNao && index === 0

  return (
    <li
      className={`rank-row-enter relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-sm transition hover:scale-[1.01] ${
        isWorst
          ? 'rank-alert-spotlight border-rose-500/50 bg-rose-950/40'
          : isTop
            ? 'border-emerald-400/40 bg-emerald-950/30'
            : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/60'
      }`}
      style={{ ['--rank-i' as string]: index + 3 }}
    >
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
          isWorst
            ? 'bg-rose-500 text-white'
            : index === 0 && !isNao
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-300'
        }`}
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isWorst ? <Flame size={12} className="shrink-0 text-rose-400" /> : null}
          {!isNao && index < 3 ? <Medal size={12} className="shrink-0 text-amber-400/80" /> : null}
          <p className="truncate text-xs font-bold text-slate-100">{entry.label}</p>
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
          {entry.veiculos} veíc. · {entry.realizados}/{entry.esperados} dias-veículo
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-white/5">
          <div
            className={`rank-bar-fill h-full rounded-full ${
              isNao ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
            }`}
            style={{ ['--rank-i' as string]: index + 3, width: `${Math.max(8, barPct)}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`text-base font-black tabular-nums ${
            isNao ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {entry.pct}%
        </span>
        {isNao ? (
          <p className="text-[10px] font-bold text-rose-300/70">{100 - entry.pct}% pendente</p>
        ) : (
          <p className="text-[10px] font-bold text-emerald-400/60">aderência</p>
        )}
      </div>
    </li>
  )
}

function CompetitionBoard({
  variant,
  entries,
  groupLabel,
  diasNoPeriodo,
  fullscreen,
}: {
  variant: Variant
  entries: ChecklistAdherenceEntry[]
  groupLabel: string
  diasNoPeriodo: number
  fullscreen?: boolean
}) {
  const isNao = variant === 'nao'
  const podiumEntries = isNao ? [] : entries.slice(0, 3)
  const listEntries = isNao ? entries : entries.slice(3)

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl ${
        isNao
          ? 'border-rose-500/30 bg-gradient-to-b from-rose-950/80 via-slate-950 to-slate-950'
          : 'border-emerald-500/30 bg-gradient-to-b from-emerald-950/70 via-slate-950 to-slate-950'
      } ${fullscreen ? 'min-h-0 flex-1' : 'min-h-[480px]'}`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
            isNao ? 'rank-arena-glow-rose bg-rose-500/20' : 'rank-arena-glow-emerald bg-emerald-500/20'
          }`}
        />
        <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div
        className={`relative flex shrink-0 items-center gap-3 border-b px-4 py-3.5 ${
          isNao ? 'border-rose-500/20 bg-rose-950/40' : 'border-emerald-500/20 bg-emerald-950/40'
        }`}
      >
        <span
          className={`grid h-10 w-10 place-items-center rounded-2xl shadow-lg ring-1 ring-white/10 ${
            isNao ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {isNao ? <AlertTriangle size={18} /> : <Trophy size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-black uppercase tracking-[0.14em] ${
              isNao ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {isNao ? 'Zona crítica' : 'Hall da fama'}
          </p>
          <p className="text-[10px] font-semibold text-slate-400">
            Top 10 · {groupLabel.toLowerCase()} · {diasNoPeriodo} dia(s)
          </p>
        </div>
        {!isNao ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
            <Zap size={11} />
            Líderes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-300 ring-1 ring-rose-400/30">
            <Flame size={11} />
            Alerta
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="relative flex flex-1 items-center justify-center px-4 py-14 text-xs font-semibold text-slate-500">
          Nenhum competidor no recorte atual.
        </div>
      ) : (
        <div
          className={`custom-scrollbar relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3 ${
            fullscreen ? '' : 'max-h-[68vh] xl:max-h-none'
          }`}
        >
          {!isNao && podiumEntries.length > 0 ? (
            <div className="rank-row-enter rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-3 pt-4 ring-1 ring-emerald-400/10">
              <p className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">
                Pódio
              </p>
              <div className="flex items-end gap-2 px-1">
                {PODIUM_ORDER.map((entryIndex, slotIndex) => (
                  <PodiumBlock
                    key={slotIndex}
                    entry={podiumEntries[entryIndex]}
                    slotIndex={slotIndex}
                    variant={variant}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {isNao && entries[0] ? (
            <div
              className="rank-row-enter rank-alert-spotlight rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/80 to-slate-950 p-4"
              style={{ ['--rank-i' as string]: 0 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-400">Maior gap no período</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{entries[0].label}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {entries[0].veiculos} veíc. · {entries[0].realizados}/{entries[0].esperados} dias-veículo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black tabular-nums text-rose-400">{entries[0].pct}%</p>
                  <p className="text-[10px] font-bold text-rose-300">{100 - entries[0].pct}% pendente</p>
                </div>
              </div>
            </div>
          ) : null}

          <ol className="space-y-2">
            {(isNao ? entries.slice(1) : listEntries).map((entry, index) => (
              <LeaderboardRow
                key={entry.label}
                entry={entry}
                index={isNao ? index + 1 : index + 3}
                variant={variant}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function ChecklistTop10Section({
  frota,
  completions,
  diasNoPeriodo,
  periodDays,
  periodoLabel,
  periodoResumo,
  groupBy,
  onGroupByChange,
  fullscreen,
}: {
  frota: ChecklistTop10Row[]
  completions: Set<string>
  diasNoPeriodo: number
  periodDays: string[]
  periodoLabel?: string
  periodoResumo?: string
  groupBy: ChecklistTop10GroupBy
  onGroupByChange: (value: ChecklistTop10GroupBy) => void
  fullscreen?: boolean
}) {
  const groupLabel = CHECKLIST_TOP10_GROUP_OPTIONS.find((o) => o.value === groupBy)?.label ?? 'Responsável'

  const melhorAderencia = useMemo(
    () => buildChecklistAdherenceRanking(frota, completions, periodDays, groupBy, 'best'),
    [frota, completions, periodDays, groupBy],
  )

  const piorAderencia = useMemo(
    () => buildChecklistAdherenceRanking(frota, completions, periodDays, groupBy, 'worst'),
    [frota, completions, periodDays, groupBy],
  )

  return (
    <div className={`rank-arena flex min-h-0 flex-col gap-4 ${fullscreen ? 'min-h-0 flex-1' : ''}`}>
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-4 shadow-2xl sm:px-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(244,63,94,0.12),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.08),transparent_45%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.45)]">
              <Trophy size={22} strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400/90">
                Competição de aderência
              </p>
              <p className="text-base font-black text-white sm:text-lg">
                {periodoLabel}
                {periodoResumo ? ` · ${periodoResumo}` : ''}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {diasNoPeriodo} dia(s) · quem lidera e quem precisa acelerar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Agrupar por</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as ChecklistTop10GroupBy)}
              className="h-10 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-xs font-extrabold text-slate-100 outline-none transition focus:border-amber-400/50 focus:ring-4 focus:ring-amber-500/10"
            >
              {CHECKLIST_TOP10_GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        className={`grid min-h-0 gap-4 xl:grid-cols-2 xl:items-stretch ${fullscreen ? 'min-h-0 flex-1' : ''}`}
      >
        <CompetitionBoard
          variant="nao"
          entries={piorAderencia}
          groupLabel={groupLabel}
          diasNoPeriodo={diasNoPeriodo}
          fullscreen={fullscreen}
        />
        <CompetitionBoard
          variant="sim"
          entries={melhorAderencia}
          groupLabel={groupLabel}
          diasNoPeriodo={diasNoPeriodo}
          fullscreen={fullscreen}
        />
      </div>
    </div>
  )
}

export { CHECKLIST_TOP10_GROUP_OPTIONS, buildChecklistAdherenceRanking }
export type { ChecklistTop10GroupBy, ChecklistAdherenceEntry }
