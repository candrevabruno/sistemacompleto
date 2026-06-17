-- Status do último disparo de aniversário (atualizado pelo n8n via eventos-dispatch)
-- Formato: {"mes": "2026-06", "enviado_em": "2026-06-17T14:32:00Z", "total": 28}
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS aniversario_last_dispatch JSONB;
