import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectCustomProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
}

// Radix Select.Item não aceita value="" — usamos sentinela interno
const EMPTY_SENTINEL = '__empty__'

function toRadix(v: string) { return v === '' ? EMPTY_SENTINEL : v }
function fromRadix(v: string) { return v === EMPTY_SENTINEL ? '' : v }

export function SelectCustom({
  value,
  onChange,
  options,
  placeholder = 'Selecionar...',
  className = '',
}: SelectCustomProps) {
  const selected = options.find((o) => o.value === value)

  return (
    <Select.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))}>
      <Select.Trigger
        className={[
          'inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition-colors',
          'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
          'focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500',
          'data-[placeholder]:text-slate-400 dark:data-[placeholder]:text-slate-500',
          'min-w-[140px]',
          className,
        ].join(' ')}
        aria-label={placeholder}
      >
        <Select.Value placeholder={placeholder}>
          {selected?.label ?? placeholder}
        </Select.Value>
        <Select.Icon asChild>
          <ChevronDown size={15} className="shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className={[
            'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border shadow-xl',
            'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950',
            'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
          ].join(' ')}
        >
          <Select.Viewport className="p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={toRadix(opt.value)}
                className={[
                  'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none',
                  'text-slate-700 dark:text-slate-200',
                  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
                  'dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-white',
                  'data-[state=checked]:text-blue-600 dark:data-[state=checked]:text-blue-400',
                  'transition-colors duration-100',
                ].join(' ')}
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check size={13} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
