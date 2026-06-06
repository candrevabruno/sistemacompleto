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

export interface Conversa {
  id: string;
  lead_id: string | null;
  whatsapp_number: string;
  nome_contato: string | null;
  provider: 'meta' | 'evolution';
  status: 'aberta' | 'fechada' | 'arquivada';
  assigned_to: string | null;
  is_human: boolean;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number;
  created_at: string;
  updated_at: string;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  conteudo: string;
  tipo: 'text' | 'image' | 'audio' | 'document' | 'video';
  direcao: 'entrada' | 'saida';
  status: 'enviado' | 'entregue' | 'lido' | 'erro';
  whatsapp_message_id: string | null;
  media_url: string | null;
  lida: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
}

export interface Tarefa {
  id: string;
  lead_id: string;
  titulo: string;
  descricao: string | null;
  concluida: boolean;
  data_vencimento: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
