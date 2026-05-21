import { describe, expect, it } from 'vitest'

import {
  buildChecklistAdherenceRanking,
  countDaysInPeriod,
  listDaysInPeriod,
  type ChecklistTop10Row,
} from './checklistTop10Ranking'

const frotaBase: ChecklistTop10Row[] = [
  {
    placa: 'ABC1D23',
    base: 'Base A',
    supervisor: 'Sup 1',
    coordenador: 'Ger 1',
    responsavel: 'João',
  },
]

describe('countDaysInPeriod', () => {
  it('conta dias inclusive no intervalo', () => {
    expect(countDaysInPeriod('2026-05-19', '2026-05-20')).toBe(2)
    expect(countDaysInPeriod('2026-05-20', '2026-05-20')).toBe(1)
  })
})

describe('buildChecklistAdherenceRanking', () => {
  it('calcula 50% quando 1 veículo preenche 1 de 2 dias', () => {
    const days = listDaysInPeriod('2026-05-19', '2026-05-20')
    const completions = new Set(['ABC1D23|2026-05-19'])

    const ranking = buildChecklistAdherenceRanking(frotaBase, completions, days, 'responsavel', 'best')

    expect(ranking).toHaveLength(1)
    expect(ranking[0]).toMatchObject({
      label: 'João',
      veiculos: 1,
      realizados: 1,
      esperados: 2,
      pct: 50,
    })
  })

  it('calcula 100% quando todos os dias foram preenchidos', () => {
    const days = listDaysInPeriod('2026-05-19', '2026-05-20')
    const completions = new Set(['ABC1D23|2026-05-19', 'ABC1D23|2026-05-20'])

    const ranking = buildChecklistAdherenceRanking(frotaBase, completions, days, 'responsavel', 'best')

    expect(ranking[0]?.pct).toBe(100)
  })

  it('ordena piores aderências primeiro no modo worst', () => {
    const frota: ChecklistTop10Row[] = [
      { placa: 'AAA1111', base: 'A', supervisor: 'S', coordenador: 'G', responsavel: 'Bom' },
      { placa: 'BBB2222', base: 'A', supervisor: 'S', coordenador: 'G', responsavel: 'Ruim' },
    ]
    const days = listDaysInPeriod('2026-05-19', '2026-05-20')
    const completions = new Set(['AAA1111|2026-05-19', 'AAA1111|2026-05-20'])

    const ranking = buildChecklistAdherenceRanking(frota, completions, days, 'responsavel', 'worst')

    expect(ranking[0]?.label).toBe('Ruim')
    expect(ranking[0]?.pct).toBe(0)
    expect(ranking[1]?.label).toBe('Bom')
    expect(ranking[1]?.pct).toBe(100)
  })
})
