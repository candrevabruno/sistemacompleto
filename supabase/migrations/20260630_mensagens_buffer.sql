-- ============================================================
-- Buffer de mensagens para DEBOUNCE no WF00
-- ============================================================
-- Cada mensagem inbound do WhatsApp é gravada aqui. O WF00 espera
-- DEBOUNCE_SECONDS (default 120s) após a ÚLTIMA mensagem do número e
-- então processa todas as não-processadas como UMA só (concatenadas).
-- "Último vence": só a execução da mensagem mais recente processa o lote;
-- as anteriores se auto-encerram (debounce_superseded).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mensagens_buffer (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text NOT NULL,
  profissional_id uuid,
  event_id        text,
  message_text    text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  received_at     timestamptz NOT NULL DEFAULT NOW(),
  processed_at    timestamptz
);

-- Filtro quente: "sou a mais recente?" e "coleta do lote" filtram por
-- phone + processed_at IS NULL, ordenando por received_at.
CREATE INDEX IF NOT EXISTS idx_msgbuf_phone_pend
  ON public.mensagens_buffer (phone, received_at)
  WHERE processed_at IS NULL;
