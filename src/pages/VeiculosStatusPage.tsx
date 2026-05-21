import { ArrowLeft, ClipboardList, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getVehicleOperationalStatusRowsWithLocals,
  getVehicleOperationalStatusSummary,
  VEHICLE_OPERATIONAL_STATUS_LABELS,
  type VehicleOperationalStatus,
} from '../frota/vehicleOperationalStatus'
import { formatPlaca } from '../frota/vehicleRegistry'
import { useFleet } from '../frota/FleetContext'

const STATUS_STYLE: Record<VehicleOperationalStatus, { card: string; badge: string }> = {
  ATIVOS: {
    card: 'border-emerald-300/70 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100',
    badge: 'bg-emerald-600 text-white',
  },
  DESMOBILIZADO: {
    card: 'border-rose-300/70 bg-rose-50/70 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100',
    badge: 'bg-rose-600 text-white',
  },
  'EM MOBILIZAÇÃO': {
    card: 'border-blue-300/70 bg-blue-50/70 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100',
    badge: 'bg-blue-600 text-white',
  },
  AGUARDANDO: {
    card: 'border-amber-300/70 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100',
    badge: 'bg-amber-500 text-white',
  },
  RESERVA: {
    card: 'border-slate-300/80 bg-slate-50/80 text-slate-950 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100',
    badge: 'bg-slate-700 text-white',
  },
  TRANSPORTE: {
    card: 'border-cyan-300/70 bg-cyan-50/70 text-cyan-950 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-100',
    badge: 'bg-cyan-600 text-white',
  },
  AVARIADO: {
    card: 'border-orange-300/70 bg-orange-50/70 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100',
    badge: 'bg-orange-600 text-white',
  },
}

export function VeiculosStatusPage() {
  const { vehicles } = useFleet()
  const statusRows = getVehicleOperationalStatusRowsWithLocals(vehicles)
  const summary = getVehicleOperationalStatusSummary(statusRows)
  /** Placas na base (ex.: 412); não é a soma dos números exibidos nos cartões (ex.: ATIVOS inclui Transporte na visualização). */
  const totalFrota = statusRows.length
  const transporteQty = summary.find((s) => s.label === 'TRANSPORTE')?.count ?? 0

  const contagemNoCartao = (item: (typeof summary)[number]) =>
    item.label === 'ATIVOS' ? item.count + transporteQty : item.count

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="bg-gradient-to-r from-[#0d1117] via-cyan-900 to-cyan-600 p-6 text-white">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white/90 transition hover:bg-white/15"
            >
              <ArrowLeft size={14} />
              Dashboard
            </Link>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-100">Resumo operacional</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Status da frota</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-200">
                  Visão geral da <strong>frota de veículos</strong>
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 px-6 py-4 text-center backdrop-blur sm:min-w-[11rem]">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">Total nas categorias</p>
                <p className="mt-1 text-4xl font-black tabular-nums">{totalFrota}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.map((item) => {
            const style = STATUS_STYLE[item.label]
            return (
              <article
                key={item.label}
                className={`flex flex-col items-center overflow-hidden rounded-[2rem] border p-6 text-center shadow-sm ${style.card}`}
              >
                <div className={`mb-4 rounded-2xl p-3 ${style.badge}`}>
                  <Truck size={24} aria-hidden />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{item.label}</p>
                <p className="mt-2 text-5xl font-black tabular-nums tracking-tight">{contagemNoCartao(item)}</p>
              </article>
            )
          })}
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Detalhamento</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Cada placa em uma categoria na tabela; no cartão, ATIVOS inclui também as placas de Transporte.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3 text-right">Quantidade</th>
                  <th className="px-5 py-3">Placas</th>
                </tr>
              </thead>
              <tbody>
                {VEHICLE_OPERATIONAL_STATUS_LABELS.map((label) => {
                  const item = summary.find((row) => row.label === label)!
                  return (
                    <tr key={label} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3 font-black text-slate-900 dark:text-white">{label}</td>
                      <td className="px-5 py-3 text-right font-black tabular-nums text-slate-900 dark:text-white">{item.count}</td>
                      <td className="max-w-[420px] px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {item.vehicles.map((v: { placa: string }) => formatPlaca(v.placa)).join(', ') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
