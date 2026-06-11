import React, { useState, useEffect } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { supabase } from '../lib/supabase';
import {
  startOfToday, endOfToday, startOfYesterday, endOfYesterday, subDays,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  isWithinInterval, parseISO, format, getDay, setHours, setMinutes,
  startOfDay, endOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Clock, FileDown, Loader2 } from 'lucide-react';

type DateFilter = 'ontem' | 'hoje' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconCalCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="m9 16 2 2 4-4"/>
    </svg>
  );
}

function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

// ── Shared card styles ────────────────────────────────────────────────────────

const panel = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  padding: '20px',
} as React.CSSProperties;

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-display leading-none mb-1"
      style={{ fontSize: '17px', fontWeight: 400, fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.2px' }}
    >
      {children}
    </h3>
  );
}

function PanelSub({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>{children}</p>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  // ── Date filter ────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // ── Dashboard data ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [clinicHours, setClinicHours] = useState<any[]>([]);
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [agendamentosData, setAgendamentosData] = useState<any[]>([]);

  // ── Metrics cards data ─────────────────────────────────────────────────────
  const [metricsLeads, setMetricsLeads] = useState(0);
  const [metricsAgendamentos, setMetricsAgendamentos] = useState(0);
  const [metricsConversao, setMetricsConversao] = useState(0);
  const [metricsFaturamento, setMetricsFaturamento] = useState(0);

  useEffect(() => { fetchClinicHours(); }, []);
  useEffect(() => { applyFilter(filter); }, [filter]);
  useEffect(() => { fetchChartData(); }, [dateRange]);

  // Refresh quando o utilizador volta ao tab ou reconecta a rede
  useVisibilityRefresh(() => fetchChartData());

  // Realtime: atualiza automaticamente quando chegam novos leads/agendamentos/procedimentos
  useEffect(() => {
    const ch = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchChartData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => fetchChartData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procedimentos_paciente' }, () => fetchChartData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dateRange]);

  const fetchClinicHours = async () => {
    const { data } = await supabase.from('clinic_hours').select('*');
    if (data) setClinicHours(data);
  };

  const applyFilter = (f: DateFilter) => {
    const today = new Date();
    switch (f) {
      case 'ontem':  setDateRange({ start: startOfYesterday(), end: endOfYesterday() }); break;
      case 'hoje':   setDateRange({ start: startOfToday(),     end: endOfToday() });     break;
      case '7dias':  setDateRange({ start: subDays(today, 7),  end: endOfToday() });     break;
      case '14dias': setDateRange({ start: subDays(today, 14), end: endOfToday() });     break;
      case 'mes':    setDateRange({ start: startOfMonth(today), end: endOfMonth(today) }); break;
      case 'ano':    setDateRange({ start: startOfYear(today),  end: endOfYear(today) });  break;
    }
  };

  const handleCustomFilter = () => {
    if (customStart && customEnd) {
      setDateRange({ start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) });
    }
  };

  const fetchChartData = async () => {
    setLoading(true);
    const startIso = dateRange.start.toISOString();
    const endIso   = dateRange.end.toISOString();

    const [aReq, lReq, pReq] = await Promise.all([
      supabase.from('agendamentos').select('*').gte('created_at', startIso).lte('created_at', endIso),
      supabase.from('leads').select('*').gte('inicio_atendimento', startIso).lte('inicio_atendimento', endIso),
      supabase.from('procedimentos_paciente').select('valor, created_at').gte('created_at', startIso).lte('created_at', endIso),
    ]);

    const leadsArr = lReq.data || [];
    const agendamentosArr = aReq.data || [];

    setAgendamentosData(agendamentosArr);
    setLeadsData(leadsArr);

    // Metrics for selected period
    setMetricsLeads(leadsArr.length);
    setMetricsAgendamentos(agendamentosArr.length);
    const convertidos = leadsArr.filter(l => l.status === 'converteu').length;
    setMetricsConversao(leadsArr.length > 0 ? Math.round((convertidos / leadsArr.length) * 100) : 0);
    const faturamento = (pReq.data || []).reduce(
      (acc, p) => acc + (parseFloat(p.valor) || 0), 0
    );
    setMetricsFaturamento(faturamento);

    setLoading(false);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────

  const dayNameMapping = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayLabelMapping = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const leadsByDayMap: Record<string, { label: string; count: number; timestamp: number }> = {};
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    const date = parseISO(l.inicio_atendimento);
    const key  = format(date, 'yyyy-MM-dd');
    if (!leadsByDayMap[key]) leadsByDayMap[key] = { label: format(date, 'dd/MM'), count: 0, timestamp: date.getTime() };
    leadsByDayMap[key].count++;
  });
  const chart1Data = Object.values(leadsByDayMap)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(item => ({ dia: item.label, leads: item.count }));

  const leadsByDOW = new Array(7).fill(0);
  leadsData.forEach(l => { if (l.inicio_atendimento) leadsByDOW[getDay(parseISO(l.inicio_atendimento))]++; });
  const chart2Data = [1,2,3,4,5,6,0].map(d => ({ name: dayLabelMapping[d], valor: leadsByDOW[d] }));

  let leadsDentro = 0, leadsFora = 0;
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    const date    = parseISO(l.inicio_atendimento);
    const dayName = dayNameMapping[getDay(date)];
    const ch      = clinicHours.find(h => h.dia === dayName);
    if (ch && ch.aberto && ch.hora_inicio && ch.hora_fim) {
      const [hI, mI] = ch.hora_inicio.split(':').map(Number);
      const [hF, mF] = ch.hora_fim.split(':').map(Number);
      const s = setMinutes(setHours(date, hI), mI);
      const e = setMinutes(setHours(date, hF), mF);
      isWithinInterval(date, { start: s, end: e }) ? leadsDentro++ : leadsFora++;
    } else {
      leadsFora++;
    }
  });
  const chart3Data = [
    { name: 'Dentro do Horário', value: leadsDentro },
    { name: 'Fora do Horário',   value: leadsFora   },
  ];
  const COLORS = ['var(--sage-dark)', '#f97316'];

  const totalLeads = leadsData.length;
  const leadsNaoQ  = leadsData.filter(l => l.status === 'abandonou_conversa').length;
  const leadsQ     = totalLeads - leadsNaoQ;
  const qualData   = [{ name: 'Qualificados', value: leadsQ }, { name: 'Abandonaram', value: leadsNaoQ }];
  const QUALI_COLORS = ['var(--sage)', '#ef4444'];

  const objecoesMap: Record<string, number> = {};
  leadsData.forEach(l => { if (l.status === 'nao_converteu' && l.objecao) objecoesMap[l.objecao] = (objecoesMap[l.objecao] || 0) + 1; });
  const chartObjecoes = Object.entries(objecoesMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const servicosMap: Record<string, number> = {};
  leadsData.forEach(l => {
    if (l.status === 'converteu' && Array.isArray(l.servicos_contratados))
      l.servicos_contratados.forEach((s: string) => { servicosMap[s] = (servicosMap[s] || 0) + 1; });
  });
  const chartServicos = Object.entries(servicosMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // ── Computed ───────────────────────────────────────────────────────────────

  const fmtBRL = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const FILTER_LABELS: Record<string, string> = {
    ontem: 'Ontem', hoje: 'Hoje', '7dias': '7 dias', '14dias': '14 dias', mes: 'Mês', ano: 'Ano',
  };

  const periodSub = filter === 'custom' ? 'período selecionado' : (FILTER_LABELS[filter] || '').toLowerCase();

  const metricCards = [
    { label: 'Leads',        value: String(metricsLeads),        sub: periodSub,          iconBg: 'var(--sage-xlight)', iconColor: 'var(--sage-dark)', icon: <IconUsers /> },
    { label: 'Agendamentos', value: String(metricsAgendamentos), sub: periodSub,          iconBg: 'var(--champ-light)', iconColor: '#7A6040',          icon: <IconCalCheck /> },
    { label: 'Conversão',    value: `${metricsConversao}%`,      sub: 'leads → paciente', iconBg: 'var(--sage-xlight)', iconColor: 'var(--sage-dark)', icon: <IconRepeat /> },
    { label: 'Faturamento',  value: fmtBRL(metricsFaturamento),  sub: periodSub,          iconBg: '#EFF6FF',            iconColor: '#2563EB',          icon: <IconReceipt /> },
  ];

  const tooltipStyle = {
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--white)',
    color: 'var(--ink)',
    boxShadow: '0 4px 16px rgba(143,174,154,0.12)',
    fontSize: '12px',
  };

  // ── PDF ────────────────────────────────────────────────────────────────────

  const handleDownloadPDF = async () => {
    const input = document.getElementById('dashboard-report');
    if (!input) return;
    try {
      setIsGeneratingPDF(true);
      await document.fonts.ready;
      const noPrint = document.querySelectorAll('.no-print');
      noPrint.forEach(el => (el as HTMLElement).style.display = 'none');
      const truncEls: { el: HTMLElement; ws: string }[] = [];
      document.querySelectorAll('.truncate').forEach(el => {
        const h = el as HTMLElement;
        truncEls.push({ el: h, ws: h.style.whiteSpace });
        h.style.whiteSpace = 'normal'; h.style.overflow = 'visible'; h.style.textOverflow = 'clip';
      });
      await new Promise(r => setTimeout(r, 1500));
      const dataUrl = await toPng(input, { cacheBust: true, pixelRatio: 2, style: { backgroundColor: 'var(--bg)' } });
      noPrint.forEach(el => (el as HTMLElement).style.display = '');
      truncEls.forEach(({ el, ws }) => { el.style.whiteSpace = ws; el.style.overflow = ''; el.style.textOverflow = ''; });
      const margin = 12, pdfWidth = 210, cw = pdfWidth - margin * 2;
      const ch = (input.offsetHeight * cw) / input.offsetWidth;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, ch + margin * 2] });
      pdf.setFillColor(250, 249, 247);
      pdf.rect(0, 0, pdfWidth, ch + margin * 2, 'F');
      pdf.addImage(dataUrl, 'PNG', margin, margin, cw, ch);
      pdf.save(`Relatorio_${filter}_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
    } catch (e: any) {
      console.error('Erro PDF:', e);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div id="dashboard-report" className="space-y-5 pb-8">

      {/* ── Métricas 4 cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map(m => (
          <div key={m.label} className="rounded-[var(--r-sm)] p-4" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.7px]" style={{ color: 'var(--muted)' }}>{m.label}</span>
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: m.iconBg, color: m.iconColor }}>{m.icon}</div>
            </div>
            <div className="font-display leading-none" style={{ fontSize: '28px', fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.5px' }}>{m.value}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filtro de período ── */}
      <div className="rounded-[var(--r)] p-5 no-print" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Pills */}
          <div className="flex flex-wrap gap-2">
            {(['ontem', 'hoje', '7dias', '14dias', 'mes', 'ano'] as DateFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex items-center gap-[5px] px-[13px] py-[6px] rounded-full text-[12px] font-medium transition-all cursor-pointer"
                style={
                  filter === f
                    ? { background: 'var(--sage-dark)', color: '#fff', border: '1px solid var(--sage-dark)' }
                    : { background: 'var(--white)', color: 'var(--muted)', border: '1px solid var(--border-md)' }
                }
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Custom range + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customStart}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setCustomStart(e.target.value); setFilter('custom'); }}
              className="rounded-[var(--r-xs)] px-3 py-[6px] text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]"
              style={{ border: '1px solid var(--border-md)', background: 'var(--bg)', color: 'var(--ink)', width: '140px' }}
            />
            <span className="text-[12px]" style={{ color: 'var(--muted)' }}>até</span>
            <input
              type="date"
              value={customEnd}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setCustomEnd(e.target.value); setFilter('custom'); }}
              className="rounded-[var(--r-xs)] px-3 py-[6px] text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]"
              style={{ border: '1px solid var(--border-md)', background: 'var(--bg)', color: 'var(--ink)', width: '140px' }}
            />
            <button
              onClick={handleCustomFilter}
              className="px-4 py-[6px] rounded-[var(--r-xs)] text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--sage-dark)' }}
            >
              Filtrar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-4 py-[6px] rounded-[var(--r-xs)] text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--ink)', color: '#fff' }}
            >
              {isGeneratingPDF
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Gerando...</>
                : <><FileDown className="w-3.5 h-3.5" /> PDF</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerta fora de horário ── */}
      {leadsFora > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-[var(--r)] border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
          <div className="p-2 rounded-full" style={{ background: '#FFEDD5', color: '#C2410C' }}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="font-medium" style={{ color: '#7C2D12' }}>Demanda fora de horário: </span>
            <span style={{ color: '#9A3412' }}>
              {leadsFora} {leadsFora === 1 ? 'pessoa entrou' : 'pessoas entraram'} em contato fora do horário de atendimento.
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted)' }} />
        </div>
      ) : (
        <>
          {/* ── Atendimentos por dia ── */}
          <div style={panel}>
            <PanelTitle>Atendimentos no WhatsApp</PanelTitle>
            <PanelSub>Total de leads atendidos pelo agente de IA por dia no período selecionado</PanelSub>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart1Data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: 'var(--muted)', fontSize: 11 }} padding={{ left: 20, right: 20 }} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="leads" stroke="var(--sage-dark)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--sage-dark)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Dias com mais movimento ── */}
          <div style={panel}>
            <PanelTitle>Dias com mais movimento</PanelTitle>
            <PanelSub>Veja em quais dias da semana sua clínica recebe mais contatos</PanelSub>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart2Data} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--sage-xlight)' }} />
                  <Bar dataKey="valor" name="Leads" fill="var(--sage-dark)" radius={[6, 6, 0, 0]} barSize={32} label={{ position: 'top', fill: 'var(--muted)', fontSize: 11, fontWeight: '500' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Horário + Qualificação ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div style={panel}>
              <PanelTitle>Horário dos contatos</PanelTitle>
              <PanelSub>Contatos dentro e fora do horário de funcionamento</PanelSub>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chart3Data} cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" paddingAngle={4} dataKey="value" stroke="none">
                      {chart3Data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--muted)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-center mt-2 px-3 py-2 rounded-[8px]" style={{ color: 'var(--muted)', background: 'var(--bg)' }}>
                Horário reflete as configurações administrativas ativas.
              </p>
            </div>

            <div style={panel}>
              <PanelTitle>Qualificação dos Leads</PanelTitle>
              <PanelSub>Comparativo entre qualificados e quem abandonou a conversa</PanelSub>
              <div style={{ height: 300 }}>
                {totalLeads > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={qualData} cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" paddingAngle={4} dataKey="value" stroke="none">
                        {qualData.map((_, i) => <Cell key={i} fill={QUALI_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--muted)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[13px]" style={{ color: 'var(--muted)' }}>
                    Nenhum lead registrado no período.
                  </div>
                )}
              </div>
              <p className="text-[11px] text-center mt-2 px-3 py-2 rounded-[8px]" style={{ color: 'var(--muted)', background: 'var(--bg)' }}>
                Total de <strong>{totalLeads}</strong> leads no período.
              </p>
            </div>
          </div>

          {/* ── Objeções ── */}
          <div style={panel}>
            <PanelTitle>Principais Objeções</PanelTitle>
            <PanelSub>Motivos pelos quais os contatos não se tornaram clientes</PanelSub>
            <div style={{ height: 280 }}>
              {chartObjecoes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartObjecoes} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: 'var(--ink)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--sage-xlight)' }} />
                    <Bar dataKey="value" name="Leads" fill="var(--sage-dark)" radius={[0, 4, 4, 0]} barSize={22} label={{ position: 'right', fill: 'var(--muted)', fontSize: 11, fontWeight: '500' }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[13px]" style={{ color: 'var(--muted)' }}>
                  Nenhuma objeção registrada no período.
                </div>
              )}
            </div>
          </div>

          {/* ── Principais Serviços ── */}
          <div style={panel}>
            <PanelTitle>Principais Serviços</PanelTitle>
            <PanelSub>Serviços mais contratados nas vendas fechadas</PanelSub>
            <div style={{ height: 280 }}>
              {chartServicos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartServicos} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: 'var(--ink)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--sage-xlight)' }} />
                    <Bar dataKey="value" name="Vendas" fill="var(--sage)" radius={[0, 4, 4, 0]} barSize={22} label={{ position: 'right', fill: 'var(--muted)', fontSize: 11, fontWeight: '500' }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[13px]" style={{ color: 'var(--muted)' }}>
                  Nenhum serviço registrado nas conversões do período.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
