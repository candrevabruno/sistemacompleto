import { format, addDays, startOfDay } from 'date-fns';

export type Temperatura = 'quente' | 'esfriando' | 'frio' | 'novo';
export type CorAcao = 'vermelho' | 'amarelo' | 'verde' | 'azul' | 'cinza';

export interface ProximaAcao {
  texto: string;
  cor: CorAcao;
}

export interface MetricasLeads {
  totalFrios: number;
  totalEsfriando: number;
  totalQuentes: number;
  leadsAgendados: number;
  totalLeads: number;
}

const MS_DIA = 1000 * 60 * 60 * 24;

export function calcularTemperatura(lead: any): Temperatura {
  const agora = Date.now();
  const ultimaMensagem = lead.ultima_mensagem ? new Date(lead.ultima_mensagem).getTime() : null;
  const inicioAtend = lead.inicio_atendimento ? new Date(lead.inicio_atendimento).getTime() : null;
  const dataAgendamento = lead.data_agendamento ? new Date(lead.data_agendamento).getTime() : null;

  // Consulta agendada no futuro = Quente
  if (dataAgendamento && dataAgendamento > agora &&
      (lead.status === 'agendado' || lead.status === 'reagendado')) {
    return 'quente';
  }

  // Novo: criado há < 24h sem nenhuma interação
  if (!ultimaMensagem && inicioAtend && agora - inicioAtend < MS_DIA) {
    return 'novo';
  }

  const ref = ultimaMensagem ?? inicioAtend;
  if (!ref) return 'frio';

  const dias = (agora - ref) / MS_DIA;
  if (dias < 1) return 'quente';
  if (dias <= 4) return 'esfriando';
  return 'frio';
}

export function calcularDiasSemContato(lead: any): number {
  const ref = lead.ultima_mensagem ?? lead.inicio_atendimento;
  if (!ref) return 999;
  return Math.floor((Date.now() - new Date(ref).getTime()) / MS_DIA);
}

export function calcularProximaAcao(lead: any): ProximaAcao {
  const agora = Date.now();
  const dataAgendamento = lead.data_agendamento ? new Date(lead.data_agendamento) : null;
  const temperatura = calcularTemperatura(lead);
  const dias = calcularDiasSemContato(lead);

  if (lead.status === 'faltou' || lead.status === 'cancelou_agendamento') {
    return { texto: 'Reagendar consulta perdida', cor: 'vermelho' };
  }

  if (dataAgendamento && dataAgendamento.getTime() > agora) {
    const horas = (dataAgendamento.getTime() - agora) / (1000 * 60 * 60);
    if (horas <= 48) {
      return { texto: `Confirmar consulta ${format(dataAgendamento, 'dd/MM')}`, cor: 'azul' };
    }
  }

  if (temperatura === 'frio') {
    return { texto: `Reativar — ${dias} dias parado`, cor: 'vermelho' };
  }

  if (temperatura === 'esfriando') {
    return { texto: 'Follow-up — sem resposta', cor: 'amarelo' };
  }

  if (temperatura === 'novo' && !dataAgendamento) {
    return { texto: 'Oferecer agendamento', cor: 'verde' };
  }

  return { texto: 'Nenhuma ação', cor: 'cinza' };
}

export function calcularMetricas(leads: any[]): MetricasLeads {
  const frios = leads.filter(l => calcularTemperatura(l) === 'frio').length;
  const esfriando = leads.filter(l => calcularTemperatura(l) === 'esfriando').length;
  const quentes = leads.filter(l => calcularTemperatura(l) === 'quente').length;
  const agendados = leads.filter(l => l.status === 'agendado' || l.status === 'reagendado').length;
  return {
    totalFrios: frios,
    totalEsfriando: esfriando,
    totalQuentes: quentes,
    leadsAgendados: agendados,
    totalLeads: leads.length,
  };
}

export interface ReativacaoInfo {
  data: Date | null;
  reativarHoje: boolean;
}

const DIAS_REATIVACAO = 60;

export function calcularDataReativacao(lead: any): ReativacaoInfo {
  const ref = lead.ultima_mensagem ?? lead.inicio_atendimento;
  if (!ref) return { data: null, reativarHoje: false };

  const data = addDays(new Date(ref), DIAS_REATIVACAO);
  const reativarHoje = startOfDay(data) <= startOfDay(new Date());
  return { data, reativarHoje };
}

export function getInitials(nome: string | null): string {
  if (!nome) return '?';
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
