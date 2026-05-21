-- =============================================================================
-- Migração: tabela public.apontamentos já existente (poucas colunas) + RLS anon
-- Rode no Supabase: SQL Editor → New query → colar → Run
-- =============================================================================

-- 1) Colunas que o app frota-web espera (snake_case no banco)
ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS data_apontamento date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS prazo date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS resolvido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_resolvido date,
  ADD COLUMN IF NOT EXISTS hora_resolvido text,
  ADD COLUMN IF NOT EXISTS reparo_valor numeric,
  ADD COLUMN IF NOT EXISTS reparo_descricao text,
  ADD COLUMN IF NOT EXISTS reparo_imagens text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS os_arquivo text,
  ADD COLUMN IF NOT EXISTS processo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS base text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coordenador text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checklist_id text,
  ADD COLUMN IF NOT EXISTS nc_item_id text,
  ADD COLUMN IF NOT EXISTS nc_fotos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Opcional: depois que já houver linhas reais, você pode remover defaults de data:
-- ALTER TABLE public.apontamentos ALTER COLUMN data_apontamento DROP DEFAULT;
-- ALTER TABLE public.apontamentos ALTER COLUMN prazo DROP DEFAULT;

CREATE INDEX IF NOT EXISTS apontamentos_data_idx ON public.apontamentos (data_apontamento);
CREATE INDEX IF NOT EXISTS apontamentos_resolvido_idx ON public.apontamentos (resolvido);

-- 2) RLS: o app no navegador usa a chave anônima → precisa de políticas para "anon"
ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "anon_insert_apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "anon_update_apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "auth_select_apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "auth_insert_apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "auth_update_apontamentos" ON public.apontamentos;

CREATE POLICY "anon_select_apontamentos"
  ON public.apontamentos FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_apontamentos"
  ON public.apontamentos FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_apontamentos"
  ON public.apontamentos FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_apontamentos"
  ON public.apontamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_apontamentos"
  ON public.apontamentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_apontamentos"
  ON public.apontamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
