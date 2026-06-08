import { format } from 'date-fns';
import type {
  AgendamentoSimples,
  EngajamentoInfo,
  MetricasPacientes,
  PacienteComLead,
  ProximaAcaoPaciente,
  StatusPaciente,
} from '../types';

const MS_DIA = 1000 * 60 * 60 * 24;

// ─── Status ───────────────────────────────────────────────────────────────────

export function calcularStatusPaciente(agendamentos: AgendamentoSimples[]): StatusPaciente {
  if (agendamentos.length === 0) return 'inativo';

  const agora = new Date();

  const temFuturo = agendamentos.some(
    a =>
      new Date(a.data_hora_inicio) > agora &&
      ['agendado', 'confirmado', 'reagendado'].includes(a.status),
  );
  if (temFuturo) return 'ativo';

  // Último comparecimento confirmado
  const comparecidos = agendamentos
    .filter(a => a.status === 'compareceu')
    .sort((a, b) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime());

  if (comparecidos.length === 0) {
    // Nunca compareceu — avaliar pelo último agendamento
    const ultimo = agendamentos.sort(
      (a, b) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime(),
    )[0];
    const dias = (agora.getTime() - new Date(ultimo.data_hora_inicio).getTime()) / MS_DIA;
    return dias <= 30 ? 'risco_abandono' : 'inativo';
  }

  const diasDesdeUltimo =
    (agora.getTime() - new Date(comparecidos[0].data_hora_inicio).getTime()) / MS_DIA;

  if (diasDesdeUltimo <= 14) return 'retorno_pendente';
  if (diasDesdeUltimo <= 30) return 'risco_abandono';
  return 'inativo';
}

export const STATUS_LABEL: Record<StatusPaciente, string> = {
  ativo: 'Ativo',
  retorno_pendente: 'Retorno Pendente',
  risco_abandono: 'Risco de Abandono',
  inativo: 'Inativo',
};

export const STATUS_COLOR: Record<StatusPaciente, string> = {
  ativo: 'bg-green-50 text-green-700 border-green-200',
  retorno_pendente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  risco_abandono: 'bg-orange-50 text-orange-700 border-orange-200',
  inativo: 'bg-gray-50 text-gray-600 border-gray-200',
};

// ─── Engajamento (0–100) ──────────────────────────────────────────────────────

export function calcularEngajamento(agendamentos: AgendamentoSimples[]): EngajamentoInfo {
  if (agendamentos.length === 0) return { score: 0, cor: 'vermelho', label: '0%' };

  const comparecidos = agendamentos.filter(a => a.status === 'compareceu');

  // Frequência (peso 40): comparecidos ÷ total agendamentos
  const frequencia = comparecidos.length / agendamentos.length;

  // Recência (peso 40): penaliza proporcionalmente aos dias desde a última consulta (referência 90 dias)
  const agora = Date.now();
  const sorted = [...agendamentos].sort(
    (a, b) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime(),
  );
  const diasDesdeUltimo =
    (agora - new Date(sorted[0].data_hora_inicio).getTime()) / MS_DIA;
  const recencia = Math.max(0, 1 - diasDesdeUltimo / 90);

  // Volume (peso 20): bônus leve para mais consultas (referência 10 consultas)
  const volume = Math.min(comparecidos.length / 10, 1);

  const score = Math.round((frequencia * 40 + recencia * 40 + volume * 20));

  let cor: EngajamentoInfo['cor'];
  if (score >= 70) cor = 'verde';
  else if (score >= 40) cor = 'amarelo';
  else cor = 'vermelho';

  return { score, cor, label: `${score}%` };
}

export const ENGAJAMENTO_BAR_COLOR: Record<EngajamentoInfo['cor'], string> = {
  verde: 'bg-green-500',
  amarelo: 'bg-yellow-400',
  vermelho: 'bg-red-400',
};

// ─── Próxima ação ─────────────────────────────────────────────────────────────

export function calcularProximaAcaoPaciente(
  agendamentos: AgendamentoSimples[],
): ProximaAcaoPaciente {
  if (agendamentos.length === 0) return { texto: 'Sem histórico', cor: 'cinza' };

  const agora = new Date();

  const proximoAgendamento = agendamentos
    .filter(
      a =>
        new Date(a.data_hora_inicio) > agora &&
        ['agendado', 'confirmado', 'reagendado'].includes(a.status),
    )
    .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime())[0];

  if (proximoAgendamento) {
    const horas =
      (new Date(proximoAgendamento.data_hora_inicio).getTime() - agora.getTime()) /
      (1000 * 60 * 60);
    if (horas <= 48) {
      return {
        texto: `Confirmar consulta ${format(new Date(proximoAgendamento.data_hora_inicio), 'dd/MM')}`,
        cor: 'azul',
      };
    }
    return { texto: 'Consulta agendada', cor: 'verde' };
  }

  const status = calcularStatusPaciente(agendamentos);
  const comparecidos = agendamentos.filter(a => a.status === 'compareceu');
  const sorted = [...agendamentos].sort(
    (a, b) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime(),
  );
  const dias = Math.floor(
    (agora.getTime() - new Date(sorted[0].data_hora_inicio).getTime()) / MS_DIA,
  );

  if (status === 'risco_abandono')
    return { texto: `Reativar — ${dias} dias sem consulta`, cor: 'vermelho' };
  if (status === 'retorno_pendente')
    return { texto: 'Agendar retorno', cor: 'amarelo' };
  if (status === 'inativo')
    return { texto: `Reengajar — ${dias} dias inativo`, cor: 'vermelho' };

  if (comparecidos.length === 0)
    return { texto: 'Agendar primeira consulta', cor: 'verde' };

  return { texto: 'Nenhuma ação', cor: 'cinza' };
}

// ─── Métricas gerais ─────────────────────────────────────────────────────────

export function calcularMetricasPacientes(
  lista: { agendamentos: AgendamentoSimples[] }[],
): MetricasPacientes {
  const total = lista.length;
  let ativos = 0;
  let retornoPendente = 0;
  let riscoAbandono = 0;
  let inativos = 0;

  for (const p of lista) {
    const s = calcularStatusPaciente(p.agendamentos);
    if (s === 'ativo') ativos++;
    else if (s === 'retorno_pendente') retornoPendente++;
    else if (s === 'risco_abandono') riscoAbandono++;
    else inativos++;
  }

  const taxaRetencao = total > 0 ? Math.round(((ativos + retornoPendente) / total) * 100) : 0;

  return { total, ativos, retornoPendente, riscoAbandono, inativos, taxaRetencao };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

export function getIniciais(nome: string | null): string {
  if (!nome) return '?';
  return nome
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
