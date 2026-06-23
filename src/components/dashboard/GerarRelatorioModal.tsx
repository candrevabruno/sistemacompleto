import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';
import { useClinic } from '../../contexts/ClinicContext';
import {
  format, subDays, subMonths, subYears,
  startOfDay, endOfDay, parseISO,
  differenceInYears, getDay, getHours,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, FileDown, Loader2 } from 'lucide-react';

type Periodo = '30d' | '3m' | '6m' | '1a' | 'custom';
type SemaforoCor = 'verde' | 'amarelo' | 'vermelho' | 'aguardando';

const PERIODO_LABELS: Record<Periodo, string> = {
  '30d': 'Últimos 30 dias',
  '3m':  'Últimos 3 meses',
  '6m':  'Últimos 6 meses',
  '1a':  'Último ano',
  'custom': 'Período personalizado',
};

// ── Design System Colors ──────────────────────────────────────────────────────

const C = {
  dark:    [28,  43,  36 ] as [number, number, number],
  sage:    [143, 174, 154] as [number, number, number],
  champ:   [196, 157, 97 ] as [number, number, number],
  white:   [255, 255, 255] as [number, number, number],
  bg:      [250, 249, 247] as [number, number, number],
  muted:   [130, 130, 130] as [number, number, number],
  border:  [220, 218, 213] as [number, number, number],
  altRow:  [245, 244, 241] as [number, number, number],
  verde:   [34,  197, 94 ] as [number, number, number],
  amarelo: [245, 158, 11 ] as [number, number, number],
  vermelho:[239, 68,  68 ] as [number, number, number],
  accent:  [100, 120, 110] as [number, number, number],
};

// A4 dimensions
const W  = 210;
const H  = 297;
const ML = 16;
const CW = W - ML - 16;
const FH = 10; // footer height

// ── Helpers ───────────────────────────────────────────────────────────────────

function sem(v: number | null, higher: boolean, g: number, y: number): SemaforoCor {
  if (v === null) return 'aguardando';
  if (higher) { if (v >= g) return 'verde'; if (v >= y) return 'amarelo'; return 'vermelho'; }
  else        { if (v <= g) return 'verde'; if (v <= y) return 'amarelo'; return 'vermelho'; }
}

function faixaEtaria(d: string | null): string {
  if (!d) return 'Não informado';
  try {
    const a = differenceInYears(new Date(), parseISO(d));
    if (a < 18) return '< 18';
    if (a < 25) return '18–24';
    if (a < 35) return '25–34';
    if (a < 45) return '35–44';
    if (a < 55) return '45–54';
    if (a < 65) return '55–64';
    return '65+';
  } catch { return 'Não informado'; }
}

function topN(map: Record<string, number>, n = 8) {
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// ── PDF Drawing Primitives ────────────────────────────────────────────────────

function sf(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function sd(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }
function st(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }

function addCover(doc: jsPDF, clinic: string, period: string, date: string) {
  sf(doc, C.dark); doc.rect(0, 0, W, H, 'F');
  sf(doc, C.sage); doc.rect(0, 0, W, 4, 'F');
  sf(doc, C.sage); doc.rect(0, 0, 3, H, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(44); st(doc, C.champ);
  doc.text('LeapCare', W / 2, 108, { align: 'center' });

  sf(doc, C.sage); doc.rect(W / 2 - 30, 115, 60, 0.5, 'F');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); st(doc, C.sage);
  doc.text('by Heroic Leap®', W / 2, 122, { align: 'center' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); st(doc, C.white);
  doc.text('RELATÓRIO CLÍNICO', W / 2, 150, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); st(doc, C.champ);
  doc.text(clinic, W / 2, 161, { align: 'center' });

  sf(doc, C.sage); doc.rect(W / 2 - 40, 168, 80, 0.3, 'F');

  doc.setFontSize(9); st(doc, C.sage);
  doc.text(`Período: ${period}`, W / 2, 177, { align: 'center' });

  doc.setFontSize(8); st(doc, C.accent);
  doc.text(`Gerado em ${date}`, W / 2, 185, { align: 'center' });

  sf(doc, C.sage); doc.rect(0, H - 3, W, 3, 'F');
}

function bgPage(doc: jsPDF) {
  sf(doc, C.bg); doc.rect(0, 0, W, H, 'F');
}

function sectionHeader(doc: jsPDF, title: string, sub: string, y: number): number {
  sf(doc, C.dark); doc.rect(ML, y, CW, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); st(doc, C.champ);
  doc.text(title, ML + 5, y + 7.5);
  if (sub) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); st(doc, C.sage);
    doc.text(sub, ML + CW - 4, y + 7.5, { align: 'right' });
  }
  return y + 17;
}

function subTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); st(doc, C.dark);
  doc.text(text.toUpperCase(), ML, y);
  sd(doc, C.border); doc.setLineWidth(0.25);
  doc.line(ML, y + 2, ML + CW, y + 2);
  return y + 8;
}

function dot(doc: jsPDF, s: SemaforoCor, x: number, y: number) {
  const cols: Record<SemaforoCor, [number, number, number]> = {
    verde: C.verde, amarelo: C.amarelo, vermelho: C.vermelho, aguardando: [180, 180, 180],
  };
  sf(doc, cols[s]); doc.circle(x, y, 2, 'F');
}

function metricRow(doc: jsPDF, name: string, val: string, s: SemaforoCor, y: number, last = false): number {
  sf(doc, C.altRow); doc.rect(ML, y, CW, 8, 'F');
  dot(doc, s, ML + 4, y + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); st(doc, C.dark);
  doc.text(name, ML + 10, y + 5.5);
  doc.setFont('helvetica', 'bold'); st(doc, C.dark);
  doc.text(val, ML + CW - 4, y + 5.5, { align: 'right' });
  if (!last) { sd(doc, C.border); doc.setLineWidth(0.2); doc.line(ML, y + 8, ML + CW, y + 8); }
  return y + 8;
}

function barChart(doc: jsPDF, data: { name: string; value: number }[], y: number, color: [number, number, number] = C.sage): number {
  if (!data.length) { return aguardando(doc, 'Sem dados no período', y); }
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = CW * 0.42;
  const lblW = CW - barW - 20;
  data.forEach(item => {
    const lbl = item.name.length > 26 ? item.name.slice(0, 25) + '…' : item.name;
    const bw = (item.value / max) * barW;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); st(doc, C.dark);
    doc.text(lbl, ML, y + 5.5);
    sf(doc, [225, 230, 227] as [number,number,number]); doc.rect(ML + lblW, y + 1, barW, 6, 'F');
    if (bw > 0) { sf(doc, color); doc.rect(ML + lblW, y + 1, bw, 6, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); st(doc, C.dark);
    doc.text(String(item.value), ML + lblW + barW + 3, y + 5.5);
    y += 9;
  });
  return y + 4;
}

function pieList(doc: jsPDF, data: { name: string; value: number }[], y: number): number {
  if (!data.length) { return aguardando(doc, 'Sem dados no período', y); }
  const total = data.reduce((s, d) => s + d.value, 0);
  const palette: [number,number,number][] = [
    C.sage, C.champ, [100,140,120], [160,120,80], [80,130,110],
    [200,170,120], [60,110,90], [180,150,100],
  ];
  data.forEach((item, i) => {
    const pct = total > 0 ? Math.round(item.value / total * 100) : 0;
    sf(doc, palette[i % palette.length]); doc.rect(ML, y + 0.5, 5, 5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); st(doc, C.dark);
    const lbl = item.name.length > 32 ? item.name.slice(0, 31) + '…' : item.name;
    doc.text(lbl, ML + 8, y + 4.5);
    doc.setFont('helvetica', 'bold'); st(doc, C.muted);
    doc.text(`${pct}% (${item.value})`, ML + CW, y + 4.5, { align: 'right' });
    y += 8;
  });
  return y + 6;
}

function aguardando(doc: jsPDF, msg: string, y: number): number {
  sf(doc, C.altRow); doc.rect(ML, y, CW, 10, 'F');
  sd(doc, C.border); doc.setLineWidth(0.25); doc.rect(ML, y, CW, 10, 'S');
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); st(doc, C.muted);
  doc.text(msg, ML + CW / 2, y + 6.5, { align: 'center' });
  return y + 14;
}

function checkY(doc: jsPDF, y: number, need = 20): number {
  if (y + need > H - FH - 8) { doc.addPage(); bgPage(doc); return 18; }
  return y;
}

function addFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    sf(doc, C.dark); doc.rect(0, H - FH, W, FH, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); st(doc, C.sage);
    doc.text('LeapCare | Heroic Leap® | Confidencial', ML, H - 3.5);
    st(doc, C.accent);
    doc.text(`${p - 1} / ${total - 1}`, W - 16, H - 3.5, { align: 'right' });
  }
}

// ── Report Data Types ─────────────────────────────────────────────────────────

interface ReportData {
  clinicNome: string;
  periodoLabel: string;
  op_ocupacao: number | null;
  op_no_show: number | null;
  op_cancelamento: number | null;
  op_reagendamento: number | null;
  op_lead_time: number | null;
  op_retorno: number | null;
  op_reaproveitamento: number | null;
  leadsPorOrigem: { name: string; value: number }[];
  taxaConversao: number | null;
  servicos: { name: string; value: number }[];
  objecoes: { name: string; value: number }[];
  npsScore: number | null;
  csatScore: number | null;
  npsPromoters: number;
  npsNeutrals: number;
  npsDetractors: number;
  npsTotal: number;
  csatTotal: number;
  porGenero: { name: string; value: number }[];
  porFaixaEtaria: { name: string; value: number }[];
  porOrigem: { name: string; value: number }[];
  rfmSegmentos: { name: string; value: number }[];
  topFieis: { nome: string; consultas: number }[];
  ticketMedio: number | null;
  topInstabilidade: { nome: string; reagendamentos: number }[];
  noShowPorDia: { name: string; value: number }[];
  noShowPorHora: { name: string; value: number }[];
}

// ── PDF Builder ───────────────────────────────────────────────────────────────

async function gerarPDF(data: ReportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // ── CAPA ─────────────────────────────────────────────────────────────────
  addCover(doc, data.clinicNome, data.periodoLabel, hoje);

  // ── SEÇÃO 1 — OPERACIONAL ─────────────────────────────────────────────────
  doc.addPage(); bgPage(doc);
  let y = 18;
  y = sectionHeader(doc, 'SEÇÃO 1 — OPERACIONAL', 'Desempenho da agenda clínica', y);

  const opRows: [string, number | null, boolean, number, number, string][] = [
    ['Taxa de Ocupação da Agenda', data.op_ocupacao, true, 75, 50, '%'],
    ['Taxa de No-Show', data.op_no_show, false, 10, 20, '%'],
    ['Taxa de Cancelamento', data.op_cancelamento, false, 10, 20, '%'],
    ['Taxa de Reagendamento', data.op_reagendamento, false, 15, 25, '%'],
    ['Tempo Médio Agendamento → Consulta', data.op_lead_time, false, 14, 30, ' dias'],
    ['Taxa de Retorno de Pacientes', data.op_retorno, true, 60, 40, '%'],
    ['Reaproveitamento de Slots', data.op_reaproveitamento, true, 70, 50, '%'],
    ['Taxa de Instabilidade por Paciente', data.op_reagendamento, false, 15, 25, '%'],
  ];

  opRows.forEach(([name, val, higher, g, am, unit], i) => {
    y = checkY(doc, y, 10);
    y = metricRow(doc, name, val === null ? '—' : `${val}${unit}`, sem(val, higher, g, am), y, i === opRows.length - 1);
  });

  // ── SEÇÃO 2 — COMERCIAL ───────────────────────────────────────────────────
  doc.addPage(); bgPage(doc); y = 18;
  y = sectionHeader(doc, 'SEÇÃO 2 — COMERCIAL', 'Pipeline de leads e conversão', y);

  y = subTitle(doc, 'Leads por Origem (Canal)', y);
  y = barChart(doc, data.leadsPorOrigem, y);

  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'Taxa de Conversão Lead → Paciente', y);
  if (data.taxaConversao !== null) {
    y = metricRow(doc, 'Taxa de Conversão', `${data.taxaConversao}%`, sem(data.taxaConversao, true, 30, 15), y, true);
  } else {
    y = aguardando(doc, 'Aguardando dados do agente', y);
  }

  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'CAC — Custo de Aquisição por Cliente', y);
  y = aguardando(doc, 'Aguardando dados do agente (requer integração financeira)', y);

  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'LTV — Valor do Ciclo de Vida', y);
  y = aguardando(doc, 'Aguardando dados do agente (requer histórico financeiro completo)', y);

  y = checkY(doc, y + 6, 14 + data.servicos.length * 9); y += 6;
  y = subTitle(doc, 'Principais Serviços — Top 5 por Volume', y);
  y = barChart(doc, data.servicos.slice(0, 5), y, C.champ);

  y = checkY(doc, y + 6, 14 + data.objecoes.length * 9); y += 6;
  y = subTitle(doc, 'Principais Objeções Registradas', y);
  y = barChart(doc, data.objecoes.slice(0, 5), y, C.vermelho);

  // ── SEÇÃO 3 — EXPERIÊNCIA ─────────────────────────────────────────────────
  doc.addPage(); bgPage(doc); y = 18;
  y = sectionHeader(doc, 'SEÇÃO 3 — EXPERIÊNCIA DO PACIENTE', 'NPS e CSAT', y);

  y = subTitle(doc, 'NPS — Net Promoter Score', y);
  if (data.npsTotal === 0) {
    y = aguardando(doc, 'Aguardando respostas de NPS', y);
  } else {
    const npsLabel = data.npsScore !== null
      ? (data.npsScore >= 75 ? 'Excelente' : data.npsScore >= 50 ? 'Ótimo' : data.npsScore >= 25 ? 'Bom' : data.npsScore >= 0 ? 'Atenção' : 'Crítico')
      : '—';
    y = metricRow(doc, `NPS — ${npsLabel}`, data.npsScore !== null ? String(data.npsScore) : '—', sem(data.npsScore, true, 50, 0), y);
    y = metricRow(doc, 'Total de Respondentes NPS', String(data.npsTotal), 'aguardando', y);
    y = metricRow(doc, 'Taxa de Resposta', `${data.npsTotal} respostas coletadas`, 'aguardando', y, true);

    y = checkY(doc, y + 6, 40); y += 6;
    y = subTitle(doc, 'Distribuição NPS', y);
    y = barChart(doc, [
      { name: 'Promotores (9–10)', value: data.npsPromoters },
      { name: 'Neutros (7–8)',      value: data.npsNeutrals  },
      { name: 'Detratores (0–6)',   value: data.npsDetractors},
    ], y, C.verde);
  }

  y = checkY(doc, y + 6, 30); y += 6;
  y = subTitle(doc, 'CSAT — Satisfação do Paciente', y);
  if (data.csatTotal === 0) {
    y = aguardando(doc, 'Aguardando respostas de CSAT', y);
  } else {
    y = metricRow(doc, 'CSAT Médio (escala 1–5)', data.csatScore !== null ? String(data.csatScore) : '—', sem(data.csatScore, true, 4, 3), y);
    y = metricRow(doc, 'Total de Respondentes CSAT', String(data.csatTotal), 'aguardando', y, true);
  }

  // ── SEÇÃO 4 — PERFIL DE PACIENTE ─────────────────────────────────────────
  doc.addPage(); bgPage(doc); y = 18;
  y = sectionHeader(doc, 'SEÇÃO 4 — PERFIL DE PACIENTE', 'Distribuições e segmentação RFM', y);

  y = subTitle(doc, 'Canal de Origem', y);
  y = pieList(doc, data.porOrigem, y);

  y = checkY(doc, y + 6, 14 + data.porGenero.length * 8); y += 6;
  y = subTitle(doc, 'Distribuição por Gênero', y);
  y = pieList(doc, data.porGenero, y);

  y = checkY(doc, y + 6, 14 + data.porFaixaEtaria.length * 8); y += 6;
  y = subTitle(doc, 'Distribuição por Faixa Etária', y);
  y = pieList(doc, data.porFaixaEtaria, y);

  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'Estado Civil', y);
  y = aguardando(doc, 'Aguardando dados (campo não coletado)', y);

  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'Principais Profissões (Top 5)', y);
  y = aguardando(doc, 'Aguardando dados (campo não coletado)', y);

  y = checkY(doc, y + 6, 14 + data.rfmSegmentos.length * 8); y += 6;
  y = subTitle(doc, 'Segmentação RFM', y);
  y = pieList(doc, data.rfmSegmentos, y);

  // Top fiéis
  y = checkY(doc, y + 6, 14 + data.topFieis.length * 9); y += 6;
  y = subTitle(doc, 'Pacientes Mais Fiéis — Top 10 por Consultas', y);
  if (!data.topFieis.length) {
    y = aguardando(doc, 'Sem dados suficientes no período', y);
  } else {
    data.topFieis.forEach((p, i) => {
      y = checkY(doc, y, 9);
      y = metricRow(doc, `${i + 1}. ${p.nome || 'Paciente'}`, `${p.consultas} consultas`, 'aguardando', y, i === data.topFieis.length - 1);
    });
  }

  // Ticket médio
  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'Ticket Médio por Paciente no Período', y);
  if (data.ticketMedio !== null) {
    const ticketStr = data.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    y = metricRow(doc, 'Ticket Médio (soma procedimentos / pacientes ativos)', ticketStr, 'aguardando', y, true);
  } else {
    y = aguardando(doc, 'Sem procedimentos registrados no período', y);
  }

  // Top instabilidade
  y = checkY(doc, y + 6, 14 + data.topInstabilidade.length * 9); y += 6;
  y = subTitle(doc, 'Instabilidade — Top 5 Pacientes que Mais Reagendaram', y);
  if (!data.topInstabilidade.length) {
    y = aguardando(doc, 'Nenhum reagendamento no período', y);
  } else {
    data.topInstabilidade.forEach((p, i) => {
      y = checkY(doc, y, 9);
      y = metricRow(doc, `${i + 1}. ${p.nome || 'Paciente'}`, `${p.reagendamentos} reagendamentos`, 'amarelo', y, i === data.topInstabilidade.length - 1);
    });
  }

  // No-show por dia da semana
  const diasComNS = data.noShowPorDia.filter(d => d.value > 0);
  y = checkY(doc, y + 6, 14 + diasComNS.length * 9); y += 6;
  y = subTitle(doc, 'Perfil de No-Show por Dia da Semana', y);
  if (!diasComNS.length) {
    y = aguardando(doc, 'Sem no-shows no período', y);
  } else {
    y = barChart(doc, diasComNS, y, C.vermelho);
  }

  // No-show por faixa horária
  const horasComNS = data.noShowPorHora.filter(d => d.value > 0);
  y = checkY(doc, y + 6, 14 + horasComNS.length * 9); y += 6;
  y = subTitle(doc, 'Perfil de No-Show por Faixa Horária', y);
  if (!horasComNS.length) {
    y = aguardando(doc, 'Sem no-shows no período', y);
  } else {
    y = barChart(doc, horasComNS, y, C.vermelho);
  }

  // Preferências comunicação
  y = checkY(doc, y + 6, 22); y += 6;
  y = subTitle(doc, 'Preferências de Comunicação', y);
  y = aguardando(doc, 'Aguardando dados (campo não coletado)', y);
  void y;

  addFooters(doc);

  const slug = data.periodoLabel
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  doc.save(`relatorio-leapcare-${slug}.pdf`);
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchReportData(startIso: string, endIso: string, periodoLabel: string, clinicNome: string): Promise<ReportData> {
  const [agReq, ldReq, agTodosReq, csatReq, npsReq, procReq, pacLeadsReq, noShowReq] = await Promise.all([
    supabase.from('agendamentos')
      .select('id, status, lead_id, data_hora_inicio, created_at')
      .gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('leads')
      .select('id, nome_lead, status, origem, objecao, servicos_contratados, genero, data_nascimento')
      .gte('inicio_atendimento', startIso).lte('inicio_atendimento', endIso),
    supabase.from('agendamentos')
      .select('lead_id, status'),
    supabase.from('csat_respostas')
      .select('score')
      .gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('nps_respostas')
      .select('score')
      .gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('procedimentos_paciente')
      .select('valor, lead_id')
      .gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('leads')
      .select('id, nome_lead, genero, data_nascimento, origem'),
    supabase.from('agendamentos')
      .select('id, lead_id, data_hora_inicio')
      .eq('status', 'nao_compareceu')
      .gte('data_hora_inicio', startIso).lte('data_hora_inicio', endIso),
  ]);

  const agArr     = agReq.data        || [];
  const ldArr     = ldReq.data        || [];
  const agTodos   = agTodosReq.data   || [];
  const csatArr   = csatReq.data      || [];
  const npsArr    = npsReq.data       || [];
  const procArr   = procReq.data      || [];
  const pacLeads  = pacLeadsReq.data  || [];
  const noShowArr = noShowReq.data    || [];

  // ── Seção 1: Operacional ──────────────────────────────────────────────────
  const total      = agArr.length;
  const compareceu = agArr.filter(a => a.status === 'compareceu').length;
  const naoComp    = agArr.filter(a => a.status === 'nao_compareceu').length;
  const cancelado  = agArr.filter(a => a.status === 'cancelado').length;
  const reagendado = agArr.filter(a => a.status === 'reagendado').length;
  const totalFech  = compareceu + naoComp + cancelado;
  const totalAtivos = total - cancelado;

  const op_ocupacao     = totalAtivos > 0 ? Math.round(compareceu / totalAtivos * 100) : null;
  const op_no_show      = totalFech   > 0 ? Math.round(naoComp    / totalFech   * 100) : null;
  const op_cancelamento = total       > 0 ? Math.round(cancelado  / total       * 100) : null;
  const op_reagendamento= total       > 0 ? Math.round(reagendado / total       * 100) : null;

  const lts = agArr
    .filter(a => a.data_hora_inicio && a.created_at)
    .map(a => Math.max(0, Math.round((new Date(a.data_hora_inicio).getTime() - new Date(a.created_at).getTime()) / 86400000)));
  const op_lead_time = lts.length > 0 ? Math.round(lts.reduce((s, v) => s + v, 0) / lts.length) : null;

  const compCount: Record<string, number> = {};
  agTodos.filter(a => a.status === 'compareceu' && a.lead_id)
         .forEach(a => { compCount[a.lead_id] = (compCount[a.lead_id] || 0) + 1; });
  const comUma  = Object.keys(compCount).length;
  const comDuas = Object.values(compCount).filter(v => v >= 2).length;
  const op_retorno = comUma > 0 ? Math.round(comDuas / comUma * 100) : null;

  const leadsReag = new Set(agArr.filter(a => a.status === 'reagendado' && a.lead_id).map(a => a.lead_id));
  const leadsComp = new Set(agArr.filter(a => a.status === 'compareceu' && a.lead_id).map(a => a.lead_id));
  const reap = [...leadsReag].filter(l => leadsComp.has(l)).length;
  const op_reaproveitamento = leadsReag.size > 0 ? Math.round(reap / leadsReag.size * 100) : null;

  // ── Seção 2: Comercial ────────────────────────────────────────────────────
  const origemMap: Record<string, number> = {};
  ldArr.forEach(l => { const o = l.origem || 'Não informado'; origemMap[o] = (origemMap[o] || 0) + 1; });
  const leadsPorOrigem = topN(origemMap, 8);

  const convertidos = ldArr.filter(l => l.status === 'converteu').length;
  const taxaConversao = ldArr.length > 0 ? Math.round(convertidos / ldArr.length * 100) : null;

  const servicosMap: Record<string, number> = {};
  ldArr.forEach(l => {
    if (Array.isArray(l.servicos_contratados))
      (l.servicos_contratados as string[]).forEach(s => { servicosMap[s] = (servicosMap[s] || 0) + 1; });
  });
  const servicos = topN(servicosMap, 5);

  const objecoesMap: Record<string, number> = {};
  ldArr.forEach(l => { if (l.objecao) objecoesMap[l.objecao] = (objecoesMap[l.objecao] || 0) + 1; });
  const objecoes = topN(objecoesMap, 5);

  // ── Seção 3: Experiência ──────────────────────────────────────────────────
  const npsScores   = npsArr.map(r => r.score).filter((s): s is number => typeof s === 'number');
  const npsTotal    = npsScores.length;
  const npsPromoters  = npsScores.filter(s => s >= 9).length;
  const npsNeutrals   = npsScores.filter(s => s >= 7 && s <= 8).length;
  const npsDetractors = npsScores.filter(s => s <= 6).length;
  const npsScore = npsTotal > 0
    ? Math.round((npsPromoters / npsTotal - npsDetractors / npsTotal) * 100) : null;

  const csatScores = csatArr.map(r => r.score).filter((s): s is number => typeof s === 'number');
  const csatTotal  = csatScores.length;
  const csatScore  = csatTotal > 0
    ? Math.round(csatScores.reduce((a, b) => a + b, 0) / csatTotal * 10) / 10 : null;

  // ── Seção 4: Perfil ───────────────────────────────────────────────────────
  const generoMap: Record<string, number> = {};
  pacLeads.forEach((l: any) => { const g = l.genero || 'Não informado'; generoMap[g] = (generoMap[g] || 0) + 1; });
  const porGenero = topN(generoMap, 5);

  const faixaMap: Record<string, number> = {};
  pacLeads.forEach((l: any) => { const f = faixaEtaria(l.data_nascimento); faixaMap[f] = (faixaMap[f] || 0) + 1; });
  const FAIXA_ORDER = ['< 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+', 'Não informado'];
  const porFaixaEtaria = FAIXA_ORDER.filter(k => faixaMap[k]).map(k => ({ name: k, value: faixaMap[k] }));

  const origemPacMap: Record<string, number> = {};
  pacLeads.forEach((l: any) => { const o = l.origem || 'Não informado'; origemPacMap[o] = (origemPacMap[o] || 0) + 1; });
  const porOrigem = topN(origemPacMap, 8);

  // RFM
  const compPorLead: Record<string, number> = {};
  agTodos.forEach(a => {
    if (!a.lead_id) return;
    compPorLead[a.lead_id] = compPorLead[a.lead_id] || 0;
    if (a.status === 'compareceu') compPorLead[a.lead_id]++;
  });
  const rfmMap: Record<string, number> = { Diamante: 0, Fiel: 0, Potencial: 0, 'Em Risco': 0, Perdida: 0 };
  Object.values(compPorLead).forEach(c => {
    if (c >= 5) rfmMap['Diamante']++;
    else if (c >= 3) rfmMap['Fiel']++;
    else if (c >= 2) rfmMap['Potencial']++;
    else if (c >= 1) rfmMap['Em Risco']++;
    else rfmMap['Perdida']++;
  });
  const rfmSegmentos = Object.entries(rfmMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  // Top 10 fiéis
  const nomesMap: Record<string, string> = {};
  pacLeads.forEach((l: any) => { if (l.id) nomesMap[l.id] = l.nome_lead || ''; });
  const topFieis = Object.entries(compPorLead)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, consultas]) => ({ nome: nomesMap[id] || 'Paciente', consultas }));

  // Ticket médio
  const totalProc       = procArr.reduce((s, p) => s + (parseFloat(String(p.valor)) || 0), 0);
  const uniquePacientes = new Set(procArr.map(p => p.lead_id).filter(Boolean)).size;
  const ticketMedio     = uniquePacientes > 0 ? Math.round(totalProc / uniquePacientes) : null;

  // Top 5 instabilidade
  const reagMap: Record<string, number> = {};
  agArr.filter(a => a.status === 'reagendado' && a.lead_id)
       .forEach(a => { reagMap[a.lead_id!] = (reagMap[a.lead_id!] || 0) + 1; });
  const topInstabilidade = Object.entries(reagMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, reagendamentos]) => ({ nome: nomesMap[id] || 'Paciente', reagendamentos }));

  // No-show por dia
  const diasLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const nsDia = [0, 0, 0, 0, 0, 0, 0];
  noShowArr.forEach(a => { if (a.data_hora_inicio) nsDia[getDay(parseISO(a.data_hora_inicio))]++; });
  const noShowPorDia = [1, 2, 3, 4, 5, 6, 0].map(d => ({ name: diasLabel[d], value: nsDia[d] }));

  // No-show por faixa horária
  const horaLabels = ['07–09h', '09–11h', '11–13h', '13–15h', '15–17h', '17–19h', '19–21h'];
  const nsHora = [0, 0, 0, 0, 0, 0, 0];
  noShowArr.forEach(a => {
    if (!a.data_hora_inicio) return;
    const h = getHours(parseISO(a.data_hora_inicio));
    const idx = Math.floor((h - 7) / 2);
    if (idx >= 0 && idx < 7) nsHora[idx]++;
  });
  const noShowPorHora = horaLabels.map((name, i) => ({ name, value: nsHora[i] }));

  return {
    clinicNome, periodoLabel,
    op_ocupacao, op_no_show, op_cancelamento, op_reagendamento,
    op_lead_time, op_retorno, op_reaproveitamento,
    leadsPorOrigem, taxaConversao, servicos, objecoes,
    npsScore, csatScore, npsPromoters, npsNeutrals, npsDetractors, npsTotal, csatTotal,
    porGenero, porFaixaEtaria, porOrigem, rfmSegmentos,
    topFieis, ticketMedio, topInstabilidade, noShowPorDia, noShowPorHora,
  };
}

// ── Modal Component ───────────────────────────────────────────────────────────

export function GerarRelatorioModal({ onClose }: { onClose: () => void }) {
  const { config } = useClinic();
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro]       = useState('');

  function getPeriodRange() {
    const today = new Date();
    switch (periodo) {
      case '30d': return { start: startOfDay(subDays(today, 30)),   end: endOfDay(today) };
      case '3m':  return { start: startOfDay(subMonths(today, 3)),  end: endOfDay(today) };
      case '6m':  return { start: startOfDay(subMonths(today, 6)),  end: endOfDay(today) };
      case '1a':  return { start: startOfDay(subYears(today, 1)),   end: endOfDay(today) };
      case 'custom': return {
        start: startOfDay(parseISO(customStart)),
        end:   endOfDay(parseISO(customEnd)),
      };
    }
  }

  const handleGerar = async () => {
    setGerando(true); setErro('');
    try {
      const { start, end } = getPeriodRange();
      const periodoLabel = periodo === 'custom'
        ? `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`
        : PERIODO_LABELS[periodo];
      const data = await fetchReportData(start.toISOString(), end.toISOString(), periodoLabel, config?.nome || 'Clínica');
      await gerarPDF(data);
      onClose();
    } catch (e: any) {
      console.error(e);
      setErro('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  const pill = (p: Periodo) => ({
    padding: '7px 15px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${periodo === p ? 'var(--sage-dark)' : 'var(--border-md)'}`,
    background: periodo === p ? 'var(--sage-dark)' : 'var(--white)',
    color: periodo === p ? '#fff' : 'var(--muted)',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 'var(--r)', width: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Gerar Relatório</p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Relatório PDF completo em 4 seções</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Período</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {(['30d', '3m', '6m', '1a', 'custom'] as Periodo[]).map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={pill(p)}>
                {PERIODO_LABELS[p]}
              </button>
            ))}
          </div>

          {periodo === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={e => setCustomStart(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>até</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setCustomEnd(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
            </div>
          )}

          {/* Info box */}
          <div style={{ background: 'var(--sage-xlight)', borderRadius: 'var(--r-xs)', padding: '10px 14px', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sage-dark)', marginBottom: '4px' }}>O relatório incluirá:</p>
            <ul style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '14px', lineHeight: 1.9, margin: 0 }}>
              <li>Capa com design Luxury Clinical</li>
              <li>Seção 1 — KPIs Operacionais com semáforo</li>
              <li>Seção 2 — Comercial (leads, conversão, objeções)</li>
              <li>Seção 3 — Experiência do Paciente (NPS / CSAT)</li>
              <li>Seção 4 — Perfil de Paciente e segmentação RFM</li>
            </ul>
          </div>

          {erro && <p style={{ fontSize: '11px', color: '#ef4444', marginBottom: '12px' }}>{erro}</p>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={gerando}
              style={{ padding: '8px 16px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--muted)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleGerar}
              disabled={gerando}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 20px', border: 'none', borderRadius: 'var(--r-xs)',
                fontSize: '12px', fontWeight: 600, color: '#fff',
                background: gerando ? 'var(--muted)' : 'var(--ink)',
                cursor: gerando ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: gerando ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
            >
              {gerando
                ? <><Loader2 size={13} className="animate-spin" /> Gerando relatório...</>
                : <><FileDown size={13} /> Gerar PDF</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
