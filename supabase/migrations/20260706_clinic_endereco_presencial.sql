-- Endereço presencial da clínica — usado no lembrete de 4h e na confirmação de 48h
-- (WF03). Modalidade online envia o link; presencial envia este endereço.
-- Coluna única de texto formatado (mantém flexibilidade sem várias colunas).

ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS endereco_presencial text;

UPDATE clinic_config SET endereco_presencial =
'Rua das Flores, 342 — sala 87, Leblon, Rio de Janeiro/RJ (CEP 22430-040)
A 2 minutos a pé da estação de metrô Leblon.
Estacionamento coberto no edifício, entrada pela Rua Jardim Botânico — R$ 15,00 a primeira hora.
Acessibilidade: elevador e rampa de acesso na entrada principal.'
WHERE id = 1;
