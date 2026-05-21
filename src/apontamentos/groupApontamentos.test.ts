import { describe, expect, it } from 'vitest'
import type { Apontamento } from './ApontamentosContext'
import {
  apontamentoGroupKey,
  buildHistoricoResolvidoEntries,
  buildManageTableRows,
  countConsecutiveDays,
  findRecorrenteSiblingIds,
} from './groupApontamentos'

function R(p: Partial<Apontamento> & Pick<Apontamento, 'id'>): Apontamento {
  return {
    checklistId: 'cl-1',
    ncItemId: 'item-a',
    veiculoId: 'v-1',
    placa: 'ABC1234',
    modelo: 'Hilux',
    veiculoLabel: '0101 · ABC-1234',
    prefixo: '0101',
    defeito: 'Pneu desgastado',
    dataApontamento: '2026-05-20',
    horaApontamento: '08:00',
    prazo: null,
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

describe('apontamentoGroupKey', () => {
  it('usa placa + ncItemId para pendentes', () => {
    expect(apontamentoGroupKey(R({ id: '1' }))).toBe('ABC1234__item-a')
  })

  it('retorna null para resolvidos', () => {
    expect(apontamentoGroupKey(R({ id: '1', resolvido: true }))).toBeNull()
  })
})

describe('countConsecutiveDays', () => {
  it('conta dias consecutivos', () => {
    expect(countConsecutiveDays(['2026-05-18', '2026-05-19', '2026-05-20'])).toBe(3)
    expect(countConsecutiveDays(['2026-05-18', '2026-05-20'])).toBe(1)
  })
})

describe('buildManageTableRows', () => {
  it('agrupa pendentes com mesma placa e ncItemId', () => {
    const rows = [
      R({ id: '1', dataApontamento: '2026-05-18', checklistId: 'cl-a' }),
      R({ id: '2', dataApontamento: '2026-05-19', checklistId: 'cl-b' }),
      R({ id: '3', dataApontamento: '2026-05-20', checklistId: 'cl-c' }),
    ]
    const out = buildManageTableRows(rows, true, 'desc')
    expect(out).toHaveLength(1)
    expect(out[0]?.type).toBe('group')
    if (out[0]?.type === 'group') {
      expect(out[0].group.count).toBe(3)
      expect(out[0].group.representative.id).toBe('3')
    }
  })

  it('não agrupa quando agrupar=false', () => {
    const rows = [
      R({ id: '1', dataApontamento: '2026-05-18' }),
      R({ id: '2', dataApontamento: '2026-05-19' }),
    ]
    expect(buildManageTableRows(rows, false, 'asc')).toHaveLength(2)
  })

  it('mantém resolvidos como linhas individuais', () => {
    const rows = [
      R({ id: '1', resolvido: true, dataResolvido: '2026-05-20' }),
      R({ id: '2', dataApontamento: '2026-05-19' }),
      R({ id: '3', dataApontamento: '2026-05-20' }),
    ]
    const out = buildManageTableRows(rows, true, 'asc')
    expect(out.filter((x) => x.type === 'single')).toHaveLength(1)
    expect(out.filter((x) => x.type === 'group')).toHaveLength(1)
  })
})

describe('findRecorrenteSiblingIds', () => {
  it('retorna todos os pendentes do mesmo defeito', () => {
    const rows = [
      R({ id: '1', dataApontamento: '2026-05-18' }),
      R({ id: '2', dataApontamento: '2026-05-19' }),
      R({ id: '3', dataApontamento: '2026-05-20', ncItemId: 'item-b' }),
    ]
    expect(findRecorrenteSiblingIds(rows, '2')).toEqual(['1', '2'])
  })

  it('retorna só o id quando não há par', () => {
    const rows = [R({ id: '1' })]
    expect(findRecorrenteSiblingIds(rows, '1')).toEqual(['1'])
  })
})

describe('buildHistoricoResolvidoEntries', () => {
  it('usa o primeiro dia de apontamento e uma linha por resolução', () => {
    const rows = [
      R({ id: '1', dataApontamento: '2026-05-16', dataResolvido: '2026-05-20', resolvido: true, reparoValor: 100 }),
      R({ id: '2', dataApontamento: '2026-05-18', dataResolvido: '2026-05-20', resolvido: true }),
      R({ id: '3', dataApontamento: '2026-05-20', dataResolvido: '2026-05-20', resolvido: true }),
    ]
    const out = buildHistoricoResolvidoEntries(rows)
    expect(out).toHaveLength(1)
    expect(out[0]?.dataPrimeiroApontamento).toBe('2026-05-16')
    expect(out[0]?.dataResolvido).toBe('2026-05-20')
    expect(out[0]?.count).toBe(3)
  })
})
