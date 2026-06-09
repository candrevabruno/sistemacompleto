import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { CalendarIcon, Clock, RefreshCw, User, MessageSquare } from 'lucide-react';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';

type Filtro = 'hoje' | 'amanha' | '7_dias' | '14_dias' | 'mes' | 'custom';

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  compareceu: 'Compareceu',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
  reagendado: 'Reagendado',
};

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  agendado:    { background: '#EFF6FF',             color: '#1D4ED8' },
  confirmado:  { background: 'var(--sage-xlight)',  color: 'var(--sage-dark)' },
  compareceu:  { background: 'var(--sage-xlight)',  color: 'var(--sage-dark)' },
  faltou:      { background: '#F1F5F9',             color: '#64748B' },
  cancelado:   { background: 'var(--rose-light)',   color: 'var(--rose-text)' },
  reagendado:  { background: 'var(--champ-light)',  color: 'var(--champ-text)' },
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function CentralAgendamentos() {
  const navigate = useNavigate();
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
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);

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
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchAgendamentos(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    // ─── REALTIME SYNC (Ouça as alterações da I.A.) ───────────────────────
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => {
          fetchAgendamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [filtro, agendaFiltro, statusFiltro, customStart, customEnd]);

  // ─── Agrupamento por data ─────────────────────────────────────────────────
  const grouped: { label: string; date: Date; items: any[] }[] = [];
  agendamentos.forEach(ag => {
    const d = parseISO(ag.data_hora_inicio);
    const existing = grouped.find(g => isSameDay(g.date, d));
    if (existing) {
      existing.items.push(ag);
    } else {
      grouped.push({
        label: format(d, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        date: d,
        items: [ag],
      });
    }
  });

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const PERIOD_PILLS: { key: Filtro; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'amanha', label: 'Amanhã' },
    { key: '7_dias', label: '7 dias' },
    { key: '14_dias', label: '14 dias' },
    { key: 'mes', label: 'Mês' },
  ];

  return (
    <div style={{ padding: '22px 24px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div
          className="font-display"
          style={{ fontSize: '24px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.2 }}
        >
          Central de Agendamentos
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          Gerencie todos os agendamentos por profissional e status
        </p>
      </div>

      {/* Filtros */}
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Period pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PERIOD_PILLS.map(p => (
            <button
              key={p.key}
              onClick={() => setFiltro(p.key)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '20px',
                border: filtro === p.key ? 'none' : '1px solid var(--border-md)',
                background: filtro === p.key ? 'var(--sage-dark)' : 'transparent',
                color: filtro === p.key ? 'white' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid var(--border-md)',
            borderRadius: '8px',
            padding: '4px 8px',
            background: 'var(--bg)',
          }}
        >
          <input
            type="date"
            value={customStart}
            onChange={e => { setCustomStart(e.target.value); setFiltro('custom'); }}
            style={{ border: 'none', background: 'transparent', fontSize: '12px', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>–</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => { setCustomEnd(e.target.value); setFiltro('custom'); }}
            style={{ border: 'none', background: 'transparent', fontSize: '12px', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        {/* Selects */}
        <select
          value={agendaFiltro}
          onChange={e => setAgendaFiltro(e.target.value)}
          style={{
            border: '1px solid var(--border-md)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '12px',
            color: 'var(--ink)',
            background: 'var(--bg)',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="todas">Todas as agendas</option>
          {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>

        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value)}
          style={{
            border: '1px solid var(--border-md)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '12px',
            color: 'var(--ink)',
            background: 'var(--bg)',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Atualizar button */}
        <button
          onClick={fetchAgendamentos}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--muted)',
            background: 'transparent',
            border: '1px solid var(--border-md)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'color 0.12s',
          }}
        >
          <RefreshCw style={{ width: '13px', height: '13px' }} />
          Atualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--muted)' }}>
          <div
            className="animate-spin"
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              border: '2px solid var(--border-md)',
              borderTopColor: 'var(--sage-dark)',
              marginRight: '10px',
            }}
          />
          Carregando...
        </div>
      ) : agendamentos.length === 0 ? (
        /* Empty state */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
          <CalendarIcon style={{ width: '48px', height: '48px', opacity: 0.2, color: 'var(--muted)' }} />
          <p
            className="font-display"
            style={{ fontSize: '18px', fontStyle: 'italic', color: 'var(--muted)', fontWeight: 300 }}
          >
            Nenhum agendamento no período
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Tente ajustar os filtros acima</p>
        </div>
      ) : (
        /* Grouped list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {grouped.map(group => (
            <div key={group.label}>
              {/* Date divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: 'var(--muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.label}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.items.map(ag => {
                  const stripeColor = ag.agendas?.cor || 'var(--sage)';
                  const statusStyle = STATUS_BADGE[ag.status] || { background: '#F1F5F9', color: '#64748B' };
                  const isOnline = ag.modalidade === 'online';

                  return (
                    <div
                      key={ag.id}
                      style={{
                        background: 'var(--white)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '14px 16px 14px 20px',
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      {/* Left stripe */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '3px',
                          background: stripeColor,
                        }}
                      />

                      {/* Date section */}
                      <div style={{ width: '44px', flexShrink: 0, textAlign: 'center' }}>
                        <div
                          className="font-display"
                          style={{ fontSize: '24px', fontWeight: 400, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}
                        >
                          {format(parseISO(ag.data_hora_inicio), 'dd')}
                        </div>
                        <div
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            color: 'var(--muted)',
                            marginTop: '2px',
                          }}
                        >
                          {format(parseISO(ag.data_hora_inicio), 'MMM', { locale: ptBR })}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--muted)',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px',
                          }}
                        >
                          <Clock style={{ width: '9px', height: '9px' }} />
                          {format(parseISO(ag.data_hora_inicio), 'HH:mm')}
                        </div>
                      </div>

                      {/* Vertical divider */}
                      <div style={{ width: '1px', height: '40px', background: 'var(--border)', flexShrink: 0 }} />

                      {/* Avatar */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--sage-xlight)',
                          color: 'var(--sage-dark)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(ag.nome_lead || ag.leads?.nome_lead)}
                      </div>

                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button
                          onClick={() => {
                            if (ag.leads) {
                              setSelectedLead(ag.leads);
                              setOpenLeadDetails(true);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: ag.leads ? 'pointer' : 'default',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--ink)',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                          }}
                        >
                          {ag.nome_lead || ag.leads?.nome_lead || 'Cliente não informado'}
                        </button>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '3px',
                          }}
                        >
                          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                            {ag.procedimento_nome || ag.leads?.procedimento_interesse || 'Procedimento não especificado'}
                          </span>
                          {ag.modalidade && (
                            <>
                              <span style={{ fontSize: '11px', color: 'var(--border-md)' }}>·</span>
                              <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>
                                {ag.modalidade}
                              </span>
                            </>
                          )}
                          {ag.agendas?.nome && (
                            <>
                              <span style={{ fontSize: '11px', color: 'var(--border-md)' }}>·</span>
                              <span style={{ fontSize: '11px', fontWeight: 500, color: ag.agendas.cor || 'var(--sage-dark)' }}>
                                {ag.agendas.nome}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {ag.modalidade && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '20px',
                              background: isOnline ? '#EFF6FF' : 'var(--sage-xlight)',
                              color: isOnline ? '#1D4ED8' : 'var(--sage-dark)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {ag.modalidade}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '20px',
                            background: statusStyle.background,
                            color: statusStyle.color,
                          }}
                        >
                          {STATUS_LABELS[ag.status] || ag.status}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            if (ag.leads) {
                              setSelectedLead(ag.leads);
                              setOpenLeadDetails(true);
                            }
                          }}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-md)',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--muted)',
                          }}
                          title="Ver perfil do lead"
                        >
                          <User style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button
                          onClick={() =>
                            navigate('/inbox', { state: { lead_id: ag.leads?.id } })
                          }
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--sage-dark)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                          }}
                          title="Abrir conversa no Inbox"
                        >
                          <MessageSquare style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <LeadDetailsModal
        isOpen={openLeadDetails}
        onClose={() => setOpenLeadDetails(false)}
        leadId={selectedLead?.id}
        onUpdate={fetchAgendamentos}
      />
    </div>
  );
}
