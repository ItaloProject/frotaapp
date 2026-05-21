/**
 * Lê Moto.txt (TSV: PLACA, MARCA/MODELO, PREFIXO, PROCESSO, LOCALIDADE), deduplica por placa
 * (última linha vence) e gera `src/data/motoFleet.gen.ts`.
 * Uso: node scripts/generate-moto-fleet.mjs [caminho-para-Moto.txt]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDefaultFleetInput } from './lib/resolveDefaultFleetInput.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.resolve(process.argv[2] || resolveDefaultFleetInput('Moto.txt'))
const dest = path.join(__dirname, '..', 'src', 'data', 'motoFleet.gen.ts')

const raw = fs.readFileSync(input, 'utf8')
const lines = raw.split(/\r?\n/).filter((l) => l.trim())
const byPlaca = new Map()

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t')
  if (parts.length < 5) continue
  const placa = parts[0].trim().toUpperCase()
  if (!placa) continue
  byPlaca.set(placa, {
    placa,
    modelo: parts[1].trim(),
    prefixo: parts[2].trim(),
    processo: parts[3].trim(),
    localidade: parts[4].trim(),
  })
}

const arr = [...byPlaca.values()]
fs.mkdirSync(path.dirname(dest), { recursive: true })
const body =
  '// Gerado por: node scripts/generate-moto-fleet.mjs — uma linha por placa (em duplicatas, a ultima linha vence).\n' +
  'export type MotoFleetSourceRow = { placa: string; modelo: string; prefixo: string; processo: string; localidade: string }\n' +
  'export const MOTO_FLEET_ROWS: MotoFleetSourceRow[] = ' +
  JSON.stringify(arr, null, 2) +
  '\n'

fs.writeFileSync(dest, body, 'utf8')
console.log(`Escritos ${arr.length} veículos em ${dest}`)
