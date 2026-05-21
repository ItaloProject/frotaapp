/**
 * Script de importação do Excel histórico para o Supabase.
 * Uso: node scripts/import-excel.mjs
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// Carrega .env manualmente
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = val
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
  return date.toISOString().split('T')[0]
}

function parseResposta(val) {
  if (!val || typeof val !== 'string') return 'na'
  const v = val.toUpperCase()
  if (v.includes('NÃO CONFORME') || v.includes('NAO CONFORME')) return 'nc'
  if (v.includes('CONFORME')) return 'c'
  return 'na'
}

async function insertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
}

// ---------------------------------------------------------------------------
// Configuração por aba
// Cada entrada em `itens` é: { id, col } onde col é o índice da coluna Excel
// ---------------------------------------------------------------------------
const ABA_CONFIG = {
  SKY: {
    tipo: 'sky',
    // col 0=carimbo, 1=nome, 2=matrícula, 3=data, 4=placa, 5=modelo, 6=km, 7=horímetro, 8=prefixo, 9=processo, 10=localidade
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:9, localidade:10 },
    itens: [
      {id:'sky-01',col:11},{id:'sky-02',col:12},{id:'sky-03',col:13},{id:'sky-04',col:14},
      {id:'sky-05',col:15},{id:'sky-06',col:16},{id:'sky-07',col:17},{id:'sky-08',col:18},
      {id:'sky-09',col:19},{id:'sky-10',col:20},{id:'sky-11',col:21},{id:'sky-12',col:22},
      {id:'sky-13',col:23},{id:'sky-14',col:24},{id:'sky-15',col:25},{id:'sky-16',col:26},
      {id:'sky-17',col:27},{id:'sky-18',col:28},{id:'sky-19',col:29},{id:'sky-20',col:30},
      {id:'sky-21',col:31},{id:'sky-22',col:32},{id:'sky-23',col:33},
      // col 34 = fotos (skip)
      {id:'sky-24',col:35},{id:'sky-25',col:36},{id:'sky-26',col:37},
      // col 38 = fotos (skip)
      {id:'sky-27',col:39},{id:'sky-28',col:40},{id:'sky-29',col:41},{id:'sky-30',col:42},
      {id:'sky-31',col:43},{id:'sky-32',col:44},{id:'sky-33',col:45},
      // col 46 = fotos (skip)
    ],
    problemaCol: 47,
    supervisorCol: 48,
  },

  MUNK: {
    tipo: 'munck',
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:9, localidade:10 },
    itens: [
      {id:'mnk-01',col:11},{id:'mnk-02',col:12},{id:'mnk-03',col:13},{id:'mnk-04',col:14},
      {id:'mnk-05',col:15},{id:'mnk-06',col:16},{id:'mnk-07',col:17},{id:'mnk-08',col:18},
      {id:'mnk-09',col:19},{id:'mnk-10',col:20},{id:'mnk-11',col:21},{id:'mnk-12',col:22},
      {id:'mnk-13',col:23},{id:'mnk-14',col:24},{id:'mnk-15',col:25},{id:'mnk-16',col:26},
      {id:'mnk-17',col:27},{id:'mnk-18',col:28},{id:'mnk-19',col:29},{id:'mnk-20',col:30},
      {id:'mnk-21',col:31},
      // col 32,33 = bomba arla/pasta docs (não estão no schema atual, pula)
      // col 34 = fotos (skip)
      {id:'mnk-22',col:35},{id:'mnk-23',col:36},{id:'mnk-24',col:37},{id:'mnk-25',col:38},
      {id:'mnk-26',col:39},{id:'mnk-27',col:40},{id:'mnk-28',col:41},{id:'mnk-29',col:42},
      {id:'mnk-30',col:43},{id:'mnk-31',col:44},
      // col 45 = fotos (skip)
    ],
    problemaCol: 46,
    supervisorCol: 47,
  },

  MOTO: {
    tipo: 'motocicleta',
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:9, localidade:10 },
    itens: [
      {id:'mt-01',col:11},{id:'mt-02',col:12},{id:'mt-03',col:13},{id:'mt-04',col:14},
      {id:'mt-05',col:15},{id:'mt-06',col:16},{id:'mt-07',col:17},{id:'mt-08',col:18},
      {id:'mt-09',col:19},{id:'mt-10',col:20},{id:'mt-11',col:21},{id:'mt-12',col:22},
      {id:'mt-13',col:23},{id:'mt-14',col:24},{id:'mt-15',col:25},{id:'mt-16',col:26},
      {id:'mt-17',col:27},{id:'mt-18',col:28},{id:'mt-19',col:29},{id:'mt-20',col:30},
      {id:'mt-21',col:31},{id:'mt-22',col:32},{id:'mt-23',col:33},{id:'mt-24',col:34},
      {id:'mt-25',col:35},{id:'mt-26',col:36},{id:'mt-27',col:37},{id:'mt-28',col:38},
      {id:'mt-29',col:39},
      // col 40 = fotos (skip)
    ],
    problemaCol: 41,
    supervisorCol: 42,
  },

  'PICAPE 4X4': {
    tipo: 'picape-4x4',
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:8, localidade:9 },
    itens: [
      {id:'p4-01',col:10},{id:'p4-02',col:11},{id:'p4-03',col:12},{id:'p4-04',col:13},
      {id:'p4-05',col:14},{id:'p4-06',col:15},{id:'p4-07',col:16},{id:'p4-08',col:17},
      {id:'p4-09',col:18},{id:'p4-10',col:19},{id:'p4-11',col:20},{id:'p4-12',col:21},
      // col 22 = fotos inspeção (skip)
      {id:'p4-13',col:23},
      // col 24 = fotos entrar no veículo (skip)
      {id:'p4-14',col:25},{id:'p4-15',col:26},{id:'p4-16',col:27},{id:'p4-17',col:28},
      {id:'p4-18',col:29},{id:'p4-19',col:30},
      // col 31 = fotos (skip)
    ],
    problemaCol: 32,
    supervisorCol: 33,
  },

  'PICAPE LEVE': {
    tipo: 'picape-leve',
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:8, localidade:9 },
    itens: [
      {id:'pl-01',col:10},{id:'pl-02',col:11},{id:'pl-03',col:12},{id:'pl-04',col:13},
      {id:'pl-05',col:14},{id:'pl-06',col:15},{id:'pl-07',col:16},{id:'pl-08',col:17},
      {id:'pl-09',col:18},{id:'pl-10',col:19},{id:'pl-11',col:20},{id:'pl-12',col:21},
      // col 22 = fotos inspeção (skip)
      {id:'pl-13',col:23},
      // col 24 = fotos entrar no veículo (skip)
      {id:'pl-14',col:25},{id:'pl-15',col:26},{id:'pl-16',col:27},{id:'pl-17',col:28},
      {id:'pl-18',col:29},{id:'pl-19',col:30},
      // col 31 = fotos (skip), 32-33 = limpeza (skip)
    ],
    problemaCol: 34,
    supervisorCol: 35,
  },

  'VEICULOS LEVES': {
    tipo: 'veiculo-leve',
    dadosStart: { nome:1, matricula:2, data:3, placa:4, modelo:5, km:6, horimetro:7, prefixo:8, processo:8, localidade:9 },
    itens: [
      {id:'vl-01',col:10},{id:'vl-02',col:11},{id:'vl-03',col:12},{id:'vl-04',col:13},
      {id:'vl-05',col:14},{id:'vl-06',col:15},{id:'vl-07',col:16},{id:'vl-08',col:17},
      {id:'vl-09',col:18},{id:'vl-10',col:19},{id:'vl-11',col:20},{id:'vl-12',col:21},
      // col 22 = fotos inspeção (skip)
      {id:'vl-13',col:23},
      // col 24 = fotos entrar no veículo (skip)
      {id:'vl-14',col:25},{id:'vl-15',col:26},{id:'vl-16',col:27},{id:'vl-17',col:28},
      {id:'vl-18',col:29},{id:'vl-19',col:30},
      // col 31 = fotos (skip)
    ],
    problemaCol: 32,
    supervisorCol: 33,
  },
}

// ---------------------------------------------------------------------------
// Processa cada aba
// ---------------------------------------------------------------------------
function processAba(sheetName, ws, config) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const registros = []
  const d = config.dadosStart

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 4) continue

    const nomeOperador = String(row[d.nome] ?? '').trim()
    const matricula    = String(row[d.matricula] ?? '').trim()
    const dataISO      = excelDateToISO(row[d.data]) ?? excelDateToISO(row[0])
    if (!nomeOperador || !dataISO) continue

    const dadosVeiculo = {
      placa:        String(row[d.placa]      ?? '').trim(),
      marca_modelo: String(row[d.modelo]     ?? '').trim(),
      km_atual:     String(row[d.km]         ?? '').trim(),
      horimetro:    String(row[d.horimetro]  ?? '').trim(),
      prefixo:      String(row[d.prefixo]    ?? '').trim(),
      processo:     String(row[d.processo]   ?? '').trim(),
      localidade:   String(row[d.localidade] ?? '').trim(),
    }

    const respostas = {}
    for (const { id, col } of config.itens) {
      respostas[id] = parseResposta(row[col])
    }

    const ncCount   = Object.values(respostas).filter((v) => v === 'nc').length
    const problemas = config.problemaCol != null ? String(row[config.problemaCol] ?? '').trim() : ''
    const supervisor = config.supervisorCol != null ? String(row[config.supervisorCol] ?? '').trim() : ''

    const carimboBruto = row[0]
    let createdAt = dataISO + 'T08:00:00Z'
    if (typeof carimboBruto === 'number') {
      createdAt = new Date(Math.round((carimboBruto - 25569) * 86400 * 1000)).toISOString()
    }

    registros.push({
      tipo:               config.tipo,
      nome_operador:      nomeOperador,
      matricula,
      dados_veiculo:      dadosVeiculo,
      data_inspecao:      dataISO,
      respostas,
      observacoes:        {},
      progresso:          100,
      nc_count:           ncCount,
      nc_imperativos:     0,
      problemas,
      descricao_problema: '',
      nome_supervisor:    supervisor,
      evidencia_urls:     [],
      created_at:         createdAt,
    })
  }

  return registros
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const filePath = resolve(__dir, '../src/data/Base de dados.xlsx')
  console.log('📂 Lendo:', filePath)
  const wb = XLSX.readFile(filePath)

  let totalInseridos = 0
  const BATCH_SIZE = 200

  for (const [abaName, config] of Object.entries(ABA_CONFIG)) {
    const ws = wb.Sheets[abaName]
    if (!ws) { console.warn(`⚠ Aba "${abaName}" não encontrada.`); continue }

    const registros = processAba(abaName, ws, config)
    console.log(`\n📋 ${abaName} → ${registros.length} registros`)

    let inseridos = 0
    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE)
      try {
        await insertBatch(batch)
        inseridos += batch.length
        process.stdout.write(`\r  ✅ ${inseridos}/${registros.length}`)
      } catch (err) {
        console.error(`\n  ❌ Lote ${i}: ${err.message}`)
      }
    }
    console.log(`\n  Inserido: ${inseridos}`)
    totalInseridos += inseridos
  }

  console.log(`\n🎉 Concluído! Total inserido: ${totalInseridos} registros.`)
}

main().catch((err) => { console.error('❌ Erro:', err); process.exit(1) })
