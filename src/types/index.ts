import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  email: string | undefined;
  role: UserRole;
}

export interface ClinicConfig {
  nome: string;
  logo_url: string | null;
  chatwoot_url?: string | null;
  whatsapp_provider?: 'meta' | 'evolution' | null;
  meta_phone_number_id?: string | null;
  meta_access_token?: string | null;
  meta_webhook_verify_token?: string | null;
  meta_business_account_id?: string | null;
  evolution_server_url?: string | null;
  evolution_api_key?: string | null;
  evolution_instance_name?: string | null;
  nota_webhook_url?: string | null;
}
