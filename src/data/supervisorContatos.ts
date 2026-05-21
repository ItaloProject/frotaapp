/**
 * Mapeamento de supervisor → número de WhatsApp (dados fictícios para demo).
 */
export const SUPERVISOR_WHATSAPP: Record<string, string> = {
  'CARLOS LIMA':     '5511900000001',
  'DIEGO SOUZA':     '5511900000002',
  'EDUARDO NUNES':   '5511900000003',
  'FABIO MARTINS':   '5511900000004',
  'GABRIEL COSTA':   '5511900000005',
  'HUGO FERREIRA':   '5511900000006',
  'IGOR PEREIRA':    '5511900000007',
  'JONAS ROCHA':     '5511900000008',
  'LUCAS ALVES':     '5511900000009',
  'MARCOS DIAS':     '5511900000010',
  'NELSON CUNHA':    '5511900000011',
  'OTAVIO REIS':     '5511900000012',
  'PAULO BORGES':    '5511900000013',
  'RAFAEL TEIXEIRA': '5511900000014',
  'SERGIO MOURA':    '5511900000015',
}

/** Número de fallback quando o supervisor não for encontrado no mapeamento. */
export const SUPERVISOR_WHATSAPP_FALLBACK = '5511900000000'

/** Retorna o número do supervisor ou o fallback. */
export function getSupervisorWhatsapp(nome: string): string {
  const upper = nome.trim().toUpperCase()
  return SUPERVISOR_WHATSAPP[upper] ?? SUPERVISOR_WHATSAPP_FALLBACK
}

/** Verifica se o supervisor está mapeado. */
export function isSupervisorReconhecido(nome: string): boolean {
  return nome.trim().toUpperCase() in SUPERVISOR_WHATSAPP
}

type WhatsappLinkParams = {
  numero: string
  mensagem?: string
  nomeSupervisor?: string
  operador?: string
  veiculo?: string
  ncCount?: number
  ncImperativos?: number
  itensNc?: Array<{ label: string; imperativo: boolean; obs: string } | string>
  fotosUrls?: string[]
  problemas?: string
  descricaoProblema?: string
}

/** Monta link de WhatsApp com mensagem pré-formatada. */
export function buildWhatsappLink({ numero, mensagem, nomeSupervisor, operador, veiculo, ncCount, ncImperativos }: WhatsappLinkParams): string {
  const num = numero.replace(/\D/g, '')
  let texto = mensagem ?? ''
  if (!texto && operador) {
    const linhas = [
      `*FrotaApp — Checklist*`,
      nomeSupervisor ? `Supervisor: ${nomeSupervisor}` : '',
      operador ? `Operador: ${operador}` : '',
      veiculo ? `Veículo: ${veiculo}` : '',
      ncCount !== undefined ? `NC: ${ncCount}` : '',
      ncImperativos ? `⚠️ Imperativos: ${ncImperativos}` : '',
    ].filter(Boolean)
    texto = linhas.join('\n')
  }
  const msg = texto ? encodeURIComponent(texto) : ''
  return `https://wa.me/${num}${msg ? `?text=${msg}` : ''}`
}
