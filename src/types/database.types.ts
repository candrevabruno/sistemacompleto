export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agenda_hours: {
        Row: {
          aberto: boolean
          agenda_id: string
          dia: Database["public"]["Enums"]["dia_semana"]
          hora_fim: string | null
          hora_inicio: string | null
          id: string
        }
        Insert: {
          aberto?: boolean
          agenda_id: string
          dia: Database["public"]["Enums"]["dia_semana"]
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
        }
        Update: {
          aberto?: boolean
          agenda_id?: string
          dia?: Database["public"]["Enums"]["dia_semana"]
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_hours_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          agenda_id: string
          created_at: string
          data_hora_fim: string | null
          data_hora_inicio: string
          id: string
          lead_id: string | null
          nome_lead: string | null
          observacoes: string | null
          cliente_id: string | null
          procedimento_nome: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          whatsapp_lead: string | null
        }
        Insert: {
          agenda_id: string
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio: string
          id?: string
          lead_id?: string | null
          nome_lead?: string | null
          observacoes?: string | null
          cliente_id?: string | null
          procedimento_nome?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          whatsapp_lead?: string | null
        }
        Update: {
          agenda_id?: string
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string
          id?: string
          lead_id?: string | null
          nome_lead?: string | null
          observacoes?: string | null
          cliente_id?: string | null
          procedimento_nome?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          whatsapp_lead?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_estetica_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_estetica_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_estetica_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      api_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string
          token_hash: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          token_hash: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_config: {
        Row: {
          id: number
          logo_url: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          id?: number
          logo_url?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          id?: number
          logo_url?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_hours: {
        Row: {
          aberto: boolean
          dia: Database["public"]["Enums"]["dia_semana"]
          hora_fim: string | null
          hora_inicio: string | null
          id: string
        }
        Insert: {
          aberto?: boolean
          dia: Database["public"]["Enums"]["dia_semana"]
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
        }
        Update: {
          aberto?: boolean
          dia?: Database["public"]["Enums"]["dia_semana"]
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          agendamento_criado_em: string | null
          data_agendamento: string | null
          data_nascimento: string | null
          follow_up_1: string | null
          follow_up_2: string | null
          follow_up_3: string | null
          genero: string | null
          id: string
          id_agendamento: string | null
          id_conta_chatwoot: string | null
          id_conversa_chatwoot: string | null
          id_lead_chatwoot: string | null
          inbox_id_chatwoot: string | null
          inicio_atendimento: string
          motivo_contato: string | null
          nome_lead: string | null
          observacoes: string | null
          procedimento_interesse: string | null
          resumo_conversa: string | null
          status: Database["public"]["Enums"]["lead_status"]
          motivo_perda: string | null
          ultima_mensagem: string | null
          valor_pago: number | null
          whatsapp_lead: string
        }
        Insert: {
          agendamento_criado_em?: string | null
          data_agendamento?: string | null
          data_nascimento?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_up_3?: string | null
          genero?: string | null
          id?: string
          id_agendamento?: string | null
          id_conta_chatwoot?: string | null
          id_conversa_chatwoot?: string | null
          id_lead_chatwoot?: string | null
          inbox_id_chatwoot?: string | null
          inicio_atendimento?: string
          motivo_contato?: string | null
          nome_lead?: string | null
          observacoes?: string | null
          procedimento_interesse?: string | null
          resumo_conversa?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          ultima_mensagem?: string | null
          valor_pago?: number | null
          whatsapp_lead: string
        }
        Update: {
          agendamento_criado_em?: string | null
          data_agendamento?: string | null
          data_nascimento?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_up_3?: string | null
          genero?: string | null
          id?: string
          id_agendamento?: string | null
          id_conta_chatwoot?: string | null
          id_conversa_chatwoot?: string | null
          id_lead_chatwoot?: string | null
          inbox_id_chatwoot?: string | null
          inicio_atendimento?: string
          motivo_contato?: string | null
          nome_lead?: string | null
          observacoes?: string | null
          procedimento_interesse?: string | null
          resumo_conversa?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          ultima_mensagem?: string | null
          valor_pago?: number | null
          whatsapp_lead?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          data_primeira_visita: string
          id: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          data_primeira_visita?: string
          id?: string
          lead_id: string
        }
        Update: {
          created_at?: string
          data_primeira_visita?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_estetica_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_data_hora_fim: {
        Args: {
          inicio: string
        }
        Returns: string
      }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "compareceu"
        | "faltou"
        | "cancelado"
        | "reagendado"
      dia_semana:
        | "domingo"
        | "segunda"
        | "terca"
        | "quarta"
        | "quinta"
        | "sexta"
        | "sabado"
      lead_status:
        | "iniciou_atendimento"
        | "conversando"
        | "agendado"
        | "converteu"
        | "nao_converteu"
        | "cancelou_agendamento"
        | "follow_up"
        | "abandonou_conversa"
        | "reagendado"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

