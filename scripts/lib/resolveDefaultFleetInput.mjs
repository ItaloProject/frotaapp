import fs from 'node:fs'
import path from 'node:path'

/** Preferência: `Área de Trabalho\Banco de veiculos\<nome>` depois só na Área de Trabalho. */
export function resolveDefaultFleetInput(fileBaseName) {
  const home = process.env.USERPROFILE || ''
  const desktop = path.join(home, 'OneDrive', 'Área de Trabalho')
  const inFleetFolder = path.join(desktop, 'Banco de veiculos', fileBaseName)
  const onDesktop = path.join(desktop, fileBaseName)
  if (fs.existsSync(inFleetFolder)) return inFleetFolder
  if (fs.existsSync(onDesktop)) return onDesktop
  return inFleetFolder
}
