import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Calendar as CalendarIcon, Users, UserCheck, Bot, Activity, Clock } from 'lucide-react';
import { 
  startOfToday, endOfToday, startOfYesterday, endOfYesterday, subDays, startOfMonth, 
  endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format, getDay, setHours, setMinutes
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

type DateFilter = 'hoje' | 'ontem' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';

export function Dashboard() {
  const [filter, setFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ agendamentos: 0, comparecimentos: 0, leads: 0, pacientes: 0 });
  const [clinicHours, setClinicHours] = useState<any[]>([]);
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [agendamentosData, setAgendamentosData] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    fetchClinicHours();
  }, []);

  useEffect(() => {
    applyFilter(filter);
  }, [filter]);

  useEffect(() => {
    fetchData();
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
      setDateRange({ start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();

      const [agendamentosReq, leadsReq, pacientesReq, upcomingReq] = await Promise.all([
        supabase.from('agendamentos').select('*').gte('created_at', startIso).lte('created_at', endIso),
        supabase.from('leads').select('*').gte('inicio_atendimento', startIso).lte('inicio_atendimento', endIso),
        supabase.from('pacientes').select('*').gte('created_at', startIso).lte('created_at', endIso),
        supabase.from('agendamentos')
          .select('*, leads(nome_lead, whatsapp_lead), pacientes(leads(nome_lead, whatsapp_lead)), agendas(nome, cor)')
          .gte('data_hora_inicio', new Date().toISOString())
          .order('data_hora_inicio', { ascending: true })
          .limit(5)
      ]);

      const agendamentos = agendamentosReq.data || [];
      const leads = leadsReq.data || [];
      const pacientes = pacientesReq.data || [];

      setAgendamentosData(agendamentos);
      setLeadsData(leads);
      setUpcoming(upcomingReq.data || []);

      setMetrics({
        agendamentos: agendamentos.length,
        comparecimentos: agendamentos.filter(a => a.status === 'compareceu').length,
        leads: leads.length,
        pacientes: pacientes.length
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
  const leadsByDayMap: Record<string, number> = {};
  leadsData.forEach(l => {
    if (!l.inicio_atendimento) return;
    const key = format(parseISO(l.inicio_atendimento), 'dd/MM');
    leadsByDayMap[key] = (leadsByDayMap[key] || 0) + 1;
  });
  const chart1Data = Object.keys(leadsByDayMap).map(k => ({ dia: k, leads: leadsByDayMap[k] })).sort((a,b) => a.dia.localeCompare(b.dia)); // simplified sorting

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
    { name: 'No Horário', value: leadsDentro },
    { name: 'Fora do Horário', value: leadsFora }
  ];
  const COLORS = ['var(--color-success)', 'var(--color-warning)'];

  // 4. Barras Horiz - Procedimentos procurados
  const procMap: Record<string, number> = {};
  agendamentosData.forEach(a => {
    if (!a.procedimento_nome) return;
    const proc = a.procedimento_nome.trim();
    if (!proc) return;
    procMap[proc] = (procMap[proc] || 0) + 1;
  });
  const sortedProcs = Object.keys(procMap).map(k => ({ proc: k, count: procMap[k] })).sort((a,b) => b.count - a.count).slice(0, 8);
  const maxProcCount = sortedProcs[0]?.count || 1;

  // 5. Funil de Vendas
  const totalLeads = leadsData.length;
  const leadsNaoQualificados = leadsData.filter(l => l.status === 'abandonou_conversa').length;
  const leadsQualificados = totalLeads - leadsNaoQualificados;
  
  const pctQualificados = totalLeads ? Math.round((leadsQualificados / totalLeads) * 100) : 0;
  const pctNaoQualificados = totalLeads ? Math.round((leadsNaoQualificados / totalLeads) * 100) : 0;
  
  const pctAgendaram = leadsQualificados ? Math.round((metrics.agendamentos / leadsQualificados) * 100) : 0;
  const pctCompareceram = metrics.agendamentos ? Math.round((metrics.comparecimentos / metrics.agendamentos) * 100) : 0;
  const pctConverteram = metrics.comparecimentos ? Math.round((metrics.pacientes / metrics.comparecimentos) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 p-4 bg-[var(--color-bg-card)] rounded-[12px] border border-[var(--color-border-card)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col xl:flex-row flex-wrap gap-4 xl:gap-2 xl:items-center w-full">
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {(['ontem', 'hoje', '7dias', '14dias', 'mes', 'ano'] as DateFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors flex-grow sm:flex-grow-0 text-center ${filter === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}
              >
                {f === 'hoje' ? 'Hoje' : f === 'ontem' ? 'Ontem' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0 xl:ml-4">
            <Input 
              type="date" 
              value={customStart} 
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setCustomStart(e.target.value); setFilter('custom'); }} 
              className="flex-1 w-auto min-w-[120px]"
            />
            <span className="text-[var(--color-text-muted)] text-sm whitespace-nowrap">até</span>
            <Input 
              type="date" 
              value={customEnd} 
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setCustomEnd(e.target.value); setFilter('custom'); }} 
              className="flex-1 w-auto min-w-[120px]"
            />
              <button 
                onClick={handleCustomFilter}
                className="px-4 py-2 sm:px-3 sm:py-1.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-[8px] transition-colors hover:bg-opacity-90 w-full sm:w-auto"
              >
                Filtrar
              </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Novos leads', value: metrics.leads, icon: Users },
          { label: 'Agendamentos do período', value: metrics.agendamentos, icon: CalendarIcon },
          { label: 'Comparecimentos', value: metrics.comparecimentos, icon: UserCheck },
          { label: 'Novos pacientes', value: metrics.pacientes, icon: Activity }
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

      {leadsFora > 0 && (
        <div className="bg-[var(--color-primary-light)] border-l-4 border-[var(--color-primary)] p-4 rounded-r-[12px] flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="p-2 bg-white rounded-full text-[var(--color-primary)] shadow-sm shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div className="text-[var(--color-text-main)] text-sm font-medium">
            <strong className="text-[var(--color-primary)] text-lg mr-1">{leadsFora}</strong> 
            pessoas tentaram falar com sua clínica fora do horário de atendimento neste período. Sem o agente de IA no WhatsApp, esses contatos teriam ido embora sem resposta — e provavelmente procurado a concorrência.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atendimentos no WhatsApp</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Total de leads atendidos pelo agente de IA por dia no período selecionado</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart1Data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-card)" />
                <XAxis dataKey="dia" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)' }} 
                />
                <Line type="monotone" dataKey="leads" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Dias com mais movimento</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Veja em quais dias da semana sua clínica recebe mais contatos</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart2Data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-card)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--color-primary-light)', opacity: 0.4 }} 
                  contentStyle={{ color: 'var(--color-text-main)', borderRadius: '8px', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-dropdown)', background: 'var(--color-bg-base)' }}
                  itemStyle={{ color: 'var(--color-primary)' }}
                />
                <Bar dataKey="valor" fill="var(--color-primary-light)" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: 'var(--color-primary)', fontSize: 13, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Horário dos contatos</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Contatos dentro e fora do horário de funcionamento</p>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart3Data} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={5} dataKey="value" label={({ name, value }) => value > 0 ? `${value}` : ''}>
                    {chart3Data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={40} style={{ paddingBottom: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-muted)] text-center bg-[var(--color-bg-base)] p-2 rounded-[8px]">
              ⚙️ Horário atual reflete as configurações administrativas ativas da clínica.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Procedimentos mais procurados</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Os serviços mais solicitados pelos seus leads no período</p>
          </CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedProcs} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-card)" />
                <XAxis type="number" hide />
                <YAxis dataKey="proc" type="category" axisLine={false} tickLine={false} width={100} style={{ fontSize: '11px' }}/>
                <Tooltip cursor={{ fill: 'var(--color-border-card)', opacity: 0.4 }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: 'var(--color-primary)', fontSize: 12, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Conversão geral no período</p>
          </CardHeader>
          <CardContent className="space-y-3 pb-2 sm:space-y-3 flex flex-col items-center sm:items-stretch">
            {/* Leads */}
            <div className="bg-[var(--color-bg-base)] p-3 sm:p-4 rounded-lg border border-[var(--color-border-card)] w-full max-w-[400px] sm:max-w-none">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 truncate pr-2"><div className="w-6 h-6 rounded-full bg-[var(--color-border-card)] flex items-center justify-center text-xs shrink-0">1</div> <span className="truncate">Leads</span></span>
                <span className="font-bold text-lg shrink-0">{totalLeads}</span>
              </div>
              <div className="flex flex-col text-xs mt-2 border-t border-[var(--color-border-card)] pt-2 gap-1 w-full">
                <div className="flex justify-between items-center text-[var(--color-success)]"><span className="font-medium truncate pr-2">Qualificados</span> <span className="shrink-0 whitespace-nowrap">{leadsQualificados} ({pctQualificados}%)</span></div>
                <div className="flex justify-between items-center text-[var(--color-error)] opacity-80"><span className="truncate pr-2">Abandonaram</span> <span className="shrink-0 whitespace-nowrap">{leadsNaoQualificados} ({pctNaoQualificados}%)</span></div>
              </div>
            </div>

            {/* Agendamentos */}
            <div className="bg-[var(--color-bg-base)] p-3 sm:p-4 rounded-lg border border-[var(--color-border-card)] w-[95%] sm:w-full mx-auto sm:ml-6 relative max-w-[400px] sm:max-w-none">
              <div className="hidden sm:block absolute -left-[25px] top-1/2 w-6 border-t-2 border-l-2 border-[var(--color-border-card)] rounded-tl-lg h-full -translate-y-full z-[-1]"></div>
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 truncate"><div className="w-6 h-6 rounded-full bg-[var(--color-border-card)] flex items-center justify-center text-xs shrink-0">2</div> <span className="truncate">Agendamentos</span></span>
                <div className="text-right flex items-center shrink-0">
                  <span className="font-bold text-lg">{metrics.agendamentos}</span>
                  <span className="text-xs text-[var(--color-primary)] ml-2 font-medium bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded shrink-0">+{pctAgendaram}%</span>
                </div>
              </div>
            </div>

            {/* Comparecimentos */}
            <div className="bg-[var(--color-bg-base)] p-3 sm:p-4 rounded-lg border border-[var(--color-border-card)] w-[90%] sm:w-full mx-auto sm:ml-12 relative max-w-[400px] sm:max-w-none">
              <div className="hidden sm:block absolute -left-[25px] top-1/2 w-6 border-t-2 border-l-2 border-[var(--color-border-card)] rounded-tl-lg h-full -translate-y-full z-[-1]"></div>
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 truncate"><div className="w-6 h-6 rounded-full bg-[var(--color-border-card)] flex items-center justify-center text-xs shrink-0">3</div> <span className="truncate">Confirmados</span></span>
                <div className="text-right flex items-center shrink-0">
                  <span className="font-bold text-lg">{metrics.comparecimentos}</span>
                  <span className="text-xs text-[var(--color-success)] ml-2 font-medium bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded shrink-0">+{pctCompareceram}%</span>
                </div>
              </div>
            </div>

            {/* Conversao */}
            <div className="bg-[var(--color-primary)] text-white p-3 sm:p-4 rounded-lg w-[85%] sm:w-full mx-auto sm:ml-16 shadow-sm relative max-w-[400px] sm:max-w-none">
              <div className="hidden sm:block absolute -left-[25px] top-1/2 w-6 border-t-2 border-l-2 border-[var(--color-border-card)] rounded-tl-lg h-full -translate-y-full z-[-1] opacity-50"></div>
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold flex items-center gap-2 text-base truncate"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">4</div> <span className="truncate">Conversões</span></span>
                <div className="text-right flex items-center shrink-0">
                  <span className="font-bold text-xl">{metrics.pacientes}</span>
                  <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded ml-2 mt-0.5 shrink-0">+{pctConverteram}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {upcoming.map((u, i) => {
              const nome = u.leads?.nome_lead || u.pacientes?.leads?.nome_lead || 'Sem nome';
              return (
                <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 ${i !== upcoming.length - 1 ? 'border-b border-[var(--color-border-card)]' : ''}`}>
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                    <div className="bg-[var(--color-bg-base)] rounded-[8px] p-2 text-center min-w-[55px] sm:min-w-[60px] border border-[var(--color-border-card)] flex-shrink-0">
                      <div className="text-[10px] sm:text-xs text-[var(--color-text-muted)] uppercase">{format(parseISO(u.data_hora_inicio), 'MMM', { locale: ptBR })}</div>
                      <div className="text-base sm:text-lg font-bold text-[var(--color-primary)] leading-none">{format(parseISO(u.data_hora_inicio), 'dd')}</div>
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-[var(--color-text-main)] flex items-center gap-2 flex-wrap">
                        <span className="truncate">{nome}</span> <Badge variant={u.status} className="flex-shrink-0">{u.status}</Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-[var(--color-text-muted)] flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 whitespace-nowrap text-xs"><Clock className="w-3.5 h-3.5"/> {format(parseISO(u.data_hora_inicio), 'HH:mm')}</span>
                        {u.procedimento_nome && <span className="truncate max-w-[150px] sm:max-w-[200px] text-xs">• {u.procedimento_nome}</span>}
                      </div>
                    </div>
                  </div>
                  {u.agendas && (
                    <div className="text-[10px] sm:text-sm border rounded-full px-2 py-0.5 sm:px-3 sm:py-1 flex items-center gap-2 flex-shrink-0 self-start sm:self-auto ml-[70px] sm:ml-0" style={{ borderColor: u.agendas.cor }}>
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: u.agendas.cor }}></div>
                      <span className="truncate max-w-[120px]">{u.agendas.nome}</span>
                    </div>
                  )}
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-muted)]">Nenhum agendamento futuro encontrado.</div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
