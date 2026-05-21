/** Prefixo legado — a coluna Processo já identifica checklist NC. */
const LEGACY_CHECKLIST_NC_PREFIX = /^\s*\[Checklist NC\]\s*/i

export function formatDefeitoParaExibicao(defeito: string): string {
  return defeito.replace(LEGACY_CHECKLIST_NC_PREFIX, '').trim()
}
