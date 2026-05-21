import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart2,
  Bike,
  Car,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Search,
  Truck,
} from 'lucide-react'

function IconSkyLift({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* cesto */}
      <rect x="2" y="1" width="6" height="4" rx="0.8" />
      {/* braço inferior */}
      <line x1="8" y1="4" x2="14" y2="11" />
      {/* braço superior */}
      <line x1="14" y1="11" x2="9" y2="15" />
      {/* torre/pivô */}
      <line x1="14" y1="11" x2="14" y2="18" />
      {/* chassi */}
      <rect x="10" y="18" width="10" height="3" rx="0.6" />
      {/* rodas */}
      <circle cx="12" cy="22" r="1" />
      <circle cx="19" cy="22" r="1" />
    </svg>
  )
}
import { CHECKLIST_SCHEMAS } from '../data/checklistSchemas'
import type { ChecklistSchemaDef } from '../data/checklistSchemas'

// ---------------------------------------------------------------------------
// Metadados visuais por tipo (ícone, cor) — não pertencem ao schema público
// ---------------------------------------------------------------------------
const CARD_META: Record<string, { icon: React.ReactNode; cor: string; corBg: string }> = {
  sky:           { icon: <IconSkyLift size={24} />, cor: 'text-sky-500',     corBg: 'bg-sky-500/10 dark:bg-sky-500/15' },
  munck:         { icon: <Truck size={24} />,  cor: 'text-amber-500',   corBg: 'bg-amber-500/10 dark:bg-amber-500/15' },
  'picape-leve': { icon: <Car size={24} />,    cor: 'text-emerald-500', corBg: 'bg-emerald-500/10 dark:bg-emerald-500/15' },
  'picape-4x4':  { icon: <Car size={24} />,    cor: 'text-violet-500',  corBg: 'bg-violet-500/10 dark:bg-violet-500/15' },
  motocicleta:   { icon: <Bike size={24} />,   cor: 'text-rose-500',    corBg: 'bg-rose-500/10 dark:bg-rose-500/15' },
  'veiculo-leve':{ icon: <Car size={24} />,    cor: 'text-slate-400',   corBg: 'bg-slate-500/10 dark:bg-slate-500/15' },
}

function getMeta(id: string) {
  return CARD_META[id] ?? { icon: <ClipboardList size={24} />, cor: 'text-slate-400', corBg: 'bg-slate-500/10' }
}

// ---------------------------------------------------------------------------
// Botões C / NC / NA — usados no formulário interno (visualização admin)
// ---------------------------------------------------------------------------
type Resposta = 'c' | 'nc' | 'na' | null

const OPCOES = [
  { valor: 'c'  as const, label: 'C',   titulo: 'Conforme',      activeClass: 'bg-emerald-500 border-emerald-500 text-white', idleClass: 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400' },
  { valor: 'nc' as const, label: 'NC',  titulo: 'Não Conforme',  activeClass: 'bg-rose-500 border-rose-500 text-white',       idleClass: 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400' },
  { valor: 'na' as const, label: 'NA',  titulo: 'Não Aplicável', activeClass: 'bg-slate-400 border-slate-400 text-white',     idleClass: 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400' },
]

// ---------------------------------------------------------------------------
// Formulário de preenchimento (uso interno admin — sem Supabase)
// ---------------------------------------------------------------------------
function ChecklistForm({ schema, onVoltar }: { schema: ChecklistSchemaDef; onVoltar: () => void }) {
  const meta = getMeta(schema.id)
  const todosItens = schema.grupos.flatMap((g) => g.itens)
  const totalItens = todosItens.length

  const [respostas, setRespostas]   = useState<Record<string, Resposta>>({})
  const [observacoes, setObservacoes] = useState<Record<string, string>>({})
  const [dadosVeiculo, setDadosVeiculo] = useState<Record<string, string>>({})
  const [dataInspecao, setDataInspecao] = useState(() => new Date().toISOString().split('T')[0] ?? '')

  const respondidos  = Object.values(respostas).filter((v) => v !== null).length
  const ncCount      = Object.values(respostas).filter((v) => v === 'nc').length
  const ncImperativos = todosItens.filter((it) => it.imperativo && respostas[it.id] === 'nc').length
  const progresso    = totalItens > 0 ? Math.round((respondidos / totalItens) * 100) : 0
  const concluido    = progresso === 100

  const setResposta = (id: string, valor: Resposta) =>
    setRespostas((prev) => ({ ...prev, [id]: prev[id] === valor ? null : valor }))

  const setDado = (id: string, valor: string) =>
    setDadosVeiculo((prev) => ({ ...prev, [id]: valor }))

  return (
    <div className="pb-32 lg:pb-8">

      {/* Cabeçalho */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            aria-label="Voltar"
          >
            <ChevronLeft size={18} />
          </button>
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-soft ${meta.corBg} ${meta.cor}`}>
            {meta.icon}
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {schema.nome}
            </div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {schema.descricao}
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="flex items-center gap-3 sm:justify-end">
          <span className="text-xs font-extrabold tabular-nums text-slate-500 dark:text-slate-400">
            {respondidos}/{totalItens} itens
          </span>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                ncImperativos > 0 ? 'bg-rose-500' :
                ncCount > 0      ? 'bg-amber-500' :
                concluido        ? 'bg-emerald-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
            {progresso}%
          </span>
        </div>
      </div>

      {/* Aviso imperativo */}
      {schema.grupos.some((g) => g.itens.some((i) => i.imperativo)) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
            🚫 Itens com este símbolo são <strong>IMPEDITIVOS</strong> — se marcados como NC, o veículo não poderá ser conduzido.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

        {/* Sidebar de dados do veículo */}
        <div className="lg:sticky lg:top-0 lg:w-64 lg:shrink-0 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Dados do Veículo
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 lg:grid-cols-1">
              {/* Data — sempre presente */}
              <div className="flex flex-col gap-0.5 bg-white px-4 py-3 dark:bg-slate-950 col-span-2 lg:col-span-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Data *</label>
                <input
                  type="date"
                  value={dataInspecao}
                  onChange={(e) => setDataInspecao(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]"
                />
              </div>
              {/* Campos extras do schema */}
              {(schema.camposExtras ?? []).map((campo) => (
                <div
                  key={campo.id}
                  className={`flex flex-col gap-0.5 bg-white px-4 py-3 dark:bg-slate-950 ${
                    campo.id === 'localidade' ? 'col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    {campo.label}{campo.obrigatorio ? ' *' : ''}
                  </label>
                  {campo.tipo === 'select' && campo.opcoes && campo.opcoes.length > 0 ? (
                    <select
                      value={dadosVeiculo[campo.id] ?? ''}
                      onChange={(e) => setDado(campo.id, e.target.value)}
                      className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none dark:text-slate-100"
                    >
                      <option value="">Escolher</option>
                      {campo.opcoes.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <input
                      type={campo.tipo === 'number' ? 'number' : 'text'}
                      inputMode={campo.tipo === 'number' ? 'numeric' : 'text'}
                      value={dadosVeiculo[campo.id] ?? ''}
                      onChange={(e) => setDado(campo.id, e.target.value)}
                      placeholder="Sua resposta"
                      className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Status + ação — sidebar desktop */}
            <div className="hidden border-t border-slate-100 p-4 dark:border-slate-800 lg:block">
              {ncImperativos > 0 ? (
                <p className="mb-3 text-sm font-extrabold text-rose-500">
                  🚫 {ncImperativos} item(s) impeditivo(s) NC
                </p>
              ) : ncCount > 0 ? (
                <p className="mb-3 text-sm font-extrabold text-amber-600 dark:text-amber-400">
                  {ncCount} item(s) com NC
                </p>
              ) : concluido ? (
                <p className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} /> Checklist concluído
                </p>
              ) : (
                <p className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {totalItens - respondidos} item(s) restante(s)
                </p>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!concluido}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-extrabold text-slate-900 shadow-soft transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Imprimir / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Grupos de itens */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {schema.grupos.map((grupo) => {
            const respondidosGrupo = grupo.itens.filter((it) => respostas[it.id] != null).length
            const grupoCompleto = respondidosGrupo === grupo.itens.length
            return (
              <div
                key={grupo.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {grupo.titulo}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    grupoCompleto
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {respondidosGrupo}/{grupo.itens.length}
                  </span>
                </div>

                {/* Cabeçalho das colunas */}
                <div className="grid grid-cols-[1fr_auto] border-b border-slate-100 bg-slate-50/50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/30">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Item</span>
                  <div className="flex gap-2">
                    {OPCOES.map((o) => (
                      <span key={o.valor} className="w-14 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400 sm:w-16">
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>

                {grupo.itens.map((item, idx) => {
                  const resp = respostas[item.id] ?? null
                  const obs  = observacoes[item.id] ?? ''
                  const isLast = idx === grupo.itens.length - 1

                  const bgClass =
                    resp === 'nc' ? 'bg-rose-50/60 dark:bg-rose-900/10' :
                    resp === 'c'  ? 'bg-emerald-50/40 dark:bg-emerald-900/5' :
                    resp === 'na' ? 'bg-slate-50/80 dark:bg-slate-900/20' :
                    ''

                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 transition-colors ${!isLast ? 'border-b border-slate-100 dark:border-slate-800/80' : ''} ${bgClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 pt-1">
                          {item.imperativo && (
                            <span className="mt-0.5 shrink-0 text-sm" title="Item impeditivo">🚫</span>
                          )}
                          <span className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {OPCOES.map(({ valor, label, titulo, activeClass, idleClass }) => (
                            <button
                              key={valor}
                              type="button"
                              title={titulo}
                              onClick={() => setResposta(item.id, valor)}
                              className={`flex h-11 w-14 items-center justify-center rounded-xl border-2 text-xs font-extrabold transition-transform active:scale-95 sm:h-10 sm:w-16 ${resp === valor ? activeClass : idleClass}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {resp === 'nc' && (
                        <textarea
                          rows={2}
                          value={obs}
                          onChange={(e) => setObservacoes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Descreva o problema encontrado..."
                          className="mt-2 w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-400 dark:border-rose-800/60 dark:bg-slate-900/60 dark:text-slate-100"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Barra inferior — mobile/tablet */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {ncImperativos > 0 ? (
              <p className="text-sm font-extrabold text-rose-500">🚫 {ncImperativos} item(s) impeditivo(s) NC</p>
            ) : ncCount > 0 ? (
              <p className="truncate text-sm font-extrabold text-amber-600 dark:text-amber-400">{ncCount} item(s) com NC</p>
            ) : concluido ? (
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> Checklist concluído
              </p>
            ) : (
              <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
                {totalItens - respondidos} item(s) restante(s)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!concluido}
            className="h-12 shrink-0 rounded-xl bg-slate-900 px-5 text-sm font-extrabold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tela de seleção (grade de cards)
// ---------------------------------------------------------------------------
export function ChecklistsPage() {
  const [query, setQuery] = useState('')
  const [selecionado, setSelecionado] = useState<ChecklistSchemaDef | null>(null)

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CHECKLIST_SCHEMAS
    return CHECKLIST_SCHEMAS.filter(
      (s) => s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q),
    )
  }, [query])

  if (selecionado) {
    return <ChecklistForm schema={selecionado} onVoltar={() => setSelecionado(null)} />
  }

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          to="/gerenciar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">
          <ClipboardList size={20} />
        </div>
        <div>
          <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Checklists</div>
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Selecione o tipo de veículo</div>
        </div>
      </div>

      {/* Busca + Resultados */}
      <div data-tour="checklists-actions" className="flex gap-2">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <Search size={18} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar checklist..."
            className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <Link
          to="/gerenciar/checklists/resultados"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <BarChart2 size={16} />
          <span className="hidden sm:inline">Resultados</span>
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm font-semibold text-slate-400">
            Nenhum checklist encontrado para "{query}"
          </div>
        ) : (
          filtrados.map((schema) => {
            const meta = getMeta(schema.id)
            const totalItens = schema.grupos.reduce((acc, g) => acc + g.itens.length, 0)
            const totalImperativos = schema.grupos.flatMap((g) => g.itens).filter((i) => i.imperativo).length
            return (
              <button
                key={schema.id}
                type="button"
                onClick={() => setSelecionado(schema)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md active:scale-[.98] dark:border-slate-800 dark:bg-slate-950"
              >
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${meta.corBg} ${meta.cor}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-black text-slate-900 dark:text-slate-100">
                    {schema.nome}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {schema.descricao}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {schema.grupos.map((g) => (
                      <span
                        key={g.id}
                        className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
                      >
                        {g.titulo}
                      </span>
                    ))}
                    {totalImperativos > 0 && (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                        🚫 {totalImperativos} imperativos
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  <span className={`text-2xl font-black ${meta.cor}`}>{totalItens}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    itens
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
