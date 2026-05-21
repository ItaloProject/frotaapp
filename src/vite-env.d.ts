/// <reference types="vite/client" />

declare module 'dom-to-image-more' {
  interface Options {
    bgcolor?: string
    width?: number
    height?: number
    scale?: number
    style?: Partial<CSSStyleDeclaration>
    filter?: (node: Node) => boolean
    useCORS?: boolean
  }
  function toPng(node: HTMLElement, options?: Options): Promise<string>
  function toBlob(node: HTMLElement, options?: Options): Promise<Blob>
}

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_GEMINI_MODEL?: string
  /** E-mail do administrador (login com VITE_ADMIN_PASSWORD → papel admin). */
  readonly VITE_ADMIN_EMAIL?: string
  readonly VITE_ADMIN_PASSWORD?: string
}
