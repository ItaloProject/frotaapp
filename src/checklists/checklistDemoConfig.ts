import { getDisplayedFleetVehicles, formatPlaca } from '../frota/vehicleRegistry'

export type ChecklistDemoProfile = {
  tipo: string
  operador: string
  matricula: string
  supervisor: string
  localidade: string
  km: string
  horimetro: string
}

const DEMO_DEFAULTS: ChecklistDemoProfile = {
  tipo: 'sky',
  operador: 'Carlos Mendes',
  matricula: '1024',
  supervisor: 'ITALO BRUNO DA SILVA FONTES',
  localidade: 'Presidente Dutra - MA',
  km: '45280',
  horimetro: '3821',
}

// Mapeia o id do checklist para os tipos de veículo correspondentes no registro.
const DEMO_TIPO_MAP: Record<string, string[]> = {
  'sky':          ['SKY'],
  'munck':        ['MUNCK'],
  'picape-leve':  ['PICAPE LEVE'],
  'picape-4x4':   ['PICAPE 4X4'],
  'motocicleta':  ['MOTO'],
  'veiculo-leve': ['VEICULOS LEVES'],
}

function findDemoVehicle(tipo: string) {
  const tipos = DEMO_TIPO_MAP[tipo] ?? []
  const ativos = getDisplayedFleetVehicles().filter((v) => v.status === 'ATIVO')
  // Tenta casar pelo tipo do checklist; se não achar, usa qualquer veículo ativo.
  return ativos.find((v) => tipos.includes(v.tipo)) ?? ativos[0]
}

export function resolveDemoProfile(tipoOverride?: string | null): ChecklistDemoProfile {
  const tipo = tipoOverride?.trim() || DEMO_DEFAULTS.tipo
  const vehicle = findDemoVehicle(tipo)

  return {
    ...DEMO_DEFAULTS,
    tipo,
    localidade: vehicle?.base?.trim() || DEMO_DEFAULTS.localidade,
  }
}

export function resolveDemoVehicleFields(tipo: string) {
  const vehicle = findDemoVehicle(tipo)

  if (!vehicle) {
    return {
      placa: 'ABC1D23',
      marca_modelo: 'VW/GOL',
      km_atual: DEMO_DEFAULTS.km,
      horimetro: DEMO_DEFAULTS.horimetro,
      prefixo: 'BASE-A01',
      localidade: DEMO_DEFAULTS.localidade,
    }
  }

  return {
    placa: formatPlaca(vehicle.placa),
    marca_modelo: vehicle.modelo,
    km_atual: DEMO_DEFAULTS.km,
    horimetro: DEMO_DEFAULTS.horimetro,
    prefixo: vehicle.prefixo && vehicle.prefixo !== 'N/A' ? vehicle.prefixo : '—',
    localidade: vehicle.base?.trim() || DEMO_DEFAULTS.localidade,
  }
}

/** ms base — dividido pelo fator de velocidade em tempo de execução */
export const DEMO_TIMING = {
  selectPause: 1800,
  selectHighlight: 700,
  identifyChar: 55,
  identifyPause: 400,
  identifySubmit: 600,
  formStart: 500,
  fieldChar: 35,
  fieldPause: 280,
  supervisorPause: 500,
  itemScroll: 380,
  itemAnswer: 220,
  beforeSubmit: 700,
  submitting: 1400,
  /** Tela de conclusão renderizada antes de abrir o WhatsApp */
  conclusionScreen: 1200,
  /** Modal WhatsApp visível antes da narração final */
  conclusionWhatsappOpen: 900,
  /** Tempo para ler a mensagem no modal antes de encerrar o demo */
  conclusionWhatsappHold: 6500,
  conclusionHold: 4500,
} as const

export function demoDelay(ms: number, speedFactor: number): number {
  return Math.max(16, Math.round(ms / speedFactor))
}
