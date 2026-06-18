import type { User } from '@supabase/supabase-js';
import type { PermissionMap } from '../lib/permissions';

// ETAPA 5 — hierarquia em 3 níveis. Cargos antigos (atendente/profissional/user)
// foram consolidados em 'membro' na migração.
export type UserRole = 'super_admin' | 'admin' | 'membro';

export interface AppUser {
  id: string;
  email: string | undefined;
  role: UserRole;
  nome: string | null;
  permissions: PermissionMap;
}

export interface ClinicConfig {
  nome: string;
  subtitulo: string | null;
  logo_url: string | null;
  chatwoot_url?: string | null;
  whatsapp_provider?: 'meta' | 'evolution' | null;
  meta_phone_number_id?: string | null;
  meta_business_account_id?: string | null;
  evolution_server_url?: string | null;
  evolution_instance_name?: string | null;
  nota_webhook_url?: string | null;
  // ETAPA 5 — feature flags liberadas pela Heroic Leap (super_admin)
  premium_enabled?: boolean;
  eventos_enabled?: boolean;
  lista_espera_enabled?: boolean;
  // ETAPA 6C — Eventos (webhooks n8n)
  aniversario_webhook_url?: string | null;
  upgrade_webhook_url?: string | null;
  // Permissões de abas de Configurações para admins (super_admin define; null = todas liberadas)
  admin_config_tabs?: string[] | null;
  // Status do último disparo de aniversário (atualizado pelo n8n via registrar_disparo)
  aniversario_last_dispatch?: { mes: string; enviado_em: string; total: number | null } | null;
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
  handoff_at: string | null;
  handoff_by: string | null;
  handoff_by_name: string | null;
  ia_ultima_acao: string | null;
  ia_ultima_interacao_at: string | null;
}

export interface Lead {
  id: string;
  nome_lead: string | null;
  resumo_conversa: string | null;
  status: string;
  origem: string | null;
  inicio_atendimento: string;
}

export interface JornadaEvento {
  status: string;
  timestamp: string;
  valor_pago?: number | null;
}

export interface LeadDetalhes extends Lead {
  whatsapp_lead: string | null;
  genero: string | null;
  data_nascimento: string | null;
  procedimento_interesse: string | null;
  jornada: JornadaEvento[] | null;
  data_agendamento: string | null;
  ultima_mensagem: string | null;
  email: string | null;
  cpf: string | null;
  observacoes: string | null;
  valor_pago: number | null;
  id_agendamento: string | null;
  agenda_id: string | null;
  modalidade: string | null;
  objecao: string | null;
  motivo_perda: string | null;
  servicos_contratados: string[] | null;
  agendamento_criado_em: string | null;
  // Prontuário comercial — ETAPA 4
  score_temperatura: string | null;
  score_sonho: string | null;
  score_contexto: string | null;
  score_obstaculo: string | null;
  score_rota: string | null;
  score_gatilho: string | null;
  anotacoes_secretaria: string | null;
  tentativas: number | null;
  proximo_contato: string | null;
  motivo: string | null;
  // ETAPA 7 — LGPD
  anonimizado_em?: string | null;
}

export interface Agendamento {
  id: string;
  procedimento_nome: string | null;
  data_hora_inicio: string;
  status: string;
  agenda: { nome: string } | null;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  conteudo: string;
  tipo: 'text' | 'image' | 'audio' | 'document' | 'video' | 'sistema';
  direcao: 'entrada' | 'saida';
  status: 'enviado' | 'entregue' | 'lido' | 'erro';
  whatsapp_message_id: string | null;
  media_url: string | null;
  lida: boolean;
  created_at: string;
  apagada_pelo_contato?: boolean;
  apagada_para_todos?: boolean;
  oculta_local?: boolean;
  apagada_por?: string | null;
  apagada_at?: string | null;
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

// ─── Pacientes ────────────────────────────────────────────────────────────────

export type StatusPaciente = 'ativo' | 'retorno_pendente' | 'risco_abandono' | 'inativo';

export type CorEngajamento = 'verde' | 'amarelo' | 'vermelho';

export interface AgendamentoSimples {
  id: string;
  data_hora_inicio: string;
  status: string;
  procedimento_nome: string | null;
  valor_pago: number | null;
}

export interface Paciente {
  id: string;
  lead_id: string | null;
  nota: string | null;
  resumo: string | null;
  nota_updated_at: string | null;
  created_at: string;
  // ETAPA 7 — LGPD
  cpf_hash?: string | null;
  consentimento_dado_em?: string | null;
  consentimento_origem?: 'tally' | 'whatsapp' | 'manual' | null;
  consentimento_texto?: string | null;
  consentimento_revogado_em?: string | null;
}

export interface PacienteComLead extends Paciente {
  lead: {
    id: string;
    nome_lead: string | null;
    whatsapp_lead: string | null;
    procedimento_interesse: string | null;
    genero: string | null;
    data_nascimento: string | null;
    email: string | null;
    status: string;
    origem: string | null;
    inicio_atendimento: string;
    observacoes: string | null;
    jornada: JornadaEvento[] | null;
  };
  agendamentos: AgendamentoSimples[];
}

export interface EngajamentoInfo {
  score: number;
  cor: CorEngajamento;
  label: string;
}

export interface ProximaAcaoPaciente {
  texto: string;
  cor: 'vermelho' | 'amarelo' | 'verde' | 'azul' | 'cinza';
}

export interface MetricasPacientes {
  total: number;
  ativos: number;
  retornoPendente: number;
  riscoAbandono: number;
  inativos: number;
  taxaRetencao: number;
}
