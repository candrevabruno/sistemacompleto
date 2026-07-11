-- Índice único em agendamentos.calcom_uid: garante que a mesma reserva do Cal.com
-- nunca gere duas linhas, independente de quem grava primeiro (WF02B síncrono ou
-- cal-webhook). O WF02B usa ON CONFLICT (calcom_uid) WHERE calcom_uid IS NOT NULL.

-- 1. Remove duplicatas pré-existentes (mantém a linha mais antiga de cada uid).
DELETE FROM agendamentos a
USING agendamentos b
WHERE a.calcom_uid IS NOT NULL
  AND a.calcom_uid = b.calcom_uid
  AND a.ctid > b.ctid;

-- 2. Índice único parcial (uids nulos continuam livres).
CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_calcom_uid_uniq
  ON agendamentos (calcom_uid)
  WHERE calcom_uid IS NOT NULL;
