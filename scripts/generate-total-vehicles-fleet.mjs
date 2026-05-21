/**
 * Lê a planilha "TOTAL DE VEICULOS.xlsx", deduplica por placa (última linha vence)
 * e gera `src/data/totalVehiclesFleet.gen.ts`.
 *
 * Uso:
 *   node scripts/generate-total-vehicles-fleet.mjs "C:\Users\...\TOTAL DE VEICULOS.xlsx"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.resolve(process.argv[2] || path.join(process.cwd(), 'src', 'data', 'Base de dados.xlsx'))
const dest = path.join(__dirname, '..', 'src', 'data', 'totalVehiclesFleet.gen.ts')

if (!fs.existsSync(input)) {
  console.error(`Planilha não encontrada: ${input}`)
  process.exit(1)
}

const workbook = XLSX.readFile(input)
const sheetName = workbook.SheetNames.includes('ESTRUTURA') ? 'ESTRUTURA' : workbook.SheetNames[0]
if (!sheetName) {
  console.error('A planilha não possui abas.')
  process.exit(1)
}

const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
const headerRowIndex = matrix.findIndex((row) => row.some((cell) => String(cell).trim().toUpperCase() === 'PLACA'))
if (headerRowIndex < 0) {
  console.error('Não foi possível encontrar a linha de cabeçalho com a coluna PLACA.')
  process.exit(1)
}

const headers = matrix[headerRowIndex].map((cell) => String(cell).trim().toUpperCase())
const col = Object.fromEntries(headers.map((h, i) => [h || `COL${i}`, i]))

function value(row, name) {
  return String(row[col[name]] ?? '').trim()
}

function normalizePlate(raw) {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase()
}

function normalizeTipo(raw) {
  const tipo = String(raw ?? '').trim().toUpperCase()
  if (tipo === 'SKY CS' || tipo === 'SKY CD') return 'SKY'
  if (tipo === 'VEICULO LEVE' || tipo === 'VEÍCULO LEVE') return 'VEICULOS LEVES'
  return tipo || 'VEICULOS LEVES'
}

const byPlaca = new Map()
let sourceRows = 0

for (const row of matrix.slice(headerRowIndex + 1)) {
  const placa = normalizePlate(value(row, 'PLACA'))
  if (!placa) continue
  sourceRows += 1

  byPlaca.set(placa, {
    placa,
    ano: value(row, 'ANO'),
    modelo: value(row, 'MODELO'),
    tipo: normalizeTipo(value(row, 'TIPO')),
    proprietario: value(row, 'PROPRIETÁRIO'),
    prefixo: value(row, 'PREFIXO'),
    responsavel: value(row, 'RESPONSÁVEL'),
    base: value(row, 'BASE'),
    setor: value(row, 'SETOR'),
    processo: value(row, 'PROCESSO'),
    gerencia: value(row, 'GERÊNCIA'),
    servico: value(row, 'SERVIÇO'),
    contrato: value(row, 'CONTRATO'),
    cc: value(row, 'CC'),
    imei: value(row, 'IMEI'),
  })
}

const rows = [...byPlaca.values()].sort((a, b) => a.placa.localeCompare(b.placa))
const generatedAt = new Date().toISOString()

const body =
  `// Gerado por: node scripts/generate-total-vehicles-fleet.mjs\n` +
  `// Fonte: ${path.basename(input)} | aba: ${sheetName} | linhas: ${sourceRows} | placas únicas: ${rows.length} | gerado em: ${generatedAt}\n` +
  `export type TotalVehicleSourceRow = {\n` +
  `  placa: string\n` +
  `  ano: string\n` +
  `  modelo: string\n` +
  `  tipo: string\n` +
  `  proprietario: string\n` +
  `  prefixo: string\n` +
  `  responsavel: string\n` +
  `  base: string\n` +
  `  setor: string\n` +
  `  processo: string\n` +
  `  gerencia: string\n` +
  `  servico: string\n` +
  `  contrato: string\n` +
  `  cc: string\n` +
  `  imei: string\n` +
  `}\n` +
  `export const TOTAL_VEHICLE_ROWS: TotalVehicleSourceRow[] = ` +
  JSON.stringify(rows, null, 2) +
  `\n`

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, body, 'utf8')

console.log(`Aba: ${sheetName}`)
console.log(`Linhas de origem: ${sourceRows}`)
console.log(`Placas únicas geradas: ${rows.length}`)
console.log(`Destino: ${dest}`)
