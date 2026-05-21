import { describe, expect, it } from 'vitest'
import type { Apontamento } from './ApontamentosContext'
import {
  buildMonthlyChartPoints,
  buildWeeklyChartPoints,
  filterResolvidosParaEvolucao,
  mediaDiasApontamentoResolucao,
} from './evolucaoAnalytics'

function R(p: Partial<Apontamento> & Pick<Apontamento, 'id'>): Apontamento {
  return {
    checklistId: 'cl-test',
    ncItemId: 'item-test',
    veiculoId: `v-${p.id}`,
    placa: 'ABC1234',
    modelo: 'Hilux',
    veiculoLabel: '0101 · ABC-1234',
    prefixo: '0101',
    defeito: 'Defeito teste',
    dataApontamento: '2026-01-01',
    horaApontamento: '08:00',
    prazo: '2026-01-20',
    resolvido: false,
    dataResolvido: null,
    horaResolvido: null,
    reparoValor: null,
    reparoDescricao: null,
    reparoImagens: [],
    osArquivo: null,
    processo: 'Checklist',
    base: 'Base 01',
    coordenador: 'Carlos',
    responsavel: 'João',
    ncFotos: [],
    problemasAdicionais: '',
    descricaoProblema: '',
    imperativo: false,
    justificado: false,
    justificativa: null,
    justificativaData: null,
    justificativaImagem: null,
    agendamentoData: null,
    ...p,
  }
}

describe('filterResolvidosParaEvolucao', () => {
  it('ignora não resolvidos', () => {
    const rows = [R({ id: '1', resolvido: false, dataResolvido: null })]
    const out = filterResolvidosParaEvolucao(rows, {
      base: 'todos',
      coordenador: 'todos',
      responsavel: 'todos',
      prefixo: 'todos',
      data: 'todos',
    })
    expect(out).toHaveLength(0)
  })
})

describe('buildWeeklyChartPoints', () => {
  it('agrupa resoluções na mesma semana e mantém série contínua', () => {
    const rows = [
      R({ id: '1', resolvido: true, dataResolvido: '2026-01-15', dataApontamento: '2026-01-01' }),
      R({ id: '2', resolvido: true, dataResolvido: '2026-01-16', dataApontamento: '2026-01-10' }),
    ]
    const pts = buildWeeklyChartPoints(rows)
    expect(pts).toHaveLength(1)
    expect(pts[0]!.resolvidos).toBe(2)
  })
})

describe('buildMonthlyChartPoints', () => {
  it('agrupa por mês', () => {
    const rows = [
      R({ id: '1', resolvido: true, dataResolvido: '2026-01-10', dataApontamento: '2026-01-01' }),
      R({ id: '2', resolvido: true, dataResolvido: '2026-01-20', dataApontamento: '2026-01-05' }),
    ]
    const pts = buildMonthlyChartPoints(rows)
    expect(pts).toHaveLength(1)
    expect(pts[0]!.resolvidos).toBe(2)
  })
})

describe('mediaDiasApontamentoResolucao', () => {
  it('calcula média em dias', () => {
    const rows = [
      R({
        id: '1',
        resolvido: true,
        dataApontamento: '2026-01-01',
        dataResolvido: '2026-01-11',
      }),
    ]
    expect(mediaDiasApontamentoResolucao(rows)).toBe(10)
  })
})
