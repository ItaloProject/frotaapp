/**
 * Gera MP3s com voz neural Microsoft (pt-BR-FranciscaNeural).
 * Mantém os textos alinhados com src/checklists/demoNarration.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EdgeTTS } from 'edge-tts-universal'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/demo-narration')

/** Voz neural brasileira — natural e clara para apresentações */
const VOICE = 'pt-BR-FranciscaNeural'
const PROSODY = { rate: '-4%', volume: '+0%', pitch: '+0Hz' }

const STEPS = [
  ['01-selecionar-checklist.mp3', 'Selecione o tipo de checklist correspondente ao veículo que será inspecionado.'],
  ['02-identificacao.mp3', 'Informe o nome e a matrícula do operador responsável pela inspeção.'],
  ['03-dados-veiculo.mp3', 'Preencha os dados do veículo: placa, quilometragem, horímetro e localidade. A localidade pode ser capturada pelo GPS ou digitada manualmente.'],
  ['04-supervisor.mp3', 'Indique o supervisor responsável. O sistema reconhece o contato e enviará alertas automáticos via WhatsApp em caso de não conformidade.'],
  ['05-itens-inspecao.mp3', 'Responda cada item da inspeção: C para conforme, NC para não conforme, ou NA quando o item não se aplica ao veículo.'],
  ['06-nc-pneus.mp3', 'Atenção: este item é impeditivo. Ao marcar NC, o veículo fica impedido de ser conduzido até a regularização. Descreva o problema e anexe uma foto.'],
  ['07-problemas.mp3', 'Registre aqui problemas adicionais encontrados durante a inspeção.'],
  ['08-evidencia-nr12.mp3', 'Anexe a evidência NR12. Este campo é exclusivo dos checklists SKY e Munck, e é obrigatório para concluir a inspeção.'],
  ['09-enviar.mp3', 'Com todos os itens respondidos, envie o checklist. O supervisor será notificado automaticamente.'],
  ['10-whatsapp.mp3', 'Confira a mensagem enviada ao supervisor pelo WhatsApp, com os detalhes da não conformidade e o alerta de veículo impedido.'],
]

async function synthesizeFile(filename, text) {
  const outPath = join(OUT_DIR, filename)
  process.stdout.write(`  ${filename}… `)

  const tts = new EdgeTTS(text, VOICE, PROSODY)
  const { audio } = await tts.synthesize()
  const buffer = Buffer.from(await audio.arrayBuffer())
  writeFileSync(outPath, buffer)

  console.log(`OK (${(buffer.length / 1024).toFixed(0)} KB)`)
}

mkdirSync(OUT_DIR, { recursive: true })

console.log(`Gerando narração — voz ${VOICE}\n`)

for (const [filename, text] of STEPS) {
  await synthesizeFile(filename, text)
}

console.log(`\n${STEPS.length} arquivos em public/demo-narration/`)
