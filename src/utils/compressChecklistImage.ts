/** Limite de tamanho das imagens de checklist (bytes). */
export const CHECKLIST_IMAGE_MAX_BYTES = 800 * 1024

function isCompressibleRasterImage(file: File): boolean {
  if (!file.type.startsWith('image/')) return false
  if (file.type === 'image/svg+xml') return false
  return true
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Falha ao carregar imagem'))
    }
    img.src = url
  })
}

async function loadImageSource(file: File): Promise<{ source: CanvasImageSource; close?: () => void }> {
  try {
    const bmp = await createImageBitmap(file)
    return { source: bmp, close: () => bmp.close() }
  } catch {
    const img = await loadImageElement(file)
    return { source: img }
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob'))),
      'image/jpeg',
      quality,
    )
  })
}

function outputFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_') || 'foto'
  return `${base}.jpg`
}

/**
 * Garante que ficheiros de imagem raster não excedem {@link CHECKLIST_IMAGE_MAX_BYTES}.
 * PDF e SVG são devolvidos sem alteração.
 */
export async function compressChecklistImageIfNeeded(file: File): Promise<File> {
  if (!isCompressibleRasterImage(file) || file.size <= CHECKLIST_IMAGE_MAX_BYTES) {
    return file
  }

  try {
    const { source, close } = await loadImageSource(file)
    try {
      const iw =
        source instanceof HTMLImageElement ? source.naturalWidth : (source as ImageBitmap).width
      const ih =
        source instanceof HTMLImageElement ? source.naturalHeight : (source as ImageBitmap).height
      if (!iw || !ih) return file

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return file

      let maxDimension = 1920
      const minDimension = 480

      while (maxDimension >= minDimension) {
        const scale = Math.min(1, maxDimension / Math.max(iw, ih))
        canvas.width = Math.max(1, Math.round(iw * scale))
        canvas.height = Math.max(1, Math.round(ih * scale))
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

        for (let q = 0.85; q >= 0.4; q -= 0.1) {
          const blob = await canvasToJpegBlob(canvas, q)
          if (blob.size <= CHECKLIST_IMAGE_MAX_BYTES) {
            return new File([blob], outputFileName(file.name), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
          }
        }
        maxDimension = Math.floor(maxDimension * 0.75)
      }

      let blob = await canvasToJpegBlob(canvas, 0.22)
      let guard = 0
      while (blob.size > CHECKLIST_IMAGE_MAX_BYTES && guard < 14 && canvas.width > 96) {
        canvas.width = Math.max(96, Math.floor(canvas.width * 0.72))
        canvas.height = Math.max(96, Math.floor(canvas.height * 0.72))
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
        blob = await canvasToJpegBlob(canvas, 0.18)
        guard += 1
      }
      return new File([blob], outputFileName(file.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    } finally {
      close?.()
    }
  } catch {
    return file
  }
}
