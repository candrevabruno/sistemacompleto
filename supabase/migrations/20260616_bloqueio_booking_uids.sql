-- Para bloqueio de HORÁRIO específico, o sistema cria reserva(s)-bloqueio no Cal.com
-- (o OOO só bloqueia dia inteiro). Guarda os uids dessas reservas para poder cancelá-las
-- ao desbloquear.
ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS calcom_booking_uids TEXT[];

NOTIFY pgrst, 'reload schema';
