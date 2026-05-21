import { describe, expect, it } from 'vitest'
import {
  getVehicleOperationalStatusSummary,
  getVehicleOperationalStatusRowsWithLocals,
  isOperacionalAtivosDashboardKpi,
  resolveStatusOperacional,
} from './vehicleOperationalStatus'

describe('resolveStatusOperacional', () => {
  it('marca INATIVO como DESMOBILIZADO', () => {
    expect(resolveStatusOperacional('ABC1234', '0101', 'INATIVO')).toBe('DESMOBILIZADO')
  })

  it('mantém prefixo operacional quando ATIVO', () => {
    expect(resolveStatusOperacional('ABC1234', '0101', 'ATIVO')).toBe('0101')
  })
})

describe('isOperacionalAtivosDashboardKpi', () => {
  it('exclui veículo inativo do KPI de ativos', () => {
    expect(isOperacionalAtivosDashboardKpi('ABC1234', '0101', 'INATIVO')).toBe(false)
  })

  it('inclui veículo ativo com prefixo operacional', () => {
    expect(isOperacionalAtivosDashboardKpi('ABC1234', '0101', 'ATIVO')).toBe(true)
  })
})

describe('getVehicleOperationalStatusRowsWithLocals', () => {
  it('move inativo de ATIVOS para DESMOBILIZADO no resumo', () => {
    const rows = getVehicleOperationalStatusRowsWithLocals([
      { placa: 'ABC1234', prefixo: '0101', base: 'BASE 01', status: 'ATIVO' },
      { placa: 'XYZ9876', prefixo: '0202', base: 'BASE 02', status: 'INATIVO' },
    ])
    const summary = getVehicleOperationalStatusSummary(rows)
    expect(summary.find((s) => s.label === 'ATIVOS')?.count).toBe(1)
    expect(summary.find((s) => s.label === 'DESMOBILIZADO')?.count).toBe(1)
  })
})
