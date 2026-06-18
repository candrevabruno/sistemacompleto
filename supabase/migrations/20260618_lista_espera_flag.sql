-- ETAPA 7 — Feature flag Lista de Espera
-- Adiciona lista_espera_enabled à clinic_config.
-- Super admin pode habilitar por clínica em Configurações → Feature flags.
-- Execute no Supabase SQL Editor.

ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS lista_espera_enabled BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
