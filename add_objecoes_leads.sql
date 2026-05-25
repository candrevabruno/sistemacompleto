-- Adiciona a coluna objecao para estruturar o motivo da perda da venda
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS objecao TEXT;

-- (Opcional) Adiciona a coluna motivo_perda se ela não existir
-- Embora o código já fizesse referência a ela, é bom garantir que ela exista.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
