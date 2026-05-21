import { describe, expect, it } from 'vitest'
import { formatPlaca, normalizePlaca } from './vehicleRegistry'

describe('normalizePlaca', () => {
  it('remove espaços e pontuação e limita a 7 caracteres', () => {
    expect(normalizePlaca('  abc-1234  ')).toBe('ABC1234')
    expect(normalizePlaca('ab12ç3456')).toBe('AB12345')
  })

  it('retorna string vazia para apenas separadores', () => {
    expect(normalizePlaca('  - .  ')).toBe('')
  })
})

describe('formatPlaca', () => {
  it('formata padrão antigo AAA9999 com hífen', () => {
    expect(formatPlaca('abc 1234')).toBe('ABC-1234')
  })

  it('mantém Mercosul e outros formatos após normalização', () => {
    expect(formatPlaca('abc1d23')).toBe('ABC1D23')
  })
})
