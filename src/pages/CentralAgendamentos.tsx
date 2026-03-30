import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { CalendarCheck, Phone, Clock, ChevronDown, RefreshCw, CheckCircle, XCircle, UserCheck, CalendarIcon } from 'lucide-react';

type Filtro = 'hoje' | 'semana' | 'mes' | 'custom';
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

  // Modal reagendar
  const [reagendarModal, setReagendar] = useState<any>(null);
  const [novaDataHora, setNovaDataHora] = useState('');
  const [salvandoReagendar, setSalvandoReagendar] = useState(false);

  // Modal confirmação de ação
  const [acaoModal, setAcaoModal] = useState<{ agendamento: any, acao: string } | null>(null);
  const [processando, setProcessando] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (filtro) {
      case 'hoje': return { start: startOfDay(now), end: endOfDay(now) };
      case 'semana': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'mes': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return {
          start: customStart ? new Date(customStart + 'T00:00:00') : startOfDay(now),
          end: customEnd ? new Date(customEnd + 'T23:59:59') : endOfDay(now),
        };
    }
  };

  const fetchAgendas = async () => {
    const { data } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true);
    if (data) setAgendas(data);
  };

  const fetchAgendamentos = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    let query = supabase
      .from('agendamentos')
      .select('*, agendas(nome, cor)')
      .gte('data_hora_inicio', start.toISOString())
      .lte('data_hora_inicio', end.toISOString())
      .order('data_hora_inicio', { ascending: true });

    if (agendaFiltro !== 'todas') query = query.eq('agenda_id', agendaFiltro);
    if (statusFiltro !== 'todos') query = query.eq('status', statusFiltro);

    const { data } = await query;
    setAgendamentos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAgendas(); }, []);
  useEffect(() => { fetchAgendamentos(); }, [filtro, agendaFiltro, statusFiltro, customStart, customEnd]);

  // ─── AÇÕES ────────────────────────────────────────────────────────────────

  const executarAcao = async () => {
    if (!acaoModal) return;
    const { agendamento, acao } = acaoModal;
    setProcessando(true);

    const statusMap: Record<string, StatusAgendamento> = {
      confirmar: 'confirmado',
      compareceu: 'compareceu',
      cancelar: 'cancelado',
      faltou: 'faltou',
    };
    const novoStatus = statusMap[acao];

    const { error } = await supabase
      .from('agendamentos')
      .update({ status: novoStatus })
      .eq('id', agendamento.id);

    if (error) { alert(`Erro: ${error.message}`); setProcessando(false); return; }

    // Sincroniza status do lead se necessário
    if (agendamento.lead_id) {
      const leadStatusMap: Record<string, string> = {
        confirmar: 'agendado',
        compareceu: 'compareceu',
        cancelar: 'cancelou_agendamento',
        faltou: 'follow_up',
      };
      await supabase.from('leads').update({ status: leadStatusMap[acao] }).eq('id', agendamento.lead_id);
    }

    setAcaoModal(null);
    setProcessando(false);
    fetchAgendamentos();
  };

  const reagendar = async () => {
    if (!reagendarModal || !novaDataHora) return;
    setSalvandoReagendar(true);

    const novaData = new Date(novaDataHora).toISOString();

    const { error } = await supabase
      .from('agendamentos')
      .update({ data_hora_inicio: novaData, status: 'agendado' })
      .eq('id', reagendarModal.id);

    if (error) { alert(`Erro: ${error.message}`); setSalvandoReagendar(false); return; }

    // Sincroniza data no lead
    if (reagendarModal.lead_id) {
      await supabase.from('leads').update({ data_agendamento: novaData }).eq('id', reagendarModal.lead_id);
    }

    setReagendar(null);
    setNovaDataHora('');
    setSalvandoReagendar(false);
    fetchAgendamentos();
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const totalHoje = agendamentos.length;
  const confirmados = agendamentos.filter(a => a.status === 'confirmado' || a.status === 'compareceu').length;
  const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;

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

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'No período', value: totalHoje, icon: CalendarIcon, color: 'text-[var(--color-primary)]' },
          { label: 'Confirmados', value: confirmados, icon: CheckCircle, color: 'text-[#7A9E87]' },
          { label: 'Cancelados', value: cancelados, icon: XCircle, color: 'text-red-500' },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className={`w-8 h-8 ${m.color}`} />
              <div>
                <div className="text-2xl font-bold font-cormorant">{m.value}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            {/* Filtro de período */}
            <div className="flex flex-wrap gap-2">
              {(['hoje', 'semana', 'mes'] as Filtro[]).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors ${filtro === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}>
                  {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Semana' : 'Mês'}
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
                <div key={ag.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[var(--color-bg-base)] transition-colors">
                  {/* Horário */}
                  <div className="flex items-center gap-3 min-w-[120px]">
                    <div className="p-2 bg-[var(--color-primary-light)] rounded-[8px] text-[var(--color-primary)]">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{format(parseISO(ag.data_hora_inicio), 'HH:mm')}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{format(parseISO(ag.data_hora_inicio), 'dd/MM/yyyy')}</div>
                    </div>
                  </div>

                  {/* Dados do paciente */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{ag.nome_lead || 'Paciente não informado'}</div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      {ag.whatsapp_lead && (
                        <a href={`https://wa.me/${ag.whatsapp_lead.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors">
                          <Phone className="w-3 h-3" />{ag.whatsapp_lead}
                        </a>
                      )}
                      {ag.procedimento_nome && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border">{ag.procedimento_nome}</span>
                      )}
                      {ag.agendas?.nome && (
                        <span className="text-xs font-medium" style={{ color: ag.agendas.cor }}>● {ag.agendas.nome}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[ag.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[ag.status] || ag.status}
                    </span>

                    {/* Ações */}
                    <div className="flex gap-1.5 flex-wrap">
                      {ag.status !== 'confirmado' && ag.status !== 'compareceu' && ag.status !== 'cancelado' && (
                        <button onClick={() => setAcaoModal({ agendamento: ag, acao: 'confirmar' })}
                          className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-[#7A9E87]/15 text-[#5f8a6e] hover:bg-[#7A9E87]/30 transition-colors border border-[#7A9E87]/30">
                          ✓ Confirmar
                        </button>
                      )}
                      {ag.status !== 'compareceu' && ag.status !== 'cancelado' && (
                        <button onClick={() => setAcaoModal({ agendamento: ag, acao: 'compareceu' })}
                          className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200">
                          ✓✓ Compareceu
                        </button>
                      )}
                      {ag.status !== 'cancelado' && ag.status !== 'compareceu' && (
                        <>
                          <button onClick={() => { setReagendar(ag); setNovaDataHora(''); }}
                            className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200">
                            ↻ Reagendar
                          </button>
                          {ag.status !== 'faltou' && (
                            <button onClick={() => setAcaoModal({ agendamento: ag, acao: 'faltou' })}
                              className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
                              ✕ Faltou
                            </button>
                          )}
                          <button onClick={() => setAcaoModal({ agendamento: ag, acao: 'cancelar' })}
                            className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200">
                            ✕ Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL AÇÃO */}
      <Modal
        isOpen={!!acaoModal}
        onClose={() => setAcaoModal(null)}
        title={
          acaoModal?.acao === 'confirmar' ? 'Confirmar Agendamento' :
          acaoModal?.acao === 'compareceu' ? 'Marcar Comparecimento' :
          acaoModal?.acao === 'cancelar' ? 'Cancelar Agendamento' : 'Marcar Falta'
        }
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-[8px] border font-medium text-sm ${
            acaoModal?.acao === 'cancelar' ? 'bg-red-50 border-red-200 text-red-700' :
            acaoModal?.acao === 'compareceu' ? 'bg-green-50 border-green-200 text-green-700' :
            'bg-[#7A9E87]/10 border-[#7A9E87]/30 text-[#5f8a6e]'
          }`}>
            {acaoModal?.acao === 'confirmar' && `Confirmar o agendamento de ${acaoModal?.agendamento?.nome_lead || 'paciente'}?`}
            {acaoModal?.acao === 'compareceu' && `Marcar que ${acaoModal?.agendamento?.nome_lead || 'o paciente'} compareceu?`}
            {acaoModal?.acao === 'faltou' && `Marcar que ${acaoModal?.agendamento?.nome_lead || 'o paciente'} faltou? O lead será movido para Follow Up no CRM.`}
            {acaoModal?.acao === 'cancelar' && `Cancelar o agendamento de ${acaoModal?.agendamento?.nome_lead || 'paciente'}? Isso atualizará o status no CRM também.`}
          </div>
          {acaoModal?.agendamento?.data_hora_inicio && (
            <p className="text-sm text-[var(--color-text-muted)]">
              📅 {format(parseISO(acaoModal.agendamento.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setAcaoModal(null)} disabled={processando}>Cancelar</Button>
            <Button
              className={`text-white border-none ${acaoModal?.acao === 'cancelar' ? 'bg-red-500 hover:bg-red-600' : acaoModal?.acao === 'compareceu' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#7A9E87] hover:bg-[#5f8a6e]'}`}
              onClick={executarAcao}
              disabled={processando}
            >
              {processando ? 'Processando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL REAGENDAR */}
      <Modal isOpen={!!reagendarModal} onClose={() => setReagendar(null)} title="Reagendar Consulta">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-amber-700 text-sm font-medium">
            ↻ Reagendando: <strong>{reagendarModal?.nome_lead || 'paciente'}</strong>
          </div>
          {reagendarModal?.data_hora_inicio && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Horário atual: {format(parseISO(reagendarModal.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Novo horário <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={novaDataHora}
              onChange={e => setNovaDataHora(e.target.value)}
              className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">O status voltará para "Agendado" e a data no CRM será atualizada automaticamente.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setReagendar(null)} disabled={salvandoReagendar}>Cancelar</Button>
            <Button
              className="bg-amber-500 text-white hover:bg-amber-600 border-none"
              onClick={reagendar}
              disabled={!novaDataHora || salvandoReagendar}
            >
              {salvandoReagendar ? 'Salvando...' : 'Confirmar Reagendamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
