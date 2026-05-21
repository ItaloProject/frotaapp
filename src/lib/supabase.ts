// Stub do Supabase para modo demo (portfólio) — sem conexão real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

function chain(): any {
  const p = Promise.resolve({ data: [], error: null })
  const handler: ProxyHandler<typeof p> = {
    get(_t, prop) {
      if (prop === 'then') return p.then.bind(p)
      if (prop === 'catch') return p.catch.bind(p)
      if (prop === 'finally') return p.finally.bind(p)
      if (prop === 'single' || prop === 'maybeSingle')
        return () => Promise.resolve({ data: null, error: null })
      return () => new Proxy(p, handler)
    },
  }
  return new Proxy(p, handler)
}

function channelStub() {
  const ch = {
    on: (..._args: any[]) => ch,
    subscribe: (_cb?: AnyFn) => { _cb?.('SUBSCRIBED', null); return ch },
    unsubscribe: () => Promise.resolve('ok' as const),
  }
  return ch
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = {
  from: (_table: string) => chain(),
  rpc: (_fn: string, _args?: unknown) => chain(),
  channel: (_name: string) => channelStub(),
  removeChannel: (_ch: unknown) => Promise.resolve([]),
  storage: {
    from: (_bucket: string) => ({
      upload: (..._a: any[]) => Promise.resolve({ data: null, error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
      remove: (..._a: any[]) => Promise.resolve({ data: null, error: null }),
    }),
  },
  auth: {
    onAuthStateChange: (_cb?: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signInWithPassword: (_opts?: unknown) => Promise.resolve({ data: null, error: { message: 'demo', status: 401 } }),
    signOut: () => Promise.resolve({ error: null }),
    updateUser: (_opts?: unknown) => Promise.resolve({ data: null, error: null }),
    resetPasswordForEmail: (_email?: string, _opts?: unknown) => Promise.resolve({ data: null, error: null }),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

export const supabaseConfigured = false

export type ChecklistRow = {
  id: string
  tipo: string
  nome_operador: string
  matricula: string
  dados_veiculo: Record<string, string>
  data_inspecao: string
  respostas: Record<string, 'c' | 'nc' | 'na'>
  observacoes: Record<string, string>
  progresso: number
  nc_count: number
  nc_imperativos: number
  problemas: string
  descricao_problema: string
  nome_supervisor: string
  evidencia_urls: string[]
  created_at: string
}

export type ChecklistInsert = Omit<ChecklistRow, 'id' | 'created_at'>

export type ApontamentoRow = {
  id: string
  veiculo_id: string
  veiculo_label: string
  prefixo: string
  defeito: string
  data_apontamento: string
  prazo: string
  resolvido: boolean
  data_resolvido: string | null
  hora_resolvido: string | null
  reparo_valor: number | null
  reparo_descricao: string | null
  reparo_imagens: string[]
  os_arquivo: string | null
  processo: string
  base: string
  coordenador: string
  responsavel: string
  checklist_id: string | null
  nc_item_id: string | null
  nc_fotos: string[]
  justificado: boolean
  justificativa: string | null
  justificativa_data: string | null
  justificativa_imagem: string | null
  created_at: string
}

export type HistoricoRow = {
  id: string
  apontamento_id: string
  acao: 'resolvido' | 'reaberto' | 'editado' | 'criado'
  usuario_email: string
  data_hora: string
  descricao: string | null
  reparo_valor: number | null
  reparo_descricao: string | null
  created_at: string
}
