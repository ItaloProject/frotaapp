/**
 * Mapeamento de Gerência → Responsáveis → Bases (dados fictícios para portfólio).
 */

export type GerenciaEntry = {
  gerencia: string
  gerenciaLabel: string
  responsaveis: {
    nome: string
    bases: string[]
  }[]
}

export const GERENCIA_MAP: GerenciaEntry[] = [
  {
    gerencia: 'frota',
    gerenciaLabel: 'FROTA',
    responsaveis: [
      { nome: 'RESPONSAVEL-A', bases: [] },
      { nome: 'RESPONSAVEL-B', bases: [] },
    ],
  },
  {
    gerencia: 'coord-a',
    gerenciaLabel: 'COORD-A',
    responsaveis: [
      { nome: 'RESPONSAVEL-C', bases: ['BASE-A', 'BASE-B'] },
      { nome: 'RESPONSAVEL-D', bases: ['BASE-C'] },
    ],
  },
  {
    gerencia: 'coord-b',
    gerenciaLabel: 'COORD-B',
    responsaveis: [
      { nome: 'RESPONSAVEL-E', bases: ['BASE-A'] },
      { nome: 'RESPONSAVEL-F', bases: ['BASE-D', 'BASE-E'] },
    ],
  },
  {
    gerencia: 'coord-c',
    gerenciaLabel: 'COORD-C',
    responsaveis: [
      { nome: 'RESPONSAVEL-G', bases: [] },
      { nome: 'RESPONSAVEL-H', bases: ['BASE-B', 'BASE-F'] },
    ],
  },
  {
    gerencia: 'coord-d',
    gerenciaLabel: 'COORD-D',
    responsaveis: [
      { nome: 'RESPONSAVEL-A', bases: ['BASE-C'] },
      { nome: 'RESPONSAVEL-B', bases: ['BASE-E'] },
    ],
  },
  {
    gerencia: 'coord-e',
    gerenciaLabel: 'COORD-E',
    responsaveis: [
      { nome: 'RESPONSAVEL-C', bases: [] },
      { nome: 'RESPONSAVEL-D', bases: ['BASE-F'] },
    ],
  },
  {
    gerencia: 'coord-f',
    gerenciaLabel: 'COORD-F',
    responsaveis: [
      { nome: 'RESPONSAVEL-E', bases: ['BASE-A', 'BASE-B', 'BASE-C'] },
    ],
  },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function getResponsaveisByGerencia(gerencia: string): string[] | null {
  if (gerencia === 'todos') return null
  const entry = GERENCIA_MAP.find((e) => e.gerencia === gerencia)
  if (!entry) return null
  return entry.responsaveis.map((r) => r.nome)
}

export function getBasesByGerenciaAndResponsavel(gerencia: string, responsavel: string): string[] | null {
  if (gerencia === 'todos') return null
  const entry = GERENCIA_MAP.find((e) => e.gerencia === gerencia)
  if (!entry) return null

  if (responsavel === 'todos') {
    const bases = new Set<string>()
    for (const r of entry.responsaveis) {
      for (const b of r.bases) bases.add(b)
    }
    return bases.size > 0 ? Array.from(bases) : null
  }

  const resp = entry.responsaveis.find((r) => norm(r.nome) === norm(responsavel))
  if (!resp || resp.bases.length === 0) return null
  return resp.bases
}
