-- Adicionar colunas de email e cpf se não existirem na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT;
