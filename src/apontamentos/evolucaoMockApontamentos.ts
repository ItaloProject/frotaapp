import type { Apontamento } from './ApontamentosContext'

const p2 = (n: number) => String(n).padStart(2, '0')

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`
}

function mk(
  id: number,
  dataApontamento: string,
  resolvido: boolean,
  cicloDias?: number,
): Apontamento {
  const sid = String(id)
  const prefix = String(1000 + (id % 899))
  const cicloDiasFinal =
    resolvido && cicloDias != null ? Math.min(45, Math.max(2, Math.round(cicloDias))) : resolvido ? 10 : 0
  return {
    id: `mock-ev-${sid}`,
    veiculoId: `v-mock-${sid}`,
    veiculoLabel: `${prefix} · XYZ-${p2(id % 99)}`,
    prefixo: prefix,
    defeito: `Falha mock #${sid}`,
    dataApontamento,
    prazo: addDays(dataApontamento, 14),
    resolvido,
    dataResolvido: resolvido ? addDays(dataApontamento, cicloDiasFinal) : null,
    horaResolvido: resolvido ? '08:30' : null,
    reparoValor: null,
    reparoDescricao: null,
    reparoImagens: [],
    osArquivo: null,
    processo: ['frota', 'transporte', 'checklist', 'goman', 'gstc', 'adm'][id % 6]!,
    base: id % 2 === 0 ? 'Base 01' : 'Base 02',
    coordenador: ['Jackson', 'Jamerson', 'JOÃO FELIPE', 'DESMOBILIZADO', 'FROTA', 'JÚLIO'][id % 6]!,
    responsavel: 'Resp. Mock',
    placa:       '',
    modelo:      '',
    checklistId: `mock-cl-${sid}`,
    ncItemId:    `mock-item-${sid}`,
    ncFotos:              [],
    problemasAdicionais:  '',
    descricaoProblema:    '',
    imperativo:           false,
    horaApontamento:      '',
    justificado:          false,
    justificativa:        null,
    justificativaData:    null,
    justificativaImagem:  null,
    agendamentoData:      null,
  }
}

/**
 * 50 defeitos Jan–Mai/2026: 70% resolvidos (ciclo 2–45d), 30% pendentes.
 * Pico de aberturas na 1ª semana de mar/2026 (02–08).
 *
 * Ative em EvolucaoPage com `EVOLUCAO_PAGE_USE_MOCK_ROWS`.
 */
export const EVOLUCAO_MOCK_APONTAMENTOS: Apontamento[] = (() => {
  const out: Apontamento[] = []
  let id = 1

  // 20 itens — pico 2–8 mar: 14 resolvidos + 6 pendentes
  for (let i = 0; i < 20; i++) {
    const day = 2 + (i % 7)
    const dataAp = `2026-03-${p2(day)}`
    const resolvido = i < 14
    const ciclo = 2 + ((i * 7 + i * i) % 44)
    out.push(mk(id++, dataAp, resolvido, resolvido ? ciclo : undefined))
  }

  // 30 itens — restante Jan, Fev, Abr, Mai: 21 resolvidos + 9 pendentes
  const rest: Array<{ ap: string; resolvido: boolean; ciclo?: number }> = [
    { ap: '2026-01-05', resolvido: true, ciclo: 8 },
    { ap: '2026-01-09', resolvido: true, ciclo: 35 },
    { ap: '2026-01-14', resolvido: false },
    { ap: '2026-01-18', resolvido: true, ciclo: 4 },
    { ap: '2026-01-22', resolvido: true, ciclo: 45 },
    { ap: '2026-01-27', resolvido: true, ciclo: 19 },
    { ap: '2026-02-02', resolvido: false },
    { ap: '2026-02-07', resolvido: true, ciclo: 11 },
    { ap: '2026-02-11', resolvido: true, ciclo: 28 },
    { ap: '2026-02-16', resolvido: true, ciclo: 3 },
    { ap: '2026-02-21', resolvido: false },
    { ap: '2026-02-25', resolvido: true, ciclo: 39 },
    { ap: '2026-02-28', resolvido: true, ciclo: 16 },
    { ap: '2026-04-03', resolvido: true, ciclo: 7 },
    { ap: '2026-04-08', resolvido: false },
    { ap: '2026-04-12', resolvido: true, ciclo: 31 },
    { ap: '2026-04-17', resolvido: true, ciclo: 22 },
    { ap: '2026-04-22', resolvido: false },
    { ap: '2026-04-26', resolvido: true, ciclo: 14 },
    { ap: '2026-05-01', resolvido: true, ciclo: 42 },
    { ap: '2026-05-06', resolvido: false },
    { ap: '2026-05-10', resolvido: true, ciclo: 6 },
    { ap: '2026-05-14', resolvido: true, ciclo: 33 },
    { ap: '2026-05-18', resolvido: false },
    { ap: '2026-05-22', resolvido: true, ciclo: 25 },
    { ap: '2026-05-26', resolvido: true, ciclo: 9 },
    { ap: '2026-05-30', resolvido: false },
    { ap: '2026-01-30', resolvido: true, ciclo: 21 },
    { ap: '2026-02-19', resolvido: true, ciclo: 13 },
    { ap: '2026-04-30', resolvido: false },
  ]

  for (const r of rest) {
    out.push(mk(id++, r.ap, r.resolvido, r.ciclo))
  }

  return out
})()
