import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const raw = `PDY2893, PEB5613, PEB5643, PEC0243, PEC0353, QYP1A99, QYP1C99, QYP4A78, QYP4C18, QYP4C78, QYP9E67, QYP9F77, RNP8E84, ROT6C62, ROT6C65, ROT6C67, ROT6C71, RTE4D09, RTE8A38, RTZ8D09, RTZ8D13, RTZ8D16, RUA0G83, RUA0G84, RUA0G85, RUA0G96, RUA0G98, RUA0H01, RUA0H03, RUA0H05, RUB7D49, RUB7D51, RUF0E16, RUZ9B85, RVW7J37, RZK4I58, RZL3B89, RZL3C39, RZL3C89, RZL3D69, RZL4E18, RZL4F88, RZL4G98, RZL4H98, RZL4I68, RZL4J88, RZL5D18, RZL5E48, RZL5F08, RZM0I82, RZM0J92, RZM1A12, RZM1A32, RZM1A82, RZM1B02, RZM1B32, RZM1B82, RZM1C32, RZM1C62, RZM1D72, RZM7A41, RZM7H81, RZM9D01, RZM9F31, RZQ9I80, RZQ9J70, SMP0E50, SYJ8C31, SYJ8C52`

const arr = [...new Set(raw.split(/\s*,\s*/).map((x) => x.trim().toUpperCase()).filter(Boolean))]
const outPath = path.join(__dirname, '..', 'src', 'frota', 'fleetCatalogDesmobilizadoPlacas.ts')
const body = `/** Placas do catálogo classificadas como DESMOBILIZADO (registo e resumo operacional). */
/** Lista fornecida pelo titular (2026). */
export const FLEET_CATALOG_DESMOBILIZADO_PLACAS = new Set<string>([${arr.map((p) => JSON.stringify(p)).join(', ')}])
`
fs.writeFileSync(outPath, body, 'utf8')
console.log('Written', outPath, 'placas:', arr.length)
