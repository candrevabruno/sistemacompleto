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
}
