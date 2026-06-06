import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Calendar as CalendarIcon, Users, UserCheck, Bot, Activity, Clock, DollarSign, FileDown } from 'lucide-react';
import { 
  startOfToday, endOfToday, startOfYesterday, endOfYesterday, subDays, startOfMonth, 
  endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format, getDay, setHours, setMinutes,
  startOfDay, endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

type DateFilter = 'hoje' | 'ontem' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';

export function Dashboard() {
  const [filter, setFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ agendamentos: 0, comparecimentos: 0, leads: 0, clientes: 0, faturamento: 0 });
  const [clinicHours, setClinicHours] = useState<any[]>([]);
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [agendamentosData, setAgendamentosData] = useState<any[]>([]);

  useEffect(() => {
    fetchClinicHours();
  }, []);

  useEffect(() => {
    applyFilter(filter);
  }, [filter]);

  useEffect(() => {
    fetchData();
    
    const handleFocus = () => fetchData();
    const handleOnline = () => fetchData();
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchData())
      .subscribe();
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchClinicHours = async () => {
    const { data } = await supabase.from('clinic_hours').select('*');
    if (data) setClinicHours(data);
  };

  const applyFilter = (f: DateFilter) => {
    const today = new Date();
    switch (f) {
      case 'hoje': setDateRange({ start: startOfToday(), end: endOfToday() }); break;
      case 'ontem': setDateRange({ start: startOfYesterday(), end: endOfYesterday() }); break;
      case '7dias': setDateRange({ start: subDays(today, 7), end: endOfToday() }); break;
      case '14dias': setDateRange({ start: subDays(today, 14), end: endOfToday() }); break;
      case 'mes': setDateRange({ start: startOfMonth(today), end: endOfMonth(today) }); break;
      case 'ano': setDateRange({ start: startOfYear(today), end: endOfYear(today) }); break;
      case 'custom':
        // Do not auto-set here, wait for the 'Filtrar' button
        break;
    }
  };

  const handleCustomFilter = () => {
    if (customStart && customEnd) {
      // Usando parseISO para garantir que a data seja interpretada corretamente no fuso local
      const start = startOfDay(parseISO(customStart));
      const end = endOfDay(parseISO(customEnd));
      setDateRange({ start, end });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();

      // Filtros aprimorados: 
      // 1. Agendamentos pela data da consulta (data_hora_inicio)
      // 2. Leads pela data de início do atendimento (inicio_atendimento)
      // 3. Clientes (leads convertidos) pela data de início do atendimento
      const [agendamentosReq, leadsReq] = await Promise.all([
        supabase.from('agendamentos')
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso),
        supabase.from('leads')
          .select('*')
          .gte('inicio_atendimento', startIso)
          .lte('inicio_atendimento', endIso)
      ]);

      const agendamentos = agendamentosReq.data || [];
      const leads = leadsReq.data || [];

      setAgendamentosData(agendamentos);
      setLeadsData(leads);

      const leadsConvertidos = leads.filter(l => l.status === 'converteu');
      const leadsAgendadosCount = leads.filter(l => 
        l.id_agendamento || 
        l.data_agendamento || 
        ['agendado', 'reagendado', 'converteu', 'compareceu'].includes(l.status)
      ).length;

      setMetrics({
        agendamentos: leadsAgendadosCount,
        comparecimentos: leads.filter(l => ['agendado', 'reagendado', 'converteu', 'nao_converteu', 'faltou'].includes(l.status)).length,
        leads: leads.length,
        clientes: leadsConvertidos.length,
        faturamento: leadsConvertidos.reduce((acc, current) => acc + (current.valor_pago || 0), 0)
      });
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const dayNameMapping = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayLabelMapping = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // 1. Linha - Atendimentos por dia
  const leadsByDayMap: Record<string, { label: string, count: number, timestamp: number }> = {};
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    const date = parseISO(l.inicio_atendimento);
    const key = format(date, 'yyyy-MM-dd');
    if (!leadsByDayMap[key]) {
      leadsByDayMap[key] = {
        label: format(date, 'dd/MM'),
        count: 0,
        timestamp: date.getTime()
      };
    }
    leadsByDayMap[key].count++;
  });
  
  const chart1Data = Object.values(leadsByDayMap)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(item => ({ dia: item.label, leads: item.count }));

  // 2. Barras - Dias mais movimento
  const leadsByDayOfWeek = new Array(7).fill(0);
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    leadsByDayOfWeek[getDay(parseISO(l.inicio_atendimento))]++;
  });
  // Shift to start on Monday for display
  const chart2Data = [1,2,3,4,5,6,0].map(d => ({
    name: dayLabelMapping[d],
    valor: leadsByDayOfWeek[d]
  }));

  // 3. Pizza - Horário contatos
  let leadsDentro = 0;
  let leadsFora = 0;
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    const date = parseISO(l.inicio_atendimento);
    const dayName = dayNameMapping[getDay(date)];
    const ch = clinicHours.find(h => h.dia === dayName);
    
    if (ch && ch.aberto && ch.hora_inicio && ch.hora_fim) {
      const [hIni, mIni] = ch.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = ch.hora_fim.split(':').map(Number);
      const startLimit = setMinutes(setHours(date, hIni), mIni);
      const endLimit = setMinutes(setHours(date, hFim), mFim);
      if (isWithinInterval(date, { start: startLimit, end: endLimit })) {
        leadsDentro++;
      } else {
        leadsFora++;
      }
    } else {
      leadsFora++; // Fechado no dia
    }
  });
  const chart3Data = [
    { name: 'Dentro do Horário', value: leadsDentro },
    { name: 'Fora do Horário', value: leadsFora }
  ];
  const COLORS = ['#22c55e', '#f97316']; // Verde sólido e Laranja sólido para contraste profissional

  // 4. Qualificação de Leads (comparativo entre qualificados e abandonaram)
  const totalLeads = leadsData.length;
  const leadsNaoQualificados = leadsData.filter(l => l.status === 'abandonou_conversa').length;
  const leadsQualificados = totalLeads - leadsNaoQualificados;

  const qualificacaoData = [
    { name: 'Qualificados', value: leadsQualificados },
    { name: 'Abandonaram', value: leadsNaoQualificados }
  ];
  const QUALI_COLORS = ['#C5A059', '#ef4444']; // Dourado do sistema para Qualificados, Vermelho para Abandonaram

  // 5. Objeções (Não Converteu)
  const objecoesMap: Record<string, number> = {};
  leadsData.forEach(l => {
    if (l.status === 'nao_converteu' && l.objecao) {
      objecoesMap[l.objecao] = (objecoesMap[l.objecao] || 0) + 1;
    }
  });

  const chartObjecoes = Object.entries(objecoesMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value); // Sort descending

  // 6. Serviços Contratados (Conversões)
  const servicosMap: Record<string, number> = {};
  leadsData.forEach(l => {
    if (l.status === 'converteu' && Array.isArray(l.servicos_contratados)) {
      l.servicos_contratados.forEach((s: string) => {
        servicosMap[s] = (servicosMap[s] || 0) + 1;
      });
    }
  });

  const chartServicos = Object.entries(servicosMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value); // Sort descending

  const handleDownloadPDF = async () => {
    const input = document.getElementById('dashboard-report');
    if (!input) return;

    try {
      setIsGeneratingPDF(true);
      
      // Ensure all custom fonts are completely loaded before taking snapshot
      await document.fonts.ready;

      // Temporarily hide elements not meant for print
      const noPrintElements = document.querySelectorAll('.no-print');
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

      // Temporarily remove tailwind's truncate to prevent text getting randomly cut-off in the SVG
      const truncateElements = document.querySelectorAll('.truncate');
      const truncateOriginals: {el: HTMLElement, style: string}[] = [];
      truncateElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        truncateOriginals.push({ el: htmlEl, style: htmlEl.style.whiteSpace });
        htmlEl.style.whiteSpace = 'normal';
        htmlEl.style.overflow = 'visible';
        htmlEl.style.textOverflow = 'clip';
      });

      // Wait 1.5s for any Recharts animations to finish to avoid mid-animation graphical glitches
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      const dataUrl = await toPng(input, {
        cacheBust: true,
        pixelRatio: 2, // Restored high res definition
        style: {
          backgroundColor: '#F7F5F2' // Warm White base color
        }
      });

      // Restore elements
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });
      
      truncateOriginals.forEach(({el, style}) => {
        el.style.whiteSpace = style;
        el.style.overflow = '';
        el.style.textOverflow = '';
      });
      
      const margin = 12; // 12mm padding on all sides
      const pdfWidth = 210; // A4 standard width
      const contentPdfWidth = pdfWidth - (margin * 2);
      const contentPdfHeight = (input.offsetHeight * contentPdfWidth) / input.offsetWidth;
      const pdfHeight = contentPdfHeight + (margin * 2);
      
      // Create a continuous page matching exactly the content height + margins
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      
      // Paint background of PDF to match the app's warm white
      pdf.setFillColor(247, 245, 242);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      
      // Draw image inside the padded area
      pdf.addImage(dataUrl, 'PNG', margin, margin, contentPdfWidth, contentPdfHeight);

      const dataHoje = format(new Date(), 'dd_MM_yyyy');
      pdf.save(`Relatorio_Performance_${filter}_${dataHoje}.pdf`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      alert('Houve um erro ao gerar o PDF. Detalhes: ' + (error?.message || error));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div id="dashboard-report" className="space-y-6 relative pb-8">
      <div className="flex flex-col gap-4 p-4 bg-[var(--color-bg-card)] rounded-[12px] border border-[var(--color-border-card)] shadow-[var(--shadow-card)] relative z-10">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {(['ontem', 'hoje', '7dias', '14dias', 'mes', 'ano'] as DateFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-all flex-grow sm:flex-grow-0 text-center cursor-pointer active:scale-95 hover:brightness-95 whitespace-nowrap ${filter === f ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}
              >
                {f === 'hoje' ? 'Hoje' : f === 'ontem' ? 'Ontem' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0 xl:justify-end">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <div className="w-[130px] sm:w-[150px] shrink-0">
                <Input 
                  type="date" 
                  value={customStart} 
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => { setCustomStart(e.target.value); setFilter('custom'); }} 
                />
              </div>
              <span className="text-[var(--color-text-muted)] text-sm font-medium shrink-0">até</span>
              <div className="w-[130px] sm:w-[150px] shrink-0">
                <Input 
                  type="date" 
                  value={customEnd} 
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => { setCustomEnd(e.target.value); setFilter('custom'); }} 
                />
              </div>
            </div>
            <div className="relative z-[100] flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button 
                onClick={handleCustomFilter}
                className="px-4 py-2 sm:px-6 sm:py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-[8px] transition-all hover:brightness-105 active:scale-95 cursor-pointer shadow-lg shrink-0 flex items-center justify-center min-w-[100px] no-print"
              >
                Filtrar
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="px-4 py-2 sm:px-4 sm:py-2.5 bg-[#18181b] dark:bg-white dark:text-[#18181b] text-white text-sm font-bold rounded-[8px] transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-lg shrink-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed no-print border border-zinc-800 dark:border-white"
              >
                {isGeneratingPDF ? (
                   <span className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                     Gerando...
                   </span>
                ) : (
                   <span className="flex items-center gap-2 whitespace-nowrap">
                     <FileDown className="w-4 h-4" />
                     Gerar PDF
                   </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {leadsFora > 0 && (
        <div className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-100 rounded-[12px] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-2 bg-orange-100 rounded-full text-orange-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-orange-900 font-medium">Demanda Fora de Horário:</span>
            <span className="text-orange-800 ml-1">
              {leadsFora} {leadsFora === 1 ? 'pessoa entrou' : 'pessoas entraram'} em contato fora do horário de atendimento neste período.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Novos leads', value: metrics.leads, icon: Users },
          { label: 'Agendamentos', value: metrics.agendamentos, icon: CalendarIcon },
          { label: 'Conversões', value: metrics.clientes, icon: UserCheck },
          { label: 'Faturamento Total', value: `R$ ${metrics.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign }
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-[var(--color-primary-light)] rounded-[8px] text-[var(--color-primary)]">
                <m.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="font-cormorant text-3xl font-bold text-[var(--color-text-main)] leading-none">{m.value}</div>
                <div className="text-sm text-[var(--color-text-muted)] mt-1">{m.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atendimentos no WhatsApp</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Total de leads atendidos pelo agente de IA por dia no período selecionado</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart1Data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-card)" />
                <XAxis dataKey="dia" axisLine={false} tickLine={false} tickMargin={10} padding={{ left: 20, right: 20 }} />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="var(--color-primary)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dias com mais movimento</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Veja em quais dias da semana sua clínica recebe mais contatos</p>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart2Data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-card)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  cursor={{ fill: 'var(--color-bg-base)', opacity: 0.1 }} 
                  contentStyle={{ color: 'var(--color-text-main)', borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)', background: 'var(--color-bg-base)' }}
                  itemStyle={{ color: 'var(--color-text-main)' }}
                />
                <Bar 
                  dataKey="valor" 
                  name="Leads"
                  fill="var(--color-primary)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32} 
                  label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 12, fontWeight: '500' }} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Horário dos contatos</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Contatos dentro e fora do horário de funcionamento</p>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={chart3Data} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius="70%" 
                    outerRadius="90%" 
                    paddingAngle={5} 
                    dataKey="value"
                    stroke="none"
                  >
                    {chart3Data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-dropdown)', backgroundColor: 'rgba(255,255,255,0.95)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={40} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-muted)] text-center bg-[var(--color-bg-base)] p-2 rounded-[8px]">
              ⚙️ Horário atual reflete as configurações administrativas ativas da empresa.
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Qualificação dos Leads</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Comparativo entre qualificados e quem abandonou a conversa</p>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col justify-between">
            {totalLeads > 0 ? (
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={qualificacaoData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="70%" 
                      outerRadius="90%" 
                      paddingAngle={5} 
                      dataKey="value"
                      stroke="none"
                    >
                      {qualificacaoData.map((entry, index) => <Cell key={`cell-${index}`} fill={QUALI_COLORS[index]} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-dropdown)', backgroundColor: 'rgba(255,255,255,0.95)' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={40} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                Nenhum lead registrado no período.
              </div>
            )}
            <div className="mt-2 text-xs text-[var(--color-text-muted)] text-center bg-[var(--color-bg-base)] p-2 rounded-[8px]">
              Total de <strong>{totalLeads}</strong> leads analisados no período selecionado.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>Principais Objeções</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Motivos pelos quais os contatos não se tornaram clientes</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartObjecoes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartObjecoes} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-card)" />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: 'var(--color-text-main)', fontSize: 11 }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-bg-base)', opacity: 0.1 }} 
                    contentStyle={{ color: 'var(--color-text-main)', borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)', background: 'var(--color-bg-base)' }}
                    itemStyle={{ color: 'var(--color-text-main)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    name="Leads"
                    fill="var(--color-primary)"
                    radius={[0, 4, 4, 0]} 
                    barSize={24} 
                    label={{ position: 'right', fill: 'var(--color-text-muted)', fontSize: 12, fontWeight: '500' }} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">Nenhuma objeção registrada no período.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>Principais Serviços</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Serviços mais contratados nas vendas fechadas</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartServicos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartServicos} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-card)" />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: 'var(--color-text-main)', fontSize: 11 }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-bg-base)', opacity: 0.1 }} 
                    contentStyle={{ color: 'var(--color-text-main)', borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)', background: 'var(--color-bg-base)' }}
                    itemStyle={{ color: 'var(--color-text-main)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    name="Vendas"
                    fill="var(--color-primary)"
                    radius={[0, 4, 4, 0]} 
                    barSize={24} 
                    label={{ position: 'right', fill: 'var(--color-text-muted)', fontSize: 12, fontWeight: '500' }} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">Nenhum serviço registrado nas conversões do período.</div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
