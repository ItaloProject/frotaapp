import { Fragment, type ReactNode } from 'react'

/**
 * Negrito `**texto**` num segmento sem quebras de linha.
 */
export function renderFormattedInline(text: string, keyPrefix: string): ReactNode {
  const re = /\*\*([^*]+)\*\*/g
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(
      <strong key={`${keyPrefix}-b-${k++}`} className="font-bold">
        {m[1]}
      </strong>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length === 0 ? text : nodes
}

/**
 * Linha de lista com `*` no começo.
 * Aceita `* item` e também `*item` (muitos modelos retornam sem espaço).
 * Não confunde com `**` (negrito), pois bloqueia `*` seguido de `*`.
 */
const BULLET_LINE = /^\s*\*(?!\*)(?:\s+)?(.*)$/

function isSectionHeaderItem(item: string): boolean {
  const t = item.trim()
  // Header = começa com **...** (pode ter espaços/pontuação depois).
  return /^\*\*[^*]+\*\*/.test(t)
}

function splitLeadingBoldHeader(item: string): { title: string; rest: string } | null {
  const t = item.trim()
  const m = t.match(/^\*\*([^*]+)\*\*\s*(.*)$/)
  if (!m) return null
  return { title: (m[1] ?? '').trim(), rest: (m[2] ?? '').trim() }
}

function isStandaloneHeading(chunk: string): boolean {
  // Ex.: "Antes da Viagem:" em uma linha só
  return /^[^\n]{1,80}:\s*$/.test(chunk.trim())
}

function renderListItemText(item: string, keyPrefix: string): ReactNode {
  const trimmed = item.trim()
  if (!trimmed) return null

  // Se vier como "Título: descrição", destaca o título.
  const m = trimmed.match(/^([^:]{1,64}):\s*(.*)$/)
  if (!m) return renderFormattedInline(trimmed, keyPrefix)

  const label = m[1]!.trim()
  const rest = (m[2] ?? '').trim()

  return (
    <>
      <strong className="font-bold">{renderFormattedInline(label, `${keyPrefix}-lbl`)}</strong>
      {rest ? (
        <>
          {' '}
          {renderFormattedInline(rest, `${keyPrefix}-rest`)}
        </>
      ) : null}
    </>
  )
}

/**
 * Blocos de texto e listas: linhas `* item` consecutivas viram `<ul>`;
 * o resto são parágrafos com `**negrito**` e quebras de linha suaves.
 */
export function renderFormattedText(text: string): ReactNode {
  const lines = text.split(/\r?\n/)
  const out: ReactNode[] = []
  let blockKey = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const bulletMatch = line.match(BULLET_LINE)

    if (bulletMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const L = lines[i] ?? ''
        const m = L.match(BULLET_LINE)
        if (!m) break
        items.push(m[1]!.trim())
        i++
      }
      const ulId = blockKey++

      type Section = { header: string; items: string[] }
      const sections: Section[] = []
      let current: Section | null = null

      for (const raw of items) {
        if (isSectionHeaderItem(raw)) {
          current = { header: raw, items: [] }
          sections.push(current)
          continue
        }
        if (!current) {
          current = { header: '', items: [] }
          sections.push(current)
        }
        current.items.push(raw)
      }

      const hasStructuredSections = sections.some((s) => Boolean(s.header)) && sections.length > 0

      out.push(
        <div key={`ul-${ulId}`} className="my-2 space-y-3 first:mt-0 last:mb-0">
          {hasStructuredSections
            ? sections.map((sec, sIdx) => {
                const sectionNumber = sIdx + 1
                return (
                  <div
                    key={`sec-${ulId}-${sIdx}`}
                    className="rounded-2xl border border-slate-200 bg-transparent p-3 dark:border-slate-800"
                  >
                    {sec.header ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-black text-white shadow-sm dark:bg-brand-500">
                          {sectionNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const split = splitLeadingBoldHeader(sec.header)
                            if (!split) {
                              return (
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                  {renderListItemText(sec.header, `sec-h-${ulId}-${sIdx}`)}
                                </div>
                              )
                            }
                            return (
                              <div className="min-w-0">
                                <div className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                                  {renderFormattedInline(split.title, `sec-h-${ulId}-${sIdx}-t`)}
                                </div>
                                {split.rest ? (
                                  <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {renderFormattedInline(split.rest, `sec-h-${ulId}-${sIdx}-r`)}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ) : null}

                    {sec.items.length > 0 ? (
                      <div className={`${sec.header ? 'mt-2.5' : ''} space-y-1.5 pl-1`}>
                        {sec.items.map((it, j) => (
                          <div
                            key={`sec-it-${ulId}-${sIdx}-${j}`}
                            className="flex gap-1.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200"
                          >
                            <span className="mt-[2px] shrink-0 font-mono text-[12px] font-bold text-slate-400 dark:text-slate-500">
                              –
                            </span>
                            <div className="min-w-0 flex-1">{renderListItemText(it, `sec-${ulId}-${sIdx}-${j}`)}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })
            : items.map((item, j) => (
                <div key={`li-${ulId}-${j}`} className="flex gap-1.5 leading-relaxed text-slate-800 dark:text-slate-200">
                  <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500">-</span>
                  <div className="min-w-0 flex-1">{renderListItemText(item, `li-${ulId}-${j}`)}</div>
                </div>
              ))}
        </div>,
      )
    } else {
      const start = i
      while (i < lines.length) {
        const L = lines[i] ?? ''
        if (L.match(BULLET_LINE)) break
        i++
      }
      const chunk = lines.slice(start, i).join('\n').trim()
      if (chunk) {
        const segments = chunk.split('\n')
        const pid = blockKey++
        const isLead = out.length === 0
        out.push(
          isStandaloneHeading(chunk) ? (
            <div key={`h-${pid}`} className="mb-2">
              <div className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm font-black tracking-tight text-slate-900 dark:border-slate-800 dark:text-white">
                {renderFormattedInline(chunk.replace(/:\s*$/, ''), `h-${pid}`)}:
              </div>
            </div>
          ) : (
            <p
              key={`p-${pid}`}
              className={
                isLead
                  ? 'mb-3 text-sm font-bold text-slate-800 dark:text-slate-200'
                  : 'mb-2 last:mb-0'
              }
            >
              {segments.map((segment, idx) => (
                <Fragment key={`ln-${pid}-${idx}`}>
                  {idx > 0 ? <br /> : null}
                  {renderFormattedInline(segment, `p-${pid}-ln-${idx}`)}
                </Fragment>
              ))}
            </p>
          ),
        )
      }
    }
  }

  return out.length === 0 ? text : out.length === 1 ? out[0] : <>{out}</>
}
