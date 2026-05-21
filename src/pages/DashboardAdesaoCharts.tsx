import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type DashboardAdesaoChartRow = { name: string; realizados: number; naoRealizados: number }

const CHART_COLORS = {
  realizados: '#1E40AF',
  naoRealizados: '#FF8A65',
} as const

type AdesaoTooltipPayload = {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

function AdesaoTooltipBody({
  active,
  payload,
  label,
  isDark,
}: {
  active?: boolean
  payload?: AdesaoTooltipPayload[]
  label?: string | number
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const shell = isDark
    ? 'border border-slate-600/70 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-md'
    : 'border border-slate-200/90 bg-white/95 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur-md'
  return (
    <div className={`min-w-[188px] rounded-2xl px-3 py-2.5 ${shell}`}>
      <p className="mb-2 border-b border-slate-400/25 pb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-slate-500/30 dark:text-slate-400">
        {label}
      </p>
      <ul className="space-y-2">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-8 text-[13px] font-bold tabular-nums">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: p.color }} />
              <span className="truncate text-slate-600 dark:text-slate-300">{p.name}</span>
            </span>
            <span className="shrink-0 text-slate-900 dark:text-white">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardAdesaoCharts({
  chartData,
  viewMode,
  chartUi,
  isDark,
  areaGradId,
}: {
  chartData: DashboardAdesaoChartRow[]
  viewMode: 'bar' | 'area'
  chartUi: { grid: string; tick: string }
  isDark: boolean
  areaGradId: string
}) {
  if (chartData.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm font-semibold text-slate-400 dark:text-slate-600">
        Nenhum checklist registrado neste período.
      </div>
    )
  }

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={240}
      initialDimension={{ width: 640, height: 320 }}
    >
      {viewMode === 'bar' ? (
        <BarChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 8 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartUi.grid} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: chartUi.tick }}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: chartUi.tick }}
            width={44}
          />
          <Tooltip
            content={(props) => (
              <AdesaoTooltipBody
                active={props.active}
                payload={props.payload as unknown as AdesaoTooltipPayload[] | undefined}
                label={props.label}
                isDark={isDark}
              />
            )}
            cursor={false}
            animationDuration={280}
            animationEasing="ease-out"
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ paddingTop: 18, fontSize: 11, fontWeight: 800 }}
            formatter={(value) => <span className="text-slate-600 dark:text-slate-400">{value}</span>}
          />
          <Bar
            dataKey="realizados"
            name="Realizados"
            fill={CHART_COLORS.realizados}
            radius={[12, 12, 0, 0]}
            barSize={40}
            animationDuration={720}
            animationEasing="ease-out"
            animationBegin={0}
            activeBar={{ fill: CHART_COLORS.realizados, stroke: '#93c5fd', strokeWidth: 2, opacity: 0.98 }}
          />
          <Bar
            dataKey="naoRealizados"
            name="Com NC"
            fill={CHART_COLORS.naoRealizados}
            radius={[12, 12, 0, 0]}
            barSize={40}
            animationDuration={720}
            animationEasing="ease-out"
            animationBegin={90}
            activeBar={{ fill: CHART_COLORS.naoRealizados, stroke: '#fdba74', strokeWidth: 2, opacity: 0.98 }}
          />
        </BarChart>
      ) : (
        <AreaChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id={`colorReal-${areaGradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`colorNao-${areaGradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF8A65" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#FF8A65" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartUi.grid} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: chartUi.tick }}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: chartUi.tick }}
            width={44}
          />
          <Tooltip
            content={(props) => (
              <AdesaoTooltipBody
                active={props.active}
                payload={props.payload as unknown as AdesaoTooltipPayload[] | undefined}
                label={props.label}
                isDark={isDark}
              />
            )}
            cursor={false}
            animationDuration={280}
            animationEasing="ease-out"
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ paddingTop: 18, fontSize: 11, fontWeight: 800 }}
            formatter={(value) => <span className="text-slate-600 dark:text-slate-400">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="realizados"
            name="Realizados"
            stroke={CHART_COLORS.realizados}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#colorReal-${areaGradId})`}
            dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.realizados }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.realizados }}
            animationDuration={900}
            animationEasing="ease-out"
            animationBegin={0}
          />
          <Area
            type="monotone"
            dataKey="naoRealizados"
            name="Com NC"
            stroke={CHART_COLORS.naoRealizados}
            strokeWidth={2.5}
            fill={`url(#colorNao-${areaGradId})`}
            fillOpacity={1}
            dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.naoRealizados }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.naoRealizados }}
            animationDuration={900}
            animationEasing="ease-out"
            animationBegin={120}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  )
}
