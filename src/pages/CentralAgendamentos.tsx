import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { CalendarCheck, Phone, Clock, ChevronDown, RefreshCw, CheckCircle, XCircle, UserCheck, CalendarIcon, Monitor, MapPin, ExternalLink } from 'lucide-react';

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou' },
  { id: 'conversando', title: 'Conversando' },
  { id: 'follow_up', title: 'Follow-Up' },
  { id: 'agendado', title: 'Agendado' },
  { id: 'reagendado', title: 'Reagendado' },
  { id: 'faltou', title: 'Faltou' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento' },
  { id: 'converteu', title: 'Converteu (Venda)' },
  { id: 'nao_converteu', title: 'Não Converteu' },
  { id: 'abandonou_conversa', title: 'Abandonou' }
];

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
  const [openLeadDetails, setOpenLeadDetails] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ 
    genero: '', 
    data_nascimento: '', 
    observacoes: '',
    nome_lead: '',
    procedimento_interesse: ''
  });

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

  const fetchServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('nome');
    if (data) setAvailableServicos(data);
  };

  useEffect(() => { fetchAgendas(); fetchServicos(); }, []);
  
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
  // ─── AÇÕES ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    if (newStatus === 'converteu') {
      const lead = detalhesAg?.leads;
      if (lead) {
        setConverteuForm({ servicos: lead.servicos_contratados || [], valor: String(lead.valor_pago || ''), observacao: '' });
        setConfirmConverteu({ leadId, sourceCol: lead.status, lead });
        setOpenLeadDetails(false); // Fecha o modal de detalhes temporariamente
      }
      return;
    }

    setSavingStatus(true);
    const updates: any = { status: newStatus };
    
    if (['converteu', 'nao_converteu'].includes(detalhesAg?.leads?.status)) {
       updates.valor_pago = 0;
       updates.objecao = null;
       updates.motivo_perda = null;
    }
    if (['iniciou_atendimento', 'conversando'].includes(newStatus)) {
       updates.data_agendamento = null;
       updates.id_agendamento = null;
       updates.agendamento_criado_em = null;
       updates.modalidade = null;
    }

    const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
    if (error) alert('Erro ao atualizar status do lead.');
    
    setDetalhesAg((prev: any) => ({ ...prev, leads: { ...prev.leads, ...updates } }));
    setSavingStatus(false);
    fetchAgendamentos();
  };

  const handleUpdateDetails = async () => {
    if (!detalhesAg?.leads) return;
    setSavingDetails(true);
    try {
      const { error } = await supabase.from('leads').update({
        nome_lead: detailsForm.nome_lead,
        genero: detailsForm.genero,
        data_nascimento: detailsForm.data_nascimento || null,
        observacoes: detailsForm.observacoes,
        procedimento_interesse: detailsForm.procedimento_interesse
      }).eq('id', detalhesAg.leads.id);
      
      if (error) throw error;
      
      setDetalhesAg((prev: any) => ({ ...prev, leads: { ...prev.leads, ...detailsForm } }));
      setEditingDetails(false);
      fetchAgendamentos();
    } catch (err: any) {
      alert(`Erro ao salvar detalhes: ${err.message}`);
    } finally {
      setSavingDetails(false);
    }
  };

  const confirmConverteuAction = async () => {
    if (!confirmConverteu || !converteuForm.valor || converteuForm.servicos.length === 0) return;
    const { leadId, lead } = confirmConverteu;
    setSavingConverteu(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'converteu',
          valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
          servicos_contratados: converteuForm.servicos,
          observacoes: converteuForm.observacao ? `${lead.observacoes || ''}\nInformações Complementares: ${converteuForm.observacao}` : lead.observacoes
        })
        .eq('id', leadId);
      if (error) throw error;

      if (lead.id_agendamento) {
        await supabase.from('agendamentos').update({ status: 'compareceu' }).eq('id', lead.id_agendamento);
      }

      setConfirmConverteu(null);
      fetchAgendamentos();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingConverteu(false);
    }
  };

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
                  <div className="flex flex-col items-center justify-center gap-1 min-w-[100px] border-r pr-4 border-[var(--color-border-card)] shrink-0">
                    <div className="font-bold text-lg leading-none">{format(parseISO(ag.data_hora_inicio), 'dd/MM')}</div>
                    <div className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(parseISO(ag.data_hora_inicio), 'HH:mm')}
                    </div>
                  </div>

                  {/* Info do Cliente e Procedimento */}
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => {
                        setDetalhesAg(ag);
                        if(ag.leads) {
                          setDetailsForm({
                            nome_lead: ag.leads.nome_lead || '',
                            genero: ag.leads.genero || '',
                            data_nascimento: ag.leads.data_nascimento || '',
                            observacoes: ag.leads.observacoes || '',
                            procedimento_interesse: ag.leads.procedimento_interesse || ''
                          });
                        }
                        setEditingDetails(false);
                      }}
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

                  {/* Status */}
                  <div className="flex items-center gap-4 shrink-0">
                    {ag.status !== 'agendado' && (
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_COLORS[ag.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[ag.status] || ag.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DETALHES DO LEAD */}
      <Modal isOpen={!!detalhesAg} onClose={() => setDetalhesAg(null)} title="Detalhes do Contato">
        {detalhesAg && detalhesAg.leads && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Header com Status */}
            <div className="bg-[var(--color-bg-base)] p-5 rounded-[16px] border border-[var(--color-border-card)] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {editingDetails ? (
                       <Input value={detailsForm.nome_lead} onChange={e => setDetailsForm({...detailsForm, nome_lead: e.target.value})} className="text-xl font-bold font-cormorant mb-1" />
                    ) : (
                       <h2 className="font-cormorant text-2xl font-bold text-[var(--color-text-main)]">{detalhesAg.leads.nome_lead || 'Lead sem nome'}</h2>
                    )}
                    <p className="text-sm text-[var(--color-text-muted)] font-medium">{detalhesAg.leads.whatsapp_lead}</p>
                  </div>
                  <Badge variant={detalhesAg.leads.status}>{COLUMNS.find(c => c.id === detalhesAg.leads.status)?.title || detalhesAg.leads.status}</Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Mudar Estágio</label>
                  <select 
                    value={detalhesAg.leads.status} 
                    onChange={(e) => handleStatusChange(detalhesAg.leads.id, e.target.value)}
                    disabled={savingStatus}
                    className="w-full bg-white border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
            </div>

            {/* Grid de Informações - Editável */}
            <div className="grid grid-cols-2 gap-4">
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Gênero</span>
                  {editingDetails ? (
                    <select 
                      value={detailsForm.genero} 
                      onChange={e => setDetailsForm({...detailsForm, genero: e.target.value})}
                      className="w-full mt-1 border rounded px-2 py-1 text-sm bg-white"
                    >
                      <option value="">Não informado</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  ) : (
                    <p className="text-sm font-medium mt-1">{detalhesAg.leads.genero || 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Nascimento</span>
                  {editingDetails ? (
                    <input 
                      type="date" 
                      value={detailsForm.data_nascimento} 
                      onChange={e => setDetailsForm({...detailsForm, data_nascimento: e.target.value})}
                      className="w-full mt-1 border rounded px-2 py-1 text-sm bg-white"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{detalhesAg.leads.data_nascimento ? format(parseISO(detalhesAg.leads.data_nascimento), 'dd/MM/yyyy') : 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Serviço/Assunto</span>
                  {editingDetails ? (
                    <Input 
                      value={detailsForm.procedimento_interesse} 
                      onChange={e => setDetailsForm({...detailsForm, procedimento_interesse: e.target.value})}
                      className="mt-1 h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{detalhesAg.leads.procedimento_interesse || 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Agendamento CRM</span>
                  <p className="text-sm font-medium mt-1">{detalhesAg.leads.data_agendamento ? format(parseISO(detalhesAg.leads.data_agendamento), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Sem agendamento'}</p>
               </div>
            </div>

            {/* Ação de Edição */}
            <div className="flex flex-col gap-2">
              {editingDetails ? (
                <>
                  <Button onClick={handleUpdateDetails} disabled={savingDetails} className="w-full bg-green-600">Salvar Alterações</Button>
                  <Button variant="secondary" onClick={() => setEditingDetails(false)} className="w-full">Cancelar Edição</Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditingDetails(true)} className="w-full font-bold">Editar Informações</Button>
              )}
            </div>

            {/* Resumo e Observações/Histórico */}
            <div className="space-y-4">
              {detalhesAg.leads.resumo_conversa && !editingDetails && (
                <div className="p-4 border border-[var(--color-border-card)] rounded-[12px] bg-white relative">
                  <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-tight">IA - Resumo Automático</span>
                  <p className="text-sm text-[var(--color-text-main)] italic leading-relaxed pt-1">"{detalhesAg.leads.resumo_conversa}"</p>
                </div>
              )}

              <div className="p-4 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Histórico / Observações Manuais</span>
                {editingDetails ? (
                  <textarea 
                    rows={4} 
                    value={detailsForm.observacoes} 
                    onChange={e => setDetailsForm({...detailsForm, observacoes: e.target.value})}
                    className="w-full mt-2 border rounded p-2 text-sm bg-white"
                    placeholder="Escreva algo aqui..."
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text-main)] whitespace-pre-wrap mt-2">{detalhesAg.leads.observacoes || 'Nenhuma observação registrada.'}</p>
                )}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
               <Button className="w-full" onClick={() => setDetalhesAg(null)}>Fechar</Button>
               {detalhesAg.leads.whatsapp_lead && (
                 <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={() => window.open(`https://wa.me/${detalhesAg.leads.whatsapp_lead.replace(/\D/g, '')}`, '_blank')}>
                   <Phone className="w-4 h-4" /> WhatsApp
                 </Button>
               )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Converteu */}
      <Modal isOpen={!!confirmConverteu} onClose={() => setConfirmConverteu(null)} title="Finalizar Venda">
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-[8px] text-green-800 font-medium text-sm">🚀 Parabéns! Preencha os dados do contrato.</div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Serviços Contratados *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 p-1">
              {availableServicos.map(srv => (
                <label key={srv.id} className="flex items-center gap-2 p-2 border border-[var(--color-border-card)] rounded-[8px] hover:bg-[var(--color-bg-base)] cursor-pointer transition-colors text-sm">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    checked={converteuForm.servicos.includes(srv.nome)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConverteuForm(prev => ({ ...prev, servicos: [...prev.servicos, srv.nome] }));
                      } else {
                        setConverteuForm(prev => ({ ...prev, servicos: prev.servicos.filter(n => n !== srv.nome) }));
                      }
                    }}
                  />
                  <span className="truncate">{srv.nome}</span>
                </label>
              ))}
              {availableServicos.length === 0 && (
                <div className="col-span-1 sm:col-span-2 text-sm text-[var(--color-text-muted)] p-2">Nenhum serviço cadastrado em Configurações.</div>
              )}
            </div>
          </div>

          <div><label className="block text-sm font-medium mb-1">Valor Total Faturado (R$) *</label><Input placeholder="0,00" value={converteuForm.valor} onChange={e => setConverteuForm({...converteuForm, valor: e.target.value})} /></div>
          <div><label className="block text-sm font-medium mb-1">Informações Complementares</label><textarea rows={3} value={converteuForm.observacao} onChange={e => setConverteuForm({...converteuForm, observacao: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)]" /></div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmConverteu(null)}>Cancelar</Button>
            <Button className="bg-green-600 text-white" onClick={confirmConverteuAction} disabled={!converteuForm.valor || converteuForm.servicos.length === 0 || savingConverteu}>Confirmar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
