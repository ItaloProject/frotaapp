/**
 * Lê VEICULOS LEVES.txt — formato esperado: **5 colunas** (sem KM):
 *   PLACA, MARCA/MODELO, PREFIXO, PROCESSO, LOCALIDADE
 * (O parser partilhado também aceita 6 colunas com KM ATUAL, como no PICAPE LEVE, caso o ficheiro mude.)
 * Separador: TAB, ; ou ,. Deduplica por placa (última linha vence).
 * Uso: node scripts/generate-veiculos-leves-fleet.mjs [caminho-para-VEICULOS LEVES.txt]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFiveColumnFleetText } from './lib/parseFiveColumnFleetText.mjs'
import { resolveDefaultFleetInput } from './lib/resolveDefaultFleetInput.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.resolve(process.argv[2] || resolveDefaultFleetInput('VEICULOS LEVES.txt'))
const dest = path.join(__dirname, '..', 'src', 'data', 'veiculosLevesFleet.gen.ts')

if (!fs.existsSync(input)) {
  console.error(`Ficheiro não encontrado: ${input}`)
  console.error('Passe o caminho completo como argumento, por exemplo:')
  console.error('  node scripts/generate-veiculos-leves-fleet.mjs "C:\\Users\\...\\VEICULOS LEVES.txt"')
  process.exit(1)
}

const raw = fs.readFileSync(input, 'utf8')
const { rows: arr, delimiter, layout } = parseFiveColumnFleetText(raw)
const delimLabel = delimiter === '\t' ? 'TAB' : delimiter === ';' ? 'ponto e vírgula' : 'vírgula'
const dataLines = raw.split(/\r?\n/).filter((l) => l.trim()).length - 1
if (arr.length === 0 && dataLines > 0) {
  console.warn(
    'Aviso: 0 veículos importados. Confirme cabeçalho na 1.ª linha, 5 colunas e separador TAB ou ; (export Excel PT-BR).',
  )
}
fs.mkdirSync(path.dirname(dest), { recursive: true })
const body =
  '// Gerado por: node scripts/generate-veiculos-leves-fleet.mjs — uma linha por placa (em duplicatas, a ultima linha vence).\n' +
  'export type VeiculosLevesFleetSourceRow = { placa: string; modelo: string; prefixo: string; processo: string; localidade: string }\n' +
  'export const VEICULOS_LEVES_FLEET_ROWS: VeiculosLevesFleetSourceRow[] = ' +
  JSON.stringify(arr, null, 2) +
  '\n'

fs.writeFileSync(dest, body, 'utf8')
console.log(`Separador: ${delimLabel}, layout: ${layout} colunas. Escritos ${arr.length} veículos em ${dest}`)
