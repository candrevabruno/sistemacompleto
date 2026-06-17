-- Permissões de abas de Configurações para admins (super_admin define via Equipe)
-- null = todas as abas liberadas (comportamento padrão)
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS admin_config_tabs TEXT[];
