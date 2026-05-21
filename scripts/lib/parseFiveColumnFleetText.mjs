/**
 * Placa BR típica (Mercosul 7 caracteres ou antiga 3 letras + 4 dígitos).
 * Rejeita texto livre no campo PLACA (ex.: mensagens de rodapé no Excel).
 */
export function looksLikeBrVehiclePlate(raw) {
  const x = String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (x.length === 7) {
    if (/^[A-Z]{3}\d{4}$/.test(x)) return true
    if (/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(x)) return true
  }
  if (x.length === 6 && /^[A-Z]{3}\d{3}$/.test(x)) return true
  return false
}

/**
 * Lê texto de frota (cabeçalho + linhas de dados).
 * Formatos suportados:
 *   A) 5 colunas: PLACA, MARCA/MODELO, PREFIXO, PROCESSO, LOCALIDADE
 *   B) 6 colunas: PLACA, MARCA/MODELO, KM ATUAL, PREFIXO, PROCESSO, LOCALIDADE
 * Separador: TAB, ; ou ,. Deduplica por placa (última linha vence; placa sem espaços).
 */
export function parseFiveColumnFleetText(raw) {
  const text = String(raw).replace(/^\uFEFF/, '')
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return { rows: [], delimiter: '\t', layout: 'five' }

  const delimiters = ['\t', ';', ',']
  let bestDelim = '\t'
  let bestScore = -1
  for (const d of delimiters) {
    let s6 = 0
    let s5 = 0
    for (let i = 1; i < lines.length; i++) {
      const n = lines[i].split(d).length
      if (n >= 6) s6++
      else if (n >= 5) s5++
    }
    const score = s6 * 10000 + s5
    if (score > bestScore) {
      bestScore = score
      bestDelim = d
    }
  }

  const headerParts = lines[0].split(bestDelim).map((c) => c.trim())
  let hasKmColumn =
    headerParts.length >= 6 &&
    (/KM/i.test(headerParts[2] || '') || /ATUAL/i.test(headerParts[2] || ''))

  if (!hasKmColumn && headerParts.length >= 6) {
    let numericKmHints = 0
    const sample = Math.min(8, lines.length - 1)
    for (let i = 1; i <= sample; i++) {
      const p = lines[i].split(bestDelim).map((c) => c.trim())
      if (p.length >= 6 && /^[\d.,\s]+$/.test((p[2] || '').replace(/\s/g, ''))) numericKmHints++
    }
    if (numericKmHints >= Math.max(3, Math.floor(sample * 0.5))) hasKmColumn = true
  }

  const layout = hasKmColumn ? 'six' : 'five'

  const byPlaca = new Map()
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(bestDelim).map((c) => c.trim())
    let placa
    let modelo
    let prefixo
    let processo
    let localidade

    if (hasKmColumn && parts.length >= 6) {
      placa = parts[0]
      modelo = parts[1] ?? ''
      prefixo = parts[3] ?? ''
      processo = parts[4] ?? ''
      localidade = parts[5] ?? ''
    } else if (!hasKmColumn && parts.length >= 5) {
      placa = parts[0]
      modelo = parts[1] ?? ''
      prefixo = parts[2] ?? ''
      processo = parts[3] ?? ''
      localidade = parts[4] ?? ''
    } else {
      continue
    }

    placa = placa.replace(/\s+/g, '').toUpperCase()
    if (!placa) continue
    if (!looksLikeBrVehiclePlate(placa)) continue

    byPlaca.set(placa, {
      placa,
      modelo,
      prefixo,
      processo,
      localidade,
    })
  }

  return { rows: [...byPlaca.values()], delimiter: bestDelim, layout }
}
