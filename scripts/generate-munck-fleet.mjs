/**
 * Lê MUNCK.txt (TSV: PLACA, MARCA/MODELO, PROCESSO, LOCALIDADE), deduplica por placa
 * (última linha vence) e gera `src/data/munckFleet.gen.ts`.
 * Uso: node scripts/generate-munck-fleet.mjs [caminho-para-MUNCK.txt]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDefaultFleetInput } from './lib/resolveDefaultFleetInput.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.resolve(process.argv[2] || resolveDefaultFleetInput('MUNCK.txt'))
const dest = path.join(__dirname, '..', 'src', 'data', 'munckFleet.gen.ts')

const raw = fs.readFileSync(input, 'utf8')
const lines = raw.split(/\r?\n/).filter((l) => l.trim())
const byPlaca = new Map()

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t')
  if (parts.length < 4) continue
  const placa = parts[0].trim().toUpperCase()
  if (!placa) continue
  byPlaca.set(placa, {
    placa,
    modelo: parts[1].trim(),
    processo: parts[2].trim(),
    localidade: parts[3].trim(),
  })
}

const arr = [...byPlaca.values()]
fs.mkdirSync(path.dirname(dest), { recursive: true })
const body =
  '// Gerado por: node scripts/generate-munck-fleet.mjs — uma linha por placa (em duplicatas, a ultima linha vence).\n' +
  'export type MunckFleetSourceRow = { placa: string; modelo: string; processo: string; localidade: string }\n' +
  'export const MUNCK_FLEET_ROWS: MunckFleetSourceRow[] = ' +
  JSON.stringify(arr, null, 2) +
  '\n'

fs.writeFileSync(dest, body, 'utf8')
console.log(`Escritos ${arr.length} veículos em ${dest}`)
