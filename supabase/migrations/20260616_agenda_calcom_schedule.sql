-- Guarda o ID do schedule (Disponibilidade) do Cal.com para cada agenda/profissional,
-- para que ao salvar a disponibilidade no sistema ela seja refletida no Cal.com.
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS calcom_schedule_id TEXT;

NOTIFY pgrst, 'reload schema';
