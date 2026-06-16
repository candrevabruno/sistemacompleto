-- Guarda o ID do Out-of-Office criado no Cal.com para cada bloqueio,
-- para que o "Desbloquear" também remova o OOO no Cal.com.
ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS calcom_ooo_id TEXT;

NOTIFY pgrst, 'reload schema';
