-- ETAPA 6A — garante a coluna de valor nos serviços prestados.
-- O cadastro de Serviços passa a salvar o valor, que preenche o procedimento
-- do paciente ao selecionar o serviço e alimenta o gráfico "Principais Serviços".
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS valor NUMERIC(12,2);
