-- Conexão WhatsApp via uazapi (https://docs.uazapi.com/)
-- Terceiro provedor além de Meta Cloud API e Evolution API.
-- Autenticação da uazapi: header `token` (token da instância).

ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS uazapi_server_url text;
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS uazapi_token text;
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS uazapi_instance_name text;

-- Caso exista um CHECK antigo limitando whatsapp_provider a ('meta','evolution').
ALTER TABLE clinic_config DROP CONSTRAINT IF EXISTS clinic_config_whatsapp_provider_check;
