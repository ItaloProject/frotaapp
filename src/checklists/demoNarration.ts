/** Passos de narração do demo em /checklist/demo */
export type DemoNarrationStepId =
  | 'select-checklist'
  | 'identify'
  | 'dados-veiculo'
  | 'supervisor'
  | 'itens-intro'
  | 'item-nc-imperativo'
  | 'problemas'
  | 'evidencia-nr12'
  | 'enviar'
  | 'conclusao-whatsapp'

export type DemoNarrationStep = {
  text: string
  /** MP3 opcional em /public — se existir, tem prioridade sobre TTS */
  audio?: string
}

export const DEMO_NARRATION_STEPS: Record<DemoNarrationStepId, DemoNarrationStep> = {
  'select-checklist': {
    text: 'Selecione o tipo de checklist correspondente ao veículo que será inspecionado.',
    audio: '/demo-narration/01-selecionar-checklist.mp3',
  },
  identify: {
    text: 'Informe o nome e a matrícula do operador responsável pela inspeção.',
    audio: '/demo-narration/02-identificacao.mp3',
  },
  'dados-veiculo': {
    text: 'Preencha os dados do veículo: placa, quilometragem, horímetro e localidade. A localidade pode ser capturada pelo GPS ou digitada manualmente.',
    audio: '/demo-narration/03-dados-veiculo.mp3',
  },
  supervisor: {
    text: 'Indique o supervisor responsável. O sistema reconhece o contato e enviará alertas automáticos via WhatsApp em caso de não conformidade.',
    audio: '/demo-narration/04-supervisor.mp3',
  },
  'itens-intro': {
    text: 'Responda cada item da inspeção: C para conforme, NC para não conforme, ou NA quando o item não se aplica ao veículo.',
    audio: '/demo-narration/05-itens-inspecao.mp3',
  },
  'item-nc-imperativo': {
    text: 'Atenção: este item é impeditivo. Ao marcar NC, o veículo fica impedido de ser conduzido até a regularização. Descreva o problema e anexe uma foto.',
    audio: '/demo-narration/06-nc-pneus.mp3',
  },
  'problemas': {
    text: 'Registre aqui problemas adicionais encontrados durante a inspeção.',
    audio: '/demo-narration/07-problemas.mp3',
  },
  'evidencia-nr12': {
    text: 'Anexe a evidência NR12. Este campo é exclusivo dos checklists SKY e Munck, e é obrigatório para concluir a inspeção.',
    audio: '/demo-narration/08-evidencia-nr12.mp3',
  },
  enviar: {
    text: 'Com todos os itens respondidos, envie o checklist. O supervisor será notificado automaticamente.',
    audio: '/demo-narration/09-enviar.mp3',
  },
  'conclusao-whatsapp': {
    text: 'Confira a mensagem enviada ao supervisor pelo WhatsApp, com os detalhes da não conformidade e o alerta de veículo impedido.',
    audio: '/demo-narration/10-whatsapp.mp3',
  },
}
