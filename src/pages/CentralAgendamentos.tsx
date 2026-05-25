import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { CalendarCheck, Phone, Clock, ChevronDown, RefreshCw, CheckCircle, XCircle, UserCheck, CalendarIcon, Monitor, MapPin, ExternalLink } from 'lucide-react';

type Filtro = 'hoje' | 'amanha' | '7_dias' | '14_dias' | 'mes' | 'custom';
type StatusAgendamento = 'agendado' | 'confirmado' | 'compareceu' | 'faltou' | 'cancelado';

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  compareceu: 'Compareceu',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  agendado: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmado: 'bg-[#7A9E87]/15 text-[#5f8a6e] border-[#7A9E87]/30',
  compareceu: 'bg-green-100 text-green-700 border-green-200',
  faltou: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelado: 'bg-red-100 text-red-600 border-red-200',
};

export function CentralAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtro, setFiltro] = useState<Filtro>('hoje');
  const [agendaFiltro, setAgendaFiltro] = useState<string>('todas');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modal de detalhes do Lead
  const [detalhesAg, setDetalhesAg] = useState<any>(null);

  const getDateRange = () => {
    const now = new Date();
    switch (filtro) {
      case 'hoje': return { start: startOfDay(now), end: endOfDay(now) };
      case 'amanha': {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) };
      }
      case '7_dias': {
        const next7 = new Date(now);
        next7.setDate(next7.getDate() + 7);
        return { start: startOfDay(now), end: endOfDay(next7) };
      }
      case '14_dias': {
        const next14 = new Date(now);
        next14.setDate(next14.getDate() + 14);
        return { start: startOfDay(now), end: endOfDay(next14) };
      }
      case 'mes': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return {
          start: customStart ? new Date(customStart + 'T00:00:00') : startOfDay(now),
          end: customEnd ? new Date(customEnd + 'T23:59:59') : endOfDay(now),
        };
    }
  };

  const fetchAgendas = async () => {
    try {
      const { data, error } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true);
      if (error) {
        console.error('Erro ao buscar agendas:', error);
      } else if (data) {
        setAgendas(data);
      }
    } catch (err) {
      console.error('Falha de rede ao buscar agendas:', err);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      let query = supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor), leads:lead_id(*)')
        .gte('data_hora_inicio', start.toISOString())
        .lte('data_hora_inicio', end.toISOString())
        .order('data_hora_inicio', { ascending: true });

      if (agendaFiltro !== 'todas') query = query.eq('agenda_id', agendaFiltro);
      if (statusFiltro !== 'todos') query = query.eq('status', statusFiltro);

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao buscar agendamentos:', error);
      } else {
        setAgendamentos(data || []);
      }
    } catch (err) {
      console.error('Falha de rede ao buscar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgendas(); }, []);
  
  useEffect(() => { 
    fetchAgendamentos(); 
    
    const handleFocus = () => fetchAgendamentos();
    const handleOnline = () => fetchAgendamentos();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // ─── REALTIME SYNC (Ouça as alterações da I.A.) ───────────────────────
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => {
          fetchAgendamentos(); // Atualiza a tela instantaneamente
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [filtro, agendaFiltro, statusFiltro, customStart, customEnd]);
  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-cormorant text-2xl font-bold">Central de Agendamentos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Gerencie todos os agendamentos por profissional e status.</p>
        </div>
        <button onClick={fetchAgendamentos} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            {/* Filtro de período */}
            <div className="flex flex-wrap gap-2">
              {(['hoje', 'amanha', '7_dias', '14_dias', 'mes'] as Filtro[]).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors ${filtro === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}>
                  {f === 'hoje' ? 'Hoje' : f === 'amanha' ? 'Amanhã' : f === '7_dias' ? '7 dias' : f === '14_dias' ? '14 dias' : 'Mês'}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input type="date" value={customStart}
                  onChange={e => { setCustomStart(e.target.value); setFiltro('custom'); }}
                  className="border border-[var(--color-border-card)] rounded-[8px] px-2 py-1.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)]" />
                <span className="text-[var(--color-text-muted)] text-sm">até</span>
                <input type="date" value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value); setFiltro('custom'); }}
                  className="border border-[var(--color-border-card)] rounded-[8px] px-2 py-1.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)]" />
              </div>
            </div>

            <div className="flex gap-3 flex-wrap xl:ml-auto">
              {/* Filtro por agenda */}
              <select value={agendaFiltro} onChange={e => setAgendaFiltro(e.target.value)}
                className="border border-[var(--color-border-card)] rounded-[8px] px-3 py-1.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)]">
                <option value="todas">Todas as agendas</option>
                {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>

              {/* Filtro por status */}
              <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
                className="border border-[var(--color-border-card)] rounded-[8px] px-3 py-1.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)]">
                <option value="todos">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de agendamentos */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--color-text-muted)]">Carregando...</div>
          ) : agendamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-text-muted)]">
              <CalendarIcon className="w-12 h-12 opacity-30" />
              <p className="font-medium">Nenhum agendamento no período</p>
              <p className="text-sm">Tente ajustar os filtros acima</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-card)]">
              {agendamentos.map(ag => (
                <div key={ag.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--color-bg-base)] transition-colors">
                  
                  {/* Info Principal: Horário */}
                  <div className="flex items-center gap-4 min-w-[150px]">
                    <div className="p-2.5 bg-[var(--color-primary-light)] rounded-[10px] text-[var(--color-primary)]">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base">{format(parseISO(ag.data_hora_inicio), 'HH:mm')}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{format(parseISO(ag.data_hora_inicio), 'dd/MM/yyyy')}</div>
                    </div>
                  </div>

                  {/* Info do Cliente e Procedimento */}
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => setDetalhesAg(ag)}
                      className="font-bold text-base hover:text-[var(--color-primary)] transition-colors text-left group flex items-center gap-2"
                    >
                      {ag.nome_lead || 'Cliente não informado'}
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* Procedimento/Serviço */}
                      <span className="text-sm font-medium text-[var(--color-text-main)]">
                        {ag.procedimento_nome && ag.procedimento_nome !== 'Consulta Jurídica' 
                          ? ag.procedimento_nome 
                          : ag.leads?.procedimento_interesse || 'Procedimento não especificado'}
                      </span>
                      
                      {/* Modalidade */}
                      {ag.modalidade && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${ag.modalidade === 'online' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                          {ag.modalidade === 'online' ? <Monitor className="w-3 h-3"/> : <MapPin className="w-3 h-3"/>}
                          {ag.modalidade === 'online' ? 'Online' : 'Presencial'}
                        </span>
                      )}
                      
                      {/* Agenda */}
                      {ag.agendas?.nome && (
                        <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: ag.agendas.cor }}>
                           <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ag.agendas.cor }}></span>
                           {ag.agendas.nome}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status e Ações */}
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_COLORS[ag.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[ag.status] || ag.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DETALHES DO LEAD */}
      <Modal
        isOpen={!!detalhesAg}
        onClose={() => setDetalhesAg(null)}
        title="Detalhes do Lead"
      >
        {detalhesAg && (
          <div className="space-y-6">
            <div className="border-b border-[var(--color-border-card)] pb-4">
              <h2 className="font-cormorant text-2xl font-bold text-[var(--color-text-main)]">{detalhesAg.nome_lead || 'Sem Nome'}</h2>
              <div className="flex items-center gap-3 mt-2">
                 <Badge variant={detalhesAg.leads?.status || 'novo'}>{detalhesAg.leads?.status?.replace(/_/g, ' ').toUpperCase() || 'NOVO'}</Badge>
                 <span className="text-xs text-[var(--color-text-muted)]">
                   Capturado em: {detalhesAg.leads?.created_at ? format(parseISO(detalhesAg.leads.created_at), 'dd/MM/yyyy') : '-'}
                 </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--color-bg-base)] rounded-[8px] border border-[var(--color-border-card)]">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">WhatsApp</div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-green-600" />
                  {detalhesAg.whatsapp_lead}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg-base)] rounded-[8px] border border-[var(--color-border-card)]">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">Procedimento de Interesse</div>
                <div className="text-sm font-medium text-[var(--color-text-main)]">
                  {detalhesAg.procedimento_nome && detalhesAg.procedimento_nome !== 'Consulta Jurídica' 
                    ? detalhesAg.procedimento_nome 
                    : detalhesAg.leads?.procedimento_interesse || '-'}
                </div>
              </div>
              
              <div className="p-3 bg-[var(--color-bg-base)] rounded-[8px] border border-[var(--color-border-card)]">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">Canal de Origem</div>
                <div className="text-sm font-medium text-[var(--color-text-main)]">
                  {detalhesAg.leads?.canal_origem || '-'}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg-base)] rounded-[8px] border border-[var(--color-border-card)]">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">Valor Potencial</div>
                <div className="text-sm font-medium text-[var(--color-primary)] font-bold">
                  {detalhesAg.leads?.valor_potencial ? `R$ ${detalhesAg.leads.valor_potencial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-base)] border-l-4 border-[var(--color-primary)] rounded-[8px] shadow-sm">
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2 font-bold">Resumo da Conversa (I.A.)</div>
              <p className="text-sm italic text-[var(--color-text-main)] leading-relaxed">
                "{detalhesAg.leads?.resumo_conversa || detalhesAg.resumo_conversa || 'Nenhum resumo disponível.'}"
              </p>
            </div>

            <div className="pt-4 flex gap-3">
               <Button className="w-full" onClick={() => setDetalhesAg(null)}>Fechar</Button>
               {detalhesAg.whatsapp_lead && (
                 <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={() => window.open(`https://wa.me/${detalhesAg.whatsapp_lead.replace(/\D/g, '')}`, '_blank')}>
                   <Phone className="w-4 h-4" /> Abrir WhatsApp
                 </Button>
               )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
