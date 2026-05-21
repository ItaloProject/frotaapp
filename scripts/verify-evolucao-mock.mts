import { EVOLUCAO_MOCK_APONTAMENTOS } from '../src/apontamentos/evolucaoMockApontamentos'
import {
  buildWeeklyChartPoints,
  filterResolvidosParaEvolucao,
  mediaDiasApontamentoResolucao,
  mediaDiasNosPontosDoGrafico,
  mondayKeyFromDateIso,
  parseIsoDate,
} from '../src/apontamentos/evolucaoAnalytics'

const filtros = {
  processo: 'todos',
  base: 'todos',
  coordenador: 'todos',
  responsavel: 'todos',
  prefixo: 'todos',
  data: 'todos' as const,
}

const rows = EVOLUCAO_MOCK_APONTAMENTOS
const resolvidos = filterResolvidosParaEvolucao(rows, filtros)
const chartData = buildWeeklyChartPoints(resolvidos)

const totalOnChart = chartData.reduce((s, p) => s + p.resolvidos, 0)
const mediaCard = mediaDiasNosPontosDoGrafico(chartData)
const mediaGlobal = mediaDiasApontamentoResolucao(resolvidos)

const comDados = chartData.filter(
  (p): p is typeof p & { diasMedios: number } => p.diasMedios != null && p.resolvidos > 0,
)
const semanaRapida = comDados.reduce((best, p) => (p.diasMedios < best.diasMedios ? p : best))
const semanaLenta = comDados.reduce((worst, p) => (p.diasMedios > worst.diasMedios ? p : worst))

const datas = [...new Set(resolvidos.map((r) => r.dataResolvido).filter(Boolean))].sort() as string[]
let maxSemanas = 0
let da: string | null = null
let db: string | null = null
for (let i = 1; i < datas.length; i++) {
  const a = parseIsoDate(datas[i - 1]!)
  const b = parseIsoDate(datas[i]!)
  const semanas = Math.round((b - a) / (7 * 86_400_000))
  if (semanas > maxSemanas) {
    maxSemanas = semanas
    da = datas[i - 1]!
    db = datas[i]!
  }
}

console.log('— Mock —')
console.log('Resolvidos (filtro):', resolvidos.length)
console.log('Soma resolvidos no gráfico (semanas):', totalOnChart)
console.log('Média global (todos os resolvidos, peso por defeito):', mediaGlobal)
console.log('Card "Dias médios" = média dos pontos do gráfico (média por semana, depois média aritmética):', mediaCard)
console.log('Semana mais rápida:', semanaRapida.periodo, semanaRapida.diasMedios, 'd (chave', semanaRapida.chave + ')')
console.log('Semana mais lenta:', semanaLenta.periodo, semanaLenta.diasMedios, 'd (chave', semanaLenta.chave + ')')
console.log('Maior gap (semanas):', maxSemanas, da, '→', db)
console.log('— Última data de resolução (mock):', datas[datas.length - 1])
console.log('— Semanas com resolução após 31/mai (chave segunda):')
const afterMay = new Set(
  resolvidos
    .filter((r) => r.dataResolvido! > '2026-05-31')
    .map((r) => mondayKeyFromDateIso(r.dataResolvido!)),
)
console.log([...afterMay].sort())
for (const k of [...afterMay].sort()) {
  const inWeek = resolvidos.filter((r) => mondayKeyFromDateIso(r.dataResolvido!) === k)
  const d = inWeek.map((r) => `${r.dataApontamento}→${r.dataResolvido}`).join('; ')
  console.log(' ', k, inWeek.length, d)
}
