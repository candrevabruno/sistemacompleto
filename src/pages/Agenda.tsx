import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  format, parseISO, isSameDay, isSameMonth, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, addWeeks, addDays, eachDayOfInterval, getHours,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Loader2, X, Ban, Clock, AlertTriangle, Check, UserX, User, ListChecks, ArrowUp, Trash2, Video, Settings, Archive, RotateCcw, Crown, Sparkles } from 'lucide-react';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';
import { useClinic } from '../contexts/ClinicContext';

const DIAS_SEMANA: { key: string; label: string }[] = [
  { key: 'domingo', label: 'Domingo' }, { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' }, { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' }, { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sábado' },
];

type View = 'mes' | 'semana' | 'dia' | 'lista' | 'espera';

const HORA_INI = 7;
const HORA_FIM = 21; // exclusivo
const HORAS = Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => HORA_INI + i);
const CORES_PADRAO = ['#C47E7E', '#7E9CC4', '#7EC49C', '#C4B27E', '#A07EC4', '#C47EA8'];

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', compareceu: 'Compareceu',
  faltou: 'Faltou', cancelado: 'Cancelado', reagendado: 'Reagendado',
};

function dt(ag: any): Date { return parseISO(ag.data_hora_inicio); }
function isCancelado(ag: any) { return ag.status === 'cancelado' || ag.status === 'cancelou_agendamento'; }

// Bloqueios que tocam um dia inteiro (qualquer interseção com o dia).
function bloqueiosDoDia(bloqueios: any[], day: Date): any[] {
  const ini = new Date(day); ini.setHours(0, 0, 0, 0);
  const fim = new Date(day); fim.setHours(23, 59, 59, 999);
  return (bloqueios || []).filter(b => new Date(b.inicio) <= fim && new Date(b.fim) >= ini);
}
// Um bloqueio cobre o slot (dia + hora)?
function bloqueioCobreSlot(b: any, day: Date, hour: number): boolean {
  if (b.dia_inteiro) {
    const ini = new Date(day); ini.setHours(0, 0, 0, 0);
    const fim = new Date(day); fim.setHours(23, 59, 59, 999);
    return new Date(b.inicio) <= fim && new Date(b.fim) >= ini;
  }
  const slot = new Date(day); slot.setHours(hour, 0, 0, 0);
  return new Date(b.inicio).getTime() <= slot.getTime() && new Date(b.fim).getTime() > slot.getTime();
}

export function Agenda() {
  const { canEdit } = useAuth();
  const { config } = useClinic();
  const podeEditar = canEdit('modulo:agenda');
  const listaEsperaEnabled = Boolean(config?.lista_espera_enabled);
  const [showEsperaUpgrade, setShowEsperaUpgrade] = useState(false);

  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [profFiltro, setProfFiltro] = useState<string>('todas');
  const [agendas, setAgendas] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [bloqueios, setBloqueios] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLead, setOpenLead] = useState(false);
  const [selectedAg, setSelectedAg] = useState<any>(null);
  const [showNova, setShowNova] = useState(false);
  const [showDisp, setShowDisp] = useState(false);
  const [showBloqueio, setShowBloqueio] = useState(false);
  const [showNovoAg, setShowNovoAg] = useState(false);
  const [showGerenciar, setShowGerenciar] = useState(false);
  const [bloqDel, setBloqDel] = useState<any>(null);

  // Intervalo visível conforme a visão
  const range = useMemo(() => {
    if (view === 'dia') return { start: cursor, end: cursor };
    if (view === 'semana') return { start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) };
    // mês (e lista) → grade de semanas completas
    return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) };
  }, [view, cursor]);

  const loadAgendas = async () => {
    const { data } = await supabase.from('agendas').select('id, nome, cor, calcom_event_type_id, calcom_schedule_id').eq('ativo', true).order('nome');
    if (data) setAgendas(data);
  };

  const loadAgendamentos = async () => {
    setLoading(true);
    const start = new Date(range.start); start.setHours(0, 0, 0, 0);
    const end = new Date(range.end); end.setHours(23, 59, 59, 999);
    // Cancelados/reagendados saem do calendário na hora. compareceu/faltou continuam
    // visíveis enquanto a consulta não chegou (evita sumir por engano); só saem depois
    // que o horário passa — aí o histórico fica no perfil do paciente e nos KPIs.
    let q = supabase
      .from('agendamentos')
      .select('*, agendas(nome, cor), leads:lead_id(*)')
      .gte('data_hora_inicio', start.toISOString())
      .lte('data_hora_inicio', end.toISOString())
      .not('status', 'in', '("cancelado","cancelou_agendamento","reagendado")')
      .order('data_hora_inicio', { ascending: true });
    if (profFiltro !== 'todas') q = q.eq('agenda_id', profFiltro);
    const { data } = await q;
    const agora = Date.now();
    const visiveis = (data || []).filter(a => {
      const resolvido = a.status === 'compareceu' || a.status === 'faltou';
      // resolvido e já passou do horário → sai do calendário
      return !(resolvido && new Date(a.data_hora_inicio).getTime() < agora);
    });
    setAgendamentos(visiveis);

    // Bloqueios que tocam o intervalo visível.
    let qb = supabase
      .from('bloqueios')
      .select('*, agendas(nome, cor)')
      .lte('inicio', end.toISOString())
      .gte('fim', start.toISOString());
    if (profFiltro !== 'todas') qb = qb.eq('agenda_id', profFiltro);
    const { data: bloq } = await qb;
    setBloqueios(bloq || []);

    setLoading(false);
  };

  useEffect(() => { loadAgendas(); }, []);

  useEffect(() => {
    loadAgendamentos();
    // Realtime: reflete mudanças do agente/Cal.com
    const ch = supabase
      .channel('agenda-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => loadAgendamentos())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [range.start.getTime(), range.end.getTime(), profFiltro]);

  const abrirLead = (ag: any) => {
    if (!ag.leads) return;
    setSelectedLead(ag.leads);
    setOpenLead(true);
  };
  const abrirEvento = (ag: any) => setSelectedAg(ag);

  const navegar = (dir: -1 | 1) => {
    if (view === 'dia') setCursor(c => addDays(c, dir));
    else if (view === 'semana') setCursor(c => addWeeks(c, dir));
    else setCursor(c => addMonths(c, dir));
  };

  const tituloPeriodo = useMemo(() => {
    if (view === 'dia') return format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'semana') {
      const s = startOfWeek(cursor, { weekStartsOn: 0 });
      const e = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  }, [view, cursor]);

  // agendamentos de um dia (ordenados)
  const doDia = (day: Date) => agendamentos
    .filter(a => isSameDay(dt(a), day))
    .sort((a, b) => dt(a).getTime() - dt(b).getTime());

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg)', minHeight: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {/* Linha 1: título + navegação + seletor de visão */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)' }}>
            Agenda
          </div>

          {view !== 'espera' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => navegar(-1)} style={navBtn}><ChevronLeft size={16} /></button>
                <button onClick={() => setCursor(new Date())} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: '12px', fontWeight: 600 }}>Hoje</button>
                <button onClick={() => navegar(1)} style={navBtn}><ChevronRight size={16} /></button>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize', minWidth: '150px' }}>
                {tituloPeriodo}
              </div>
            </>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
            {([['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia'], ['lista', 'Lista']] as [View, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: view === v ? 'var(--sage-dark)' : 'transparent',
                  color: view === v ? 'white' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: filtro de profissional + ações */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <select
            value={profFiltro}
            onChange={e => setProfFiltro(e.target.value)}
            style={{ border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '7px 10px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <option value="todas">Todos os profissionais</option>
            {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>

          {podeEditar && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowNovoAg(true)} style={tbPrimary}><Plus size={14} /> Novo agendamento</button>
              <button onClick={() => setShowDisp(true)} style={tbGhost}><Clock size={14} /> Disponibilidade</button>
              <button onClick={() => setShowBloqueio(true)} style={{ ...tbGhost, color: 'var(--rose-text)' }}><Ban size={14} /> Bloquear</button>
              <button onClick={() => setShowNova(true)} style={tbPrimary}><Plus size={14} /> Nova agenda</button>
              <button
                onClick={() => listaEsperaEnabled ? setView('espera') : setShowEsperaUpgrade(true)}
                style={{ ...tbGhost, color: view === 'espera' ? 'var(--sage-dark)' : 'var(--ink)', background: view === 'espera' ? 'var(--sage-xlight)' : 'var(--white)', border: view === 'espera' ? '1px solid var(--sage)' : '1px solid var(--border-md)' }}
              >
                <ListChecks size={14} /> Lista de espera <Crown size={11} style={{ color: 'var(--champ-text)', marginLeft: '2px' }} />
              </button>
              <button onClick={() => setShowGerenciar(true)} title="Gerenciar agendas (arquivar / apagar)" style={tbGhost}><Settings size={14} /> Gerenciar</button>
            </div>
          )}
        </div>
      </div>

      {/* Legenda de cores dos profissionais */}
      {agendas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          {agendas.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--muted)' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: a.cor || 'var(--sage)' }} />
              {a.nome}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '8px', color: 'var(--muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <>
          {view === 'mes' && <VisaoMes cursor={cursor} range={range} doDia={doDia} onEvento={abrirEvento} onDia={(d: Date) => { setCursor(d); setView('dia'); }} bloqueios={bloqueios} onBloqueio={podeEditar ? setBloqDel : undefined} />}
          {view === 'semana' && <VisaoSemana range={range} doDia={doDia} onEvento={abrirEvento} bloqueios={bloqueios} onBloqueio={podeEditar ? setBloqDel : undefined} />}
          {view === 'dia' && <VisaoDia cursor={cursor} agendas={agendas} profFiltro={profFiltro} doDia={doDia} onEvento={abrirEvento} bloqueios={bloqueios} onBloqueio={podeEditar ? setBloqDel : undefined} />}
          {view === 'lista' && <VisaoLista range={range} agendamentos={agendamentos} onEvento={abrirEvento} />}
          {view === 'espera' && <VisaoEspera agendas={agendas} profFiltro={profFiltro} podeEditar={podeEditar} />}
        </>
      )}

      {selectedAg && (
        <AgendamentoModal
          ag={selectedAg}
          agendas={agendas}
          podeEditar={podeEditar}
          onClose={() => setSelectedAg(null)}
          onUpdated={() => { setSelectedAg(null); loadAgendamentos(); }}
          onVerPaciente={(ag: any) => { setSelectedAg(null); if (ag.leads) { setSelectedLead(ag.leads); setOpenLead(true); } }}
        />
      )}
      <LeadDetailsModal isOpen={openLead} onClose={() => setOpenLead(false)} leadId={selectedLead?.id} onUpdate={loadAgendamentos} />
      {showNova && <NovaAgendaModal coresUsadas={agendas.map(a => a.cor)} onClose={() => setShowNova(false)} onSaved={() => { setShowNova(false); loadAgendas(); }} />}
      {showDisp && <DisponibilidadeModal agendas={agendas} onClose={() => setShowDisp(false)} />}
      {showBloqueio && <BloqueioModal agendas={agendas} profPadrao={profFiltro !== 'todas' ? profFiltro : (agendas[0]?.id || '')} onClose={() => setShowBloqueio(false)} onSaved={() => { setShowBloqueio(false); loadAgendamentos(); }} />}
      {showNovoAg && <NovoAgendamentoModal agendas={agendas} profPadrao={profFiltro !== 'todas' ? profFiltro : (agendas[0]?.id || '')} dataPadrao={format(cursor, 'yyyy-MM-dd')} onClose={() => setShowNovoAg(false)} onSaved={() => { setShowNovoAg(false); loadAgendamentos(); }} />}
      {bloqDel && <DesbloquearModal bloqueio={bloqDel} onClose={() => setBloqDel(null)} onSaved={() => { setBloqDel(null); loadAgendamentos(); }} />}
      {showGerenciar && <GerenciarAgendasModal onClose={() => setShowGerenciar(false)} onChanged={() => { loadAgendas(); loadAgendamentos(); }} />}

      {showEsperaUpgrade && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }} onClick={() => setShowEsperaUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', maxWidth: '380px', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={22} style={{ color: 'var(--champ-text)' }} />
            </div>
            <div>
              <p className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', marginBottom: '6px' }}>Lista de Espera</p>
              <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '280px' }}>
                Gerencie pacientes aguardando vaga e ofereça automaticamente quando um horário cancelar.
                Recurso disponível mediante liberação da Heroic Leap.
              </p>
            </div>
            <a
              href={`https://wa.me/${config?.heroic_leap_whatsapp || '5511999999999'}?text=${encodeURIComponent('Olá! Gostaria de solicitar acesso à Lista de Espera no sistema da clínica.')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--sage-dark)', color: 'white', padding: '9px 18px', borderRadius: 'var(--r-xs)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}
            >
              <Sparkles size={14} /> Solicitar acesso
            </a>
            <button onClick={() => setShowEsperaUpgrade(false)} style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chip de evento ──────────────────────────────────────────────────────────
function Chip({ ag, onClick, compact }: { ag: any; onClick: () => void; compact?: boolean }) {
  const cor = ag.agendas?.cor || 'var(--sage)';
  const cancel = isCancelado(ag);
  return (
    <button
      onClick={onClick}
      title={`${format(dt(ag), 'HH:mm')} · ${ag.nome_lead || ag.leads?.nome_lead || 'Paciente'} · ${ag.agendas?.nome || ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px', width: '100%', textAlign: 'left',
        padding: compact ? '2px 5px' : '4px 7px', borderRadius: '5px', border: 'none', cursor: 'pointer',
        background: cancel ? 'transparent' : `${cor}22`, borderLeft: `3px solid ${cor}`,
        fontSize: compact ? '10.5px' : '11.5px', fontFamily: 'inherit', color: 'var(--ink)',
        opacity: cancel ? 0.5 : 1, textDecoration: cancel ? 'line-through' : 'none', marginBottom: '3px',
        overflow: 'hidden', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 600, color: cor, flexShrink: 0 }}>{format(dt(ag), 'HH:mm')}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ag.nome_lead || ag.leads?.nome_lead || 'Paciente'}</span>
    </button>
  );
}

// ── Visão Mês ───────────────────────────────────────────────────────────────
function VisaoMes({ cursor, range, doDia, onEvento, onDia, bloqueios, onBloqueio }: any) {
  const dias = eachDayOfInterval({ start: range.start, end: range.end });
  const semanas: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {labels.map(l => (
          <div key={l} style={{ padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)' }}>{l}</div>
        ))}
      </div>
      {semanas.map((semana, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {semana.map(day => {
            const eventos = doDia(day);
            const bloqs = bloqueiosDoDia(bloqueios || [], day);
            const foraMes = !isSameMonth(day, cursor);
            return (
              <div
                key={day.toISOString()}
                style={{ minHeight: '104px', padding: '5px 6px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: foraMes ? 'var(--bg)' : 'var(--white)', opacity: foraMes ? 0.55 : 1 }}
              >
                <button
                  onClick={() => onDia(day)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', marginBottom: '3px',
                    borderRadius: '50%', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                    background: isToday(day) ? 'var(--sage-dark)' : 'transparent', color: isToday(day) ? 'white' : 'var(--ink)',
                  }}
                >
                  {format(day, 'd')}
                </button>
                {bloqs.map((b: any) => (
                  <div
                    key={b.id}
                    title={onBloqueio ? 'Clique para desbloquear' : (b.motivo || 'Bloqueado')}
                    onClick={onBloqueio ? (e) => { e.stopPropagation(); onBloqueio(b); } : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--rose-text)', background: 'rgba(139,68,68,0.08)', borderRadius: '4px', padding: '1px 5px', marginBottom: '3px', overflow: 'hidden', whiteSpace: 'nowrap', cursor: onBloqueio ? 'pointer' : 'default' }}
                  >
                    <Ban size={9} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.dia_inteiro ? (b.motivo || 'Bloqueado') : `${format(parseISO(b.inicio), 'HH:mm')} ${b.motivo || 'bloqueado'}`}{b.agendas?.nome ? ` · ${b.agendas.nome}` : ''}</span>
                  </div>
                ))}
                {eventos.slice(0, 3).map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} compact />)}
                {eventos.length > 3 && (
                  <button onClick={() => onDia(day)} style={{ fontSize: '10px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0 5px' }}>
                    +{eventos.length - 3} mais
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Visão Semana ────────────────────────────────────────────────────────────
function VisaoSemana({ range, doDia, onEvento, bloqueios, onBloqueio }: any) {
  const dias = eachDayOfInterval({ start: range.start, end: range.end });
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Cabeçalho dos dias */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        <div />
        {dias.map((d: Date) => (
          <div key={d.toISOString()} style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' }}>{format(d, 'EEE', { locale: ptBR })}</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: isToday(d) ? 'var(--sage-dark)' : 'var(--ink)' }}>{format(d, 'd')}</div>
          </div>
        ))}
      </div>
      {/* Grade de horas */}
      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        {HORAS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: '46px' }}>
            <div style={{ padding: '4px 6px', fontSize: '10.5px', color: 'var(--muted)', textAlign: 'right' }}>{String(h).padStart(2, '0')}:00</div>
            {dias.map((d: Date) => {
              const eventos = doDia(d).filter((a: any) => getHours(dt(a)) === h);
              const bloq = (bloqueios || []).find((b: any) => bloqueioCobreSlot(b, d, h));
              return (
                <div key={d.toISOString()} style={{ borderLeft: '1px solid var(--border)', padding: '3px', background: bloq ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(139,68,68,0.08) 5px, rgba(139,68,68,0.08) 10px)' : 'transparent' }}>
                  {bloq && eventos.length === 0 && (
                    <div
                      title={onBloqueio ? 'Clique para desbloquear' : (bloq.motivo || 'Bloqueado')}
                      onClick={onBloqueio ? () => onBloqueio(bloq) : undefined}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--rose-text)', opacity: 0.7, cursor: onBloqueio ? 'pointer' : 'default' }}
                    ><Ban size={11} /></div>
                  )}
                  {eventos.map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} compact />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visão Dia ───────────────────────────────────────────────────────────────
// Com 'todas', uma coluna por profissional (agendas isoladas). Senão, coluna única.
function VisaoDia({ cursor, agendas, profFiltro, doDia, onEvento, bloqueios, onBloqueio }: any) {
  const colunas = profFiltro === 'todas' ? agendas : agendas.filter((a: any) => a.id === profFiltro);
  const eventos = doDia(cursor);
  const cols = colunas.length > 0 ? colunas : [{ id: '__none__', nome: 'Sem profissional', cor: 'var(--sage)' }];

  // Bloqueio cobre a hora h da coluna c no dia cursor?
  const blocked = (agendaId: string, h: number): any | null => {
    const slot = new Date(cursor); slot.setHours(h, 0, 0, 0);
    const slotMs = slot.getTime();
    const diaIni = new Date(cursor); diaIni.setHours(0, 0, 0, 0);
    const diaFim = new Date(cursor); diaFim.setHours(23, 59, 59, 999);
    return (bloqueios || []).find((b: any) => {
      if (b.agenda_id !== agendaId) return false;
      if (b.dia_inteiro) return new Date(b.inicio) <= diaFim && new Date(b.fim) >= diaIni;
      return new Date(b.inicio).getTime() <= slotMs && new Date(b.fim).getTime() > slotMs;
    }) || null;
  };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${cols.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
        <div />
        {cols.map((c: any) => (
          <div key={c.id} style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: c.cor || 'var(--sage)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{c.nome}</span>
          </div>
        ))}
      </div>
      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        {HORAS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${cols.length}, 1fr)`, borderBottom: '1px solid var(--border)', minHeight: '50px' }}>
            <div style={{ padding: '4px 6px', fontSize: '10.5px', color: 'var(--muted)', textAlign: 'right' }}>{String(h).padStart(2, '0')}:00</div>
            {cols.map((c: any) => {
              const evs = eventos.filter((a: any) => getHours(dt(a)) === h && (c.id === '__none__' ? true : a.agenda_id === c.id));
              const bloq = c.id === '__none__' ? null : blocked(c.id, h);
              return (
                <div key={c.id} style={{ borderLeft: '1px solid var(--border)', padding: '3px', position: 'relative', background: bloq ? 'repeating-linear-gradient(45deg, var(--bg), var(--bg) 6px, rgba(139,68,68,0.07) 6px, rgba(139,68,68,0.07) 12px)' : 'transparent' }}>
                  {bloq && evs.length === 0 && (
                    <div
                      title={onBloqueio ? 'Clique para desbloquear' : (bloq.motivo || 'Bloqueado')}
                      onClick={onBloqueio ? () => onBloqueio(bloq) : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--rose-text)', padding: '4px 5px', cursor: onBloqueio ? 'pointer' : 'default' }}
                    >
                      <Ban size={10} /> {bloq.motivo || 'Bloqueado'}
                    </div>
                  )}
                  {evs.map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visão Lista ─────────────────────────────────────────────────────────────
function VisaoLista({ agendamentos, onEvento }: any) {
  if (!agendamentos.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px', gap: '10px' }}>
        <CalendarDays size={40} style={{ opacity: 0.2, color: 'var(--muted)' }} />
        <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--muted)' }}>Nenhum agendamento no período</p>
      </div>
    );
  }
  const grupos: { label: string; date: Date; items: any[] }[] = [];
  agendamentos.forEach((ag: any) => {
    const d = dt(ag);
    const g = grupos.find(x => isSameDay(x.date, d));
    if (g) g.items.push(ag);
    else grupos.push({ label: format(d, "EEEE, dd 'de' MMMM", { locale: ptBR }), date: d, items: [ag] });
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {grupos.map(g => (
        <div key={g.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>{g.label}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {g.items.map((ag: any) => {
              const cor = ag.agendas?.cor || 'var(--sage)';
              return (
                <button key={ag.id} onClick={() => onEvento(ag)} style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', borderLeft: `3px solid ${cor}`, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cor, width: '46px' }}>{format(dt(ag), 'HH:mm')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{ag.nome_lead || ag.leads?.nome_lead || 'Paciente'}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      {ag.procedimento_nome || ag.leads?.procedimento_interesse || '—'}{ag.agendas?.nome ? ` · ${ag.agendas.nome}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: isCancelado(ag) ? 'var(--rose-light)' : 'var(--sage-xlight)', color: isCancelado(ag) ? 'var(--rose-text)' : 'var(--sage-dark)' }}>
                    {STATUS_LABEL[ag.status] || ag.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal Nova Agenda (novo profissional) ───────────────────────────────────
function NovaAgendaModal({ coresUsadas, onClose, onSaved }: { coresUsadas: string[]; onClose: () => void; onSaved: () => void }) {
  const proxCor = CORES_PADRAO.find(c => !coresUsadas.includes(c)) || CORES_PADRAO[0];
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(proxCor);
  const [criarNoCalcom, setCriarNoCalcom] = useState(true);
  const [duracao, setDuracao] = useState(60);
  const [local, setLocal] = useState<'google-meet' | 'cal-video' | 'presencial' | 'nenhum'>('google-meet');
  const [calcomEventTypeId, setCalcomEventTypeId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const slugify = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      || 'agenda';

  const salvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    let eventTypeId: string | null = calcomEventTypeId || null;

    // Cria o event-type no Cal.com automaticamente (se marcado e sem ID manual).
    if (criarNoCalcom && !calcomEventTypeId) {
      const slug = `${slugify(nome)}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const { data: r, error: cErr } = await supabase.functions.invoke('cal-sync', {
          body: { action: 'create-event-type', title: nome.trim(), slug, lengthInMinutes: duracao, location: local === 'nenhum' ? undefined : local },
        });
        if (cErr || r?.error) {
          let detalhe = r?.error || cErr?.message || '';
          try { const body = await (cErr as any)?.context?.json?.(); if (body?.error) detalhe = body.error; } catch { /* ignore */ }
          setSalvando(false);
          alert('Não consegui criar o event-type no Cal.com: ' + detalhe + '\n\nA agenda não foi criada. Verifique a API key do Cal.com e tente de novo.');
          return;
        }
        const evt = r?.calcom?.data || r?.calcom;
        eventTypeId = evt?.id ? String(evt.id) : null;
      } catch (e: any) {
        setSalvando(false);
        alert('Não consegui criar o event-type no Cal.com: ' + (e?.message || ''));
        return;
      }
    }

    const { error } = await supabase.from('agendas').insert({ nome: nome.trim(), cor, calcom_event_type_id: eventTypeId, ativo: true });
    setSalvando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }} onClick={() => !salvando && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', maxWidth: '420px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-cormorant" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Nova agenda (profissional)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Nome do profissional</label>
            <input value={nome} onChange={e => setNome(e.target.value)} style={inp} placeholder="Dra. Maria" />
          </div>
          <div>
            <label style={lbl}>Cor</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CORES_PADRAO.map(c => (
                <button key={c} onClick={() => setCor(c)} style={{ width: '28px', height: '28px', borderRadius: '7px', background: c, border: cor === c ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={criarNoCalcom} onChange={e => setCriarNoCalcom(e.target.checked)} />
            Criar o tipo de evento no Cal.com automaticamente
          </label>

          {criarNoCalcom && !calcomEventTypeId ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Duração</label>
                <select value={duracao} onChange={e => setDuracao(Number(e.target.value))} style={inp}>
                  {[15, 20, 30, 40, 45, 50, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Local</label>
                <select value={local} onChange={e => setLocal(e.target.value as any)} style={inp}>
                  <option value="google-meet">Google Meet (online)</option>
                  <option value="cal-video">Cal Video (online)</option>
                  <option value="presencial">Presencial</option>
                  <option value="nenhum">Definir depois</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label style={lbl}>ID do Event-type no Cal.com (já existente)</label>
              <input value={calcomEventTypeId} onChange={e => setCalcomEventTypeId(e.target.value)} style={inp} placeholder="Ex: 123456" />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || !nome.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--sage-dark)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', opacity: salvando || !nome.trim() ? 0.6 : 1 }}>
            {salvando && <Loader2 size={13} className="animate-spin" />} Criar agenda
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Disponibilidade (agenda_hours por profissional) ────────────────────
const DIA_CALCOM: Record<string, string> = {
  domingo: 'Sunday', segunda: 'Monday', terca: 'Tuesday', quarta: 'Wednesday',
  quinta: 'Thursday', sexta: 'Friday', sabado: 'Saturday',
};

function DisponibilidadeModal({ agendas, onClose }: { agendas: any[]; onClose: () => void }) {
  const [agendaId, setAgendaId] = useState<string>(agendas[0]?.id || '');
  const [horas, setHoras] = useState<Record<string, { aberto: boolean; ini: string; fim: string }>>({});
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = async (id: string) => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from('agenda_hours').select('*').eq('agenda_id', id);
    const map: Record<string, { aberto: boolean; ini: string; fim: string }> = {};
    DIAS_SEMANA.forEach(d => {
      const row = (data || []).find((r: any) => r.dia === d.key);
      const util = d.key !== 'domingo' && d.key !== 'sabado';
      map[d.key] = row
        ? { aberto: row.aberto, ini: (row.hora_inicio || '08:00').slice(0, 5), fim: (row.hora_fim || '18:00').slice(0, 5) }
        : { aberto: util, ini: '08:00', fim: '18:00' };
    });
    setHoras(map);
    setLoading(false);
  };
  useEffect(() => { carregar(agendaId); }, [agendaId]);

  const salvar = async () => {
    if (!agendaId) return;
    setSalvando(true); setAviso(null);
    await supabase.from('agenda_hours').delete().eq('agenda_id', agendaId);
    const rows = DIAS_SEMANA.map(d => ({
      agenda_id: agendaId, dia: d.key, aberto: horas[d.key]?.aberto ?? false,
      hora_inicio: horas[d.key]?.ini || null, hora_fim: horas[d.key]?.fim || null,
    }));
    await supabase.from('agenda_hours').insert(rows);

    // Reflete a disponibilidade no Cal.com (schedule do profissional). Best-effort.
    const ag = agendas.find((a: any) => a.id === agendaId);
    const availability = DIAS_SEMANA
      .filter(d => horas[d.key]?.aberto && horas[d.key]?.ini && horas[d.key]?.fim)
      .map(d => ({ days: [DIA_CALCOM[d.key]], startTime: horas[d.key].ini, endTime: horas[d.key].fim }));
    if (availability.length === 0) {
      setAviso('Salvo no sistema. Marque ao menos um dia para refletir no Cal.com.');
    } else {
      try {
        const { data: r, error: cErr } = await supabase.functions.invoke('cal-sync', {
          body: { action: 'set-availability', scheduleId: ag?.calcom_schedule_id || undefined, timeZone: 'America/Sao_Paulo', availability },
        });
        if (cErr || r?.error) {
          let detalhe = r?.error || cErr?.message || '';
          try { const body = await (cErr as any)?.context?.json?.(); if (body?.error) detalhe = body.error; } catch { /* ignore */ }
          setAviso('Salvo no sistema, mas não refletiu no Cal.com: ' + detalhe);
        } else if (r?.scheduleId && r.scheduleId !== ag?.calcom_schedule_id) {
          await supabase.from('agendas').update({ calcom_schedule_id: String(r.scheduleId) }).eq('id', agendaId);
        }
      } catch (e: any) {
        setAviso('Salvo no sistema, mas não refletiu no Cal.com: ' + (e?.message || ''));
      }
    }
    setSalvando(false); setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const upd = (dia: string, patch: Partial<{ aberto: boolean; ini: string; fim: string }>) =>
    setHoras(prev => ({ ...prev, [dia]: { ...prev[dia], ...patch } }));

  return (
    <div style={modalOverlay} onClick={() => !salvando && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '480px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Disponibilidade semanal</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {aviso && <p style={{ fontSize: '12px', color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px', lineHeight: 1.5 }}>{aviso}</p>}
        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Profissional</label>
          <select value={agendaId} onChange={e => setAgendaId(e.target.value)} style={inp}>
            {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={16} className="animate-spin" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DIAS_SEMANA.map(d => {
              const h = horas[d.key] || { aberto: false, ini: '08:00', fim: '18:00' };
              return (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px', fontSize: '12.5px', color: 'var(--ink)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={h.aberto} onChange={e => upd(d.key, { aberto: e.target.checked })} />
                    {d.label}
                  </label>
                  <input type="time" value={h.ini} disabled={!h.aberto} onChange={e => upd(d.key, { ini: e.target.value })} style={{ ...inp, width: '110px', opacity: h.aberto ? 1 : 0.4 }} />
                  <span style={{ color: 'var(--muted)' }}>–</span>
                  <input type="time" value={h.fim} disabled={!h.aberto} onChange={e => upd(d.key, { fim: e.target.value })} style={{ ...inp, width: '110px', opacity: h.aberto ? 1 : 0.4 }} />
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={btnGhost}>Fechar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1, background: saved ? 'rgba(16,185,129,0.85)' : 'var(--sage-dark)' }}>
            {salvando && <Loader2 size={13} className="animate-spin" />} {saved ? 'Salvo!' : 'Salvar disponibilidade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Bloqueio (horário / dia / período) + aviso de consultas afetadas ───
function BloqueioModal({ agendas, profPadrao, onClose, onSaved }: { agendas: any[]; profPadrao: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [agendaId, setAgendaId] = useState(profPadrao || agendas[0]?.id || '');
  const [tipo, setTipo] = useState<'horario' | 'dia' | 'periodo'>('horario');
  const [data, setData] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horaIni, setHoraIni] = useState('08:00');
  const [horaFim, setHoraFim] = useState('09:00');
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [afetados, setAfetados] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const calcIntervalo = (): { inicio: Date; fim: Date; diaInteiro: boolean } | null => {
    if (!data) return null;
    if (tipo === 'horario') {
      return { inicio: new Date(`${data}T${horaIni}:00`), fim: new Date(`${data}T${horaFim}:00`), diaInteiro: false };
    }
    if (tipo === 'dia') {
      return { inicio: new Date(`${data}T00:00:00`), fim: new Date(`${data}T23:59:59`), diaInteiro: true };
    }
    const fimD = dataFim || data;
    return { inicio: new Date(`${data}T00:00:00`), fim: new Date(`${fimD}T23:59:59`), diaInteiro: true };
  };

  const continuar = async () => {
    setErro(null);
    const iv = calcIntervalo();
    if (!agendaId || !iv) { setErro('Preencha o profissional e a(s) data(s).'); return; }
    if (iv.fim <= iv.inicio) { setErro('O fim deve ser depois do início.'); return; }
    setBusy(true);
    const { data: afet } = await supabase
      .from('agendamentos')
      .select('id, lead_id, nome_lead, data_hora_inicio, leads:lead_id(nome_lead, whatsapp_lead)')
      .eq('agenda_id', agendaId)
      .not('status', 'in', '("cancelado","cancelou_agendamento","faltou")')
      .gte('data_hora_inicio', iv.inicio.toISOString())
      .lte('data_hora_inicio', iv.fim.toISOString());
    setAfetados(afet || []);
    setBusy(false);
    setStep(2);
  };

  const confirmar = async (notificar: boolean) => {
    const iv = calcIntervalo();
    if (!iv) return;
    setBusy(true);
    const { data: novoBloq, error: bErr } = await supabase.from('bloqueios').insert({
      agenda_id: agendaId, inicio: iv.inicio.toISOString(), fim: iv.fim.toISOString(),
      dia_inteiro: iv.diaInteiro, motivo: motivo || null, created_by: user?.id || null,
    }).select('id').single();
    if (bErr) { setErro('Erro ao bloquear: ' + bErr.message); setBusy(false); return; }

    // Reflete o bloqueio no Cal.com. Best-effort.
    //  - Dia inteiro / período → Out-of-Office (Ausência).
    //  - Horário específico → reserva(s)-bloqueio no event-type (OOO só cobre dia inteiro).
    let avisoCalcom: string | null = null;
    const ag = agendas.find((a: any) => a.id === agendaId);
    try {
      if (iv.diaInteiro) {
        const { data: r, error: cErr } = await supabase.functions.invoke('cal-sync', { body: { action: 'block', start: iv.inicio.toISOString(), end: iv.fim.toISOString(), reason: motivo || 'Bloqueado pela clínica' } });
        if (cErr || r?.error) {
          let detalhe = r?.error || cErr?.message || '';
          try { const body = await (cErr as any)?.context?.json?.(); if (body?.error) detalhe = body.error; } catch { /* ignore */ }
          avisoCalcom = detalhe;
        } else {
          const oooId = r?.calcom?.data?.id ?? r?.calcom?.id ?? null;
          if (oooId && novoBloq?.id) await supabase.from('bloqueios').update({ calcom_ooo_id: String(oooId) }).eq('id', novoBloq.id);
        }
      } else if (!ag?.calcom_event_type_id) {
        avisoCalcom = 'Este profissional não tem "ID do Event-type" do Cal.com, então o bloqueio por horário valeu só no sistema.';
      } else {
        const { data: r, error: cErr } = await supabase.functions.invoke('cal-sync', { body: { action: 'block-slot', eventTypeId: ag.calcom_event_type_id, start: iv.inicio.toISOString(), end: iv.fim.toISOString(), timeZone: 'America/Sao_Paulo' } });
        let detalhe = '';
        if (cErr || r?.error) {
          detalhe = r?.error || cErr?.message || '';
          try { const body = await (cErr as any)?.context?.json?.(); if (body?.error) detalhe = body.error; } catch { /* ignore */ }
        }
        const uids: string[] = r?.uids || [];
        if (uids.length && novoBloq?.id) await supabase.from('bloqueios').update({ calcom_booking_uids: uids }).eq('id', novoBloq.id);
        if (detalhe && uids.length === 0) {
          avisoCalcom = /minimum booking notice|too soon|scheduling window|too far/i.test(detalhe)
            ? 'esse horário viola as regras do event-type no Cal.com (antecedência mínima ou janela de disponibilidade). Ajuste em Cal.com → Tipos de Eventos → Limites, ou bloqueie um horário mais à frente.'
            : detalhe;
        }
      }
    } catch (e: any) { avisoCalcom = e?.message || String(e); }

    if (notificar && afetados.length > 0) {
      // Handoff ao agente: uma tarefa por consulta afetada (o agente conduz o WhatsApp).
      const eventos = afetados.map(a => ({
        tipo: 'reagendar_por_bloqueio',
        agendamento_id: a.id, lead_id: a.lead_id, agenda_id: agendaId,
        payload: {
          motivo: motivo || null,
          bloqueio_inicio: iv.inicio.toISOString(), bloqueio_fim: iv.fim.toISOString(),
          consulta_em: a.data_hora_inicio,
          paciente: a.leads?.nome_lead || a.nome_lead, whatsapp: a.leads?.whatsapp_lead || null,
        },
      }));
      await supabase.from('agente_eventos').insert(eventos);
    }
    if (user) {
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'agenda_bloqueada',
        record_id: agendaId,
        detalhes: { tipo, inicio: iv.inicio.toISOString(), fim: iv.fim.toISOString(), afetados: afetados.length, notificou: notificar, motivo },
      });
    }
    setBusy(false);
    if (avisoCalcom) {
      alert('Bloqueado no sistema, mas NÃO refletiu no Cal.com:\n\n' + avisoCalcom + '\n\nDica: confirme se o cal-sync foi atualizado (supabase functions deploy cal-sync --use-api).');
    }
    onSaved();
  };

  return (
    <div style={modalOverlay} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '460px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Bloquear horário</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={lbl}>Profissional</label>
              <select value={agendaId} onChange={e => setAgendaId(e.target.value)} style={inp}>
                {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo de bloqueio</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([['horario', 'Horário'], ['dia', 'Dia inteiro'], ['periodo', 'Período (férias)']] as [any, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setTipo(v)} style={{ flex: 1, padding: '7px', fontSize: '11.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tipo === v ? 'var(--sage)' : 'var(--border-md)'}`, background: tipo === v ? 'var(--sage-xlight)' : 'transparent', color: tipo === v ? 'var(--sage-dark)' : 'var(--muted)' }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{tipo === 'periodo' ? 'Data início' : 'Data'}</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
              </div>
              {tipo === 'periodo' && (
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Data fim</label>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inp} />
                </div>
              )}
            </div>
            {tipo === 'horario' && (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Das</label><input type="time" value={horaIni} onChange={e => setHoraIni(e.target.value)} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Até</label><input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} style={inp} /></div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '8px 10px' }}>
                  ℹ️ O bloqueio por horário vira uma <strong>reserva-bloqueio</strong> no Cal.com (trava só essa faixa). Por isso o Cal.com aplica a <strong>antecedência mínima</strong> do event-type: bloquear um horário <strong>muito em cima da hora</strong> pode ser recusado — nesse caso o bloqueio vale só no sistema. Para travar o <strong>dia todo</strong>, use "Dia inteiro".
                </p>
              </>
            )}
            <div>
              <label style={lbl}>Motivo (opcional)</label>
              <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Férias, congresso..." style={inp} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button onClick={onClose} style={btnGhost}>Cancelar</button>
              <button onClick={continuar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy && <Loader2 size={13} className="animate-spin" />} Continuar</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flexShrink: 0, padding: '8px', borderRadius: '50%', background: afetados.length ? 'var(--champ-light)' : 'var(--sage-xlight)', color: afetados.length ? 'var(--champ-text)' : 'var(--sage-dark)' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>
                  {afetados.length === 0 ? 'Nenhuma consulta no período' : `${afetados.length} consulta${afetados.length > 1 ? 's' : ''} ser${afetados.length > 1 ? 'ão' : 'á'} afetada${afetados.length > 1 ? 's' : ''}`}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  {afetados.length === 0
                    ? 'Pode bloquear sem impacto em pacientes.'
                    : 'Você pode só bloquear (sem avisar) ou pedir ao agente para notificar os pacientes via WhatsApp e conduzir o reagendamento.'}
                </p>
              </div>
            </div>
            {afetados.length > 0 && (
              <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', marginBottom: '14px' }}>
                {afetados.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--ink)' }}>{a.leads?.nome_lead || a.nome_lead || 'Paciente'}</span>
                    <span style={{ color: 'var(--muted)' }}>{format(parseISO(a.data_hora_inicio), "dd/MM HH:mm")}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button onClick={() => setStep(1)} disabled={busy} style={btnGhost}>Voltar</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => confirmar(false)} disabled={busy} style={{ ...btnGhost, color: 'var(--ink)' }}>{busy && <Loader2 size={12} className="animate-spin" />} Só bloquear</button>
                {afetados.length > 0 && (
                  <button onClick={() => confirmar(true)} disabled={busy} style={{ ...btnPrimary }}>{busy && <Loader2 size={12} className="animate-spin" />} Bloquear e notificar</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Desbloquear ────────────────────────────────────────────────────────
function DesbloquearModal({ bloqueio, onClose, onSaved }: { bloqueio: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const quando = bloqueio.dia_inteiro
    ? `${format(parseISO(bloqueio.inicio), "dd/MM/yyyy")}${bloqueio.fim && !isSameDay(parseISO(bloqueio.inicio), parseISO(bloqueio.fim)) ? ` – ${format(parseISO(bloqueio.fim), 'dd/MM/yyyy')}` : ''}`
    : `${format(parseISO(bloqueio.inicio), "dd/MM/yyyy HH:mm")} – ${format(parseISO(bloqueio.fim), 'HH:mm')}`;

  const desbloquear = async () => {
    setBusy(true); setErro(null);
    // Desfaz no Cal.com (best-effort): OOO (dia/período) ou reserva(s)-bloqueio (horário).
    if (bloqueio.calcom_ooo_id) {
      try { await supabase.functions.invoke('cal-sync', { body: { action: 'unblock', ooo_id: bloqueio.calcom_ooo_id } }); }
      catch (e) { console.error('cal-sync unblock falhou:', e); }
    }
    if (Array.isArray(bloqueio.calcom_booking_uids)) {
      for (const uid of bloqueio.calcom_booking_uids) {
        try { await supabase.functions.invoke('cal-sync', { body: { action: 'cancel', calcom_uid: uid, reason: 'Desbloqueado pela clínica' } }); }
        catch (e) { console.error('cal-sync cancel (desbloqueio) falhou:', e); }
      }
    }
    const { error } = await supabase.from('bloqueios').delete().eq('id', bloqueio.id);
    if (error) { setErro('Erro ao desbloquear: ' + error.message); setBusy(false); return; }
    if (user) {
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'agenda_desbloqueada', record_id: bloqueio.agenda_id,
        detalhes: { inicio: bloqueio.inicio, fim: bloqueio.fim, motivo: bloqueio.motivo || null },
      });
    }
    setBusy(false);
    onSaved();
  };

  return (
    <div style={modalOverlay} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '400px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Desbloquear</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}
        <p style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
          Remover este bloqueio? O horário volta a ficar disponível para agendamentos{bloqueio.calcom_ooo_id ? ' (no sistema e no Cal.com)' : ''}.
        </p>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 12px', margin: '12px 0', fontSize: '12.5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rose-text)', fontWeight: 600 }}><Ban size={12} /> {bloqueio.motivo || 'Bloqueado'}</div>
          <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{quando}{bloqueio.agendas?.nome ? ` · ${bloqueio.agendas.nome}` : ''}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={busy} style={btnGhost}>Cancelar</button>
          <button onClick={desbloquear} disabled={busy} style={{ ...btnPrimary, background: 'var(--rose-text)' }}>{busy && <Loader2 size={13} className="animate-spin" />} Desbloquear</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Gerenciar Agendas (arquivar / reativar / apagar) ───────────────────
function GerenciarAgendasModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [agendas, setAgendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [qtdVinc, setQtdVinc] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('agendas').select('*').order('ativo', { ascending: false }).order('nome');
    setAgendas(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleAtivo = async (ag: any) => {
    setBusyId(ag.id); setErro(null);
    const { error } = await supabase.from('agendas').update({ ativo: !ag.ativo }).eq('id', ag.id);
    if (error) setErro('Erro: ' + error.message);
    if (user) await supabase.from('audit_log').insert({ user_id: user.id, action: ag.ativo ? 'agenda_arquivada' : 'agenda_reativada', record_id: ag.id, detalhes: { nome: ag.nome } });
    setBusyId(null);
    await load(); onChanged();
  };

  const pedirApagar = async (ag: any) => {
    setErro(null);
    const { count } = await supabase.from('agendamentos').select('id', { count: 'exact', head: true }).eq('agenda_id', ag.id);
    setQtdVinc(count || 0);
    setConfirmDel(ag);
  };

  const apagar = async () => {
    if (!confirmDel) return;
    setBusyId(confirmDel.id); setErro(null);
    // Remove o event-type no Cal.com (se houver). Best-effort.
    if (confirmDel.calcom_event_type_id) {
      try { await supabase.functions.invoke('cal-sync', { body: { action: 'delete-event-type', eventTypeId: confirmDel.calcom_event_type_id } }); }
      catch (e) { console.error('cal-sync delete-event-type falhou:', e); }
    }
    const { error } = await supabase.rpc('apagar_agenda_completa', { p_agenda_id: confirmDel.id });
    if (error) { setErro('Erro ao apagar: ' + error.message); setBusyId(null); return; }
    if (user) await supabase.from('audit_log').insert({ user_id: user.id, action: 'agenda_apagada', record_id: confirmDel.id, detalhes: { nome: confirmDel.nome, agendamentos: qtdVinc } });
    setBusyId(null); setConfirmDel(null);
    await load(); onChanged();
  };

  return (
    <div style={modalOverlay} onClick={() => !busyId && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '460px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Gerenciar agendas</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}

        {confirmDel ? (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flexShrink: 0, width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--rose-light)', color: 'var(--rose-text)' }}><AlertTriangle size={18} /></div>
              <div>
                <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>Apagar "{confirmDel.nome}" definitivamente?</p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  {qtdVinc > 0
                    ? `Esta agenda tem ${qtdVinc} agendamento${qtdVinc > 1 ? 's' : ''} vinculado${qtdVinc > 1 ? 's' : ''} (incluindo histórico/KPIs), que também ${qtdVinc > 1 ? 'serão apagados' : 'será apagado'}. Esta ação é irreversível.`
                    : 'Esta ação é irreversível. Se quiser apenas tirar da agenda sem perder histórico, use Arquivar.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setConfirmDel(null)} disabled={!!busyId} style={btnGhost}>Cancelar</button>
              <button onClick={apagar} disabled={!!busyId} style={{ ...btnPrimary, background: 'var(--rose-text)' }}>{busyId && <Loader2 size={13} className="animate-spin" />} Apagar definitivamente</button>
            </div>
          </div>
        ) : loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : agendas.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>Nenhuma agenda cadastrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agendas.map(ag => (
              <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', opacity: ag.ativo ? 1 : 0.6 }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: ag.cor || 'var(--sage)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{ag.nome}</div>
                  {!ag.ativo && <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Arquivada</div>}
                </div>
                <button onClick={() => toggleAtivo(ag)} disabled={busyId === ag.id} title={ag.ativo ? 'Arquivar' : 'Reativar'} style={miniBtn}>
                  {busyId === ag.id ? <Loader2 size={13} className="animate-spin" /> : ag.ativo ? <Archive size={14} /> : <RotateCcw size={14} />}
                </button>
                <button onClick={() => pedirApagar(ag)} disabled={busyId === ag.id} title="Apagar definitivamente" style={{ ...miniBtn, color: 'var(--rose-text)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Archive size={12} style={{ flexShrink: 0 }} /> <span>Arquivar tira a agenda da visão sem perder o histórico (reversível).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Trash2 size={12} style={{ flexShrink: 0 }} /> <span>Apagar remove tudo definitivamente (e o event-type no Cal.com).</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Visão Lista de Espera ────────────────────────────────────────────────────
function VisaoEspera({ agendas, profFiltro, podeEditar }: { agendas: any[]; profFiltro: string; podeEditar: boolean }) {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('lista_espera')
      .select('*, agendas(nome, cor)')
      .in('status', ['aguardando', 'oferecido'])
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: true });
    if (profFiltro !== 'todas') q = q.or(`agenda_id.eq.${profFiltro},agenda_id.is.null`);
    const { data } = await q;
    setItens(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profFiltro]);

  const subir = async (it: any) => {
    await supabase.from('lista_espera').update({ prioridade: (it.prioridade || 0) + 1, updated_at: new Date().toISOString() }).eq('id', it.id);
    load();
  };
  const remover = async (it: any) => {
    await supabase.from('lista_espera').delete().eq('id', it.id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {itens.length} paciente{itens.length !== 1 ? 's' : ''} aguardando vaga. Quando um horário é liberado, o agente oferece ao próximo da fila.
        </p>
        {podeEditar && (
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={14} /> Adicionar à lista
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /></div>
      ) : itens.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px', gap: '10px' }}>
          <ListChecks size={40} style={{ opacity: 0.2, color: 'var(--muted)' }} />
          <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--muted)' }}>Lista de espera vazia</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {itens.map((it, idx) => {
            const cor = it.agendas?.cor || 'var(--border-md)';
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', borderLeft: `3px solid ${cor}`, padding: '12px 14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', width: '24px', textAlign: 'center' }}>{idx + 1}º</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{it.nome}{it.whatsapp ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {it.whatsapp}</span> : ''}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    {it.procedimento || '—'}{it.agendas?.nome ? ` · ${it.agendas.nome}` : ' · Qualquer profissional'}{it.preferencias ? ` · ${it.preferencias}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: it.status === 'oferecido' ? 'var(--sage-xlight)' : 'var(--champ-light)', color: it.status === 'oferecido' ? 'var(--sage-dark)' : 'var(--champ-text)' }}>
                  {it.status === 'oferecido' ? 'Oferecido' : 'Aguardando'}
                </span>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => subir(it)} title="Subir prioridade" style={miniBtn}><ArrowUp size={13} /></button>
                    <button onClick={() => remover(it)} title="Remover da lista" style={{ ...miniBtn, color: 'var(--rose-text)' }}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddEsperaModal agendas={agendas} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

// ── Modal Adicionar à lista de espera ────────────────────────────────────────
function AddEsperaModal({ agendas, onClose, onSaved }: { agendas: any[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [mostrarSug, setMostrarSug] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [agendaId, setAgendaId] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [preferencias, setPreferencias] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = async (q: string) => {
    setBusca(q); setLeadId(null);
    if (q.trim().length < 2) { setSugestoes([]); return; }
    const { data } = await supabase.from('leads').select('id, nome_lead, whatsapp_lead').or(`nome_lead.ilike.%${q}%,whatsapp_lead.ilike.%${q}%`).limit(6);
    setSugestoes(data || []); setMostrarSug(true);
  };
  const selecionar = (l: any) => { setLeadId(l.id); setNome(l.nome_lead || ''); setWhatsapp(l.whatsapp_lead || ''); setBusca(l.nome_lead || ''); setSugestoes([]); setMostrarSug(false); };

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) { setErro('Informe o nome do paciente.'); return; }
    setBusy(true);
    const { error } = await supabase.from('lista_espera').insert({
      lead_id: leadId, nome: nome.trim(), whatsapp: whatsapp || null,
      agenda_id: agendaId || null, procedimento: procedimento || null,
      preferencias: preferencias || null, status: 'aguardando', created_by: user?.id || null,
    });
    setBusy(false);
    if (error) { setErro('Erro: ' + error.message); return; }
    onSaved();
  };

  return (
    <div style={modalOverlay} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '440px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Adicionar à lista de espera</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <label style={lbl}>Paciente (buscar existente)</label>
            <input value={busca} onChange={e => buscar(e.target.value)} onFocus={() => sugestoes.length > 0 && setMostrarSug(true)} onBlur={() => setTimeout(() => setMostrarSug(false), 150)} placeholder="Nome ou WhatsApp..." style={inp} />
            {mostrarSug && sugestoes.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                {sugestoes.map(s => (
                  <button key={s.id} onMouseDown={() => selecionar(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', fontSize: '12.5px', color: 'var(--ink)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {s.nome_lead || 'Sem nome'} <span style={{ color: 'var(--muted)' }}>· {s.whatsapp_lead || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><label style={lbl}>Nome</label><input value={nome} onChange={e => { setNome(e.target.value); setLeadId(null); }} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>WhatsApp</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inp} /></div>
          </div>
          <div>
            <label style={lbl}>Profissional preferido</label>
            <select value={agendaId} onChange={e => setAgendaId(e.target.value)} style={inp}>
              <option value="">Qualquer profissional</option>
              {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Procedimento</label><input value={procedimento} onChange={e => setProcedimento(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Preferências (dias/horários)</label><input value={preferencias} onChange={e => setPreferencias(e.target.value)} placeholder="Ex: manhãs, após 18h, terças..." style={inp} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={busy} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy && <Loader2 size={13} className="animate-spin" />} Adicionar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Agendamento (ações: compareceu/faltou/cancelar/reagendar) ──────────
function AgendamentoModal({ ag, agendas, podeEditar, onClose, onUpdated, onVerPaciente }: { ag: any; agendas: any[]; podeEditar: boolean; onClose: () => void; onUpdated: () => void; onVerPaciente: (ag: any) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoReag, setModoReag] = useState(false);
  const [novaData, setNovaData] = useState(format(parseISO(ag.data_hora_inicio), 'yyyy-MM-dd'));
  const [novaHora, setNovaHora] = useState(format(parseISO(ag.data_hora_inicio), 'HH:mm'));
  const cor = ag.agendas?.cor || 'var(--sage)';
  const nome = ag.nome_lead || ag.leads?.nome_lead || 'Paciente';

  const auditar = async (action: string, detalhes: any) => {
    if (!user) return;
    await supabase.from('audit_log').insert({ user_id: user.id, action, record_id: ag.lead_id, detalhes: { agendamento_id: ag.id, ...detalhes } });
  };

  const mudarStatus = async (novo: string) => {
    setBusy(true); setErro(null);
    const { error } = await supabase.from('agendamentos').update({ status: novo }).eq('id', ag.id);
    if (error) { setErro('Erro: ' + error.message); setBusy(false); return; }
    // Compareceu confirma a conversão do lead (entra nas métricas).
    if (novo === 'compareceu' && ag.lead_id && ag.leads?.status !== 'converteu') {
      await supabase.from('leads').update({ status: 'converteu', converteu_em: new Date().toISOString() }).eq('id', ag.lead_id);
    }
    // Cancelamento → libera o slot e aciona o agente para oferecer ao próximo da fila.
    // (Falta não dispara: o agente já tem fluxo próprio de no-show; o motor já trata o horário como livre.)
    if (novo === 'cancelado') {
      await supabase.from('agente_eventos').insert({
        tipo: 'slot_liberado', agendamento_id: ag.id, lead_id: ag.lead_id, agenda_id: ag.agenda_id,
        payload: { motivo: novo, quando: ag.data_hora_inicio, procedimento: ag.procedimento_nome || null, profissional: ag.agendas?.nome || null },
      });
      // Reflete o cancelamento no Cal.com (se a reserva veio de lá). Best-effort.
      if (ag.calcom_uid) {
        try {
          await supabase.functions.invoke('cal-sync', { body: { action: 'cancel', calcom_uid: ag.calcom_uid, reason: 'Cancelado pela clínica' } });
        } catch (e) { console.error('cal-sync cancel falhou:', e); }
      }
    }
    await auditar('agendamento_status', { de: ag.status, para: novo });
    setBusy(false); onUpdated();
  };

  const reagendar = async () => {
    setErro(null);
    if (!novaData || !novaHora) { setErro('Informe a nova data e hora.'); return; }
    const inicio = new Date(`${novaData}T${novaHora}:00`);
    if (isNaN(inicio.getTime())) { setErro('Data/hora inválida.'); return; }
    setBusy(true);
    // Proteções: bloqueio + duplicidade (ignora o próprio).
    const { data: bloq } = await supabase.from('bloqueios').select('id')
      .eq('agenda_id', ag.agenda_id).lte('inicio', inicio.toISOString()).gte('fim', inicio.toISOString());
    if (bloq && bloq.length > 0) { setErro('Horário bloqueado para o profissional.'); setBusy(false); return; }
    const { data: dup } = await supabase.from('agendamentos').select('id')
      .eq('agenda_id', ag.agenda_id).eq('data_hora_inicio', inicio.toISOString())
      .not('status', 'in', '("cancelado","cancelou_agendamento","faltou")').neq('id', ag.id).limit(1);
    if (dup && dup.length > 0) { setErro('Já existe agendamento nesse horário.'); setBusy(false); return; }

    // Reflete no Cal.com (se veio de lá). O reschedule gera um uid novo → atualizamos.
    let novoUid = ag.calcom_uid;
    if (ag.calcom_uid) {
      try {
        const { data } = await supabase.functions.invoke('cal-sync', { body: { action: 'reschedule', calcom_uid: ag.calcom_uid, start: inicio.toISOString(), reason: 'Reagendado pela clínica' } });
        const u = data?.calcom?.data?.uid || data?.calcom?.uid;
        if (u) novoUid = u;
      } catch (e) { console.error('cal-sync reschedule falhou:', e); }
    }

    const { error } = await supabase.from('agendamentos')
      .update({ data_hora_inicio: inicio.toISOString(), status: 'reagendado', calcom_uid: novoUid }).eq('id', ag.id);
    if (error) { setErro('Erro: ' + error.message); setBusy(false); return; }
    if (ag.lead_id) await supabase.from('leads').update({ data_agendamento: inicio.toISOString() }).eq('id', ag.lead_id);
    await auditar('agendamento_reagendado', { de: ag.data_hora_inicio, para: inicio.toISOString() });
    setBusy(false); onUpdated();
  };

  return (
    <div style={modalOverlay} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '420px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Agendamento</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {/* Resumo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', borderLeft: `3px solid ${cor}`, marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{nome}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {format(parseISO(ag.data_hora_inicio), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
              {ag.procedimento_nome || ag.leads?.procedimento_interesse || '—'}{ag.agendas?.nome ? ` · ${ag.agendas.nome}` : ''}
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: isCancelado(ag) ? 'var(--rose-light)' : 'var(--sage-xlight)', color: isCancelado(ag) ? 'var(--rose-text)' : 'var(--sage-dark)' }}>
            {STATUS_LABEL[ag.status] || ag.status}
          </span>
        </div>

        {/* Reunião online */}
        {ag.modalidade === 'online' && (
          ag.link_reuniao ? (
            <a href={ag.link_reuniao} target="_blank" rel="noopener noreferrer"
               style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-xs)', background: 'var(--sage-dark)', color: 'white', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}>
              <Video size={15} /> Entrar na reunião
            </a>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-xs)', background: 'var(--champ-light)', color: 'var(--champ-text)', fontSize: '11.5px' }}>
              <Video size={14} /> Consulta online — link da reunião ainda não disponível.
            </div>
          )
        )}

        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}

        {modoReag ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}><label style={lbl}>Nova data</label><input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} style={inp} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Nova hora</label><input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setModoReag(false)} disabled={busy} style={btnGhost}>Voltar</button>
              <button onClick={reagendar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy && <Loader2 size={13} className="animate-spin" />} Confirmar reagendamento</button>
            </div>
          </div>
        ) : podeEditar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => mudarStatus('compareceu')} disabled={busy} style={{ ...acaoBtn, color: 'var(--sage-dark)', borderColor: 'var(--sage)' }}><Check size={14} /> Compareceu</button>
              <button onClick={() => mudarStatus('faltou')} disabled={busy} style={{ ...acaoBtn, color: 'var(--champ-text)', borderColor: 'var(--champ)' }}><UserX size={14} /> Faltou</button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setModoReag(true)} disabled={busy} style={{ ...acaoBtn }}><Clock size={14} /> Reagendar</button>
              <button onClick={() => mudarStatus('cancelado')} disabled={busy} style={{ ...acaoBtn, color: 'var(--rose-text)', borderColor: 'rgba(139,68,68,0.3)' }}><Ban size={14} /> Cancelar</button>
            </div>
            {ag.leads && (
              <button onClick={() => onVerPaciente(ag)} style={{ ...acaoBtn, justifyContent: 'center', color: 'var(--ink)' }}><User size={14} /> Ver perfil do paciente</button>
            )}
          </div>
        ) : (
          ag.leads && <button onClick={() => onVerPaciente(ag)} style={{ ...acaoBtn, justifyContent: 'center', color: 'var(--ink)' }}><User size={14} /> Ver perfil do paciente</button>
        )}
      </div>
    </div>
  );
}

// ── Modal Novo agendamento (manual, sem agente) ─────────────────────────────
function NovoAgendamentoModal({ agendas, profPadrao, dataPadrao, onClose, onSaved }: { agendas: any[]; profPadrao: string; dataPadrao: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [agendaId, setAgendaId] = useState(profPadrao || agendas[0]?.id || '');
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [mostrarSug, setMostrarSug] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [data, setData] = useState(dataPadrao);
  const [hora, setHora] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [servicosOpts, setServicosOpts] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('servicos').select('nome').order('nome').then(({ data: srv }) => {
      if (srv) setServicosOpts(srv.filter((s: any) => !s.arquivado).map((s: any) => s.nome));
    });
  }, []);

  const buscar = async (q: string) => {
    setBusca(q); setLeadId(null);
    if (q.trim().length < 2) { setSugestoes([]); return; }
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nome_lead, whatsapp_lead, email')
      .or(`nome_lead.ilike.%${q}%,whatsapp_lead.ilike.%${q}%`)
      .limit(6);
    setSugestoes(leads || []);
    setMostrarSug(true);
  };

  const selecionar = (l: any) => {
    setLeadId(l.id); setNome(l.nome_lead || ''); setWhatsapp(l.whatsapp_lead || ''); setEmail(l.email || '');
    setBusca(l.nome_lead || ''); setSugestoes([]); setMostrarSug(false);
  };

  const salvar = async () => {
    setErro(null);
    if (!agendaId) { setErro('Selecione o profissional.'); return; }
    if (!nome.trim()) { setErro('Informe o nome do paciente.'); return; }
    if (!data || !hora) { setErro('Informe data e hora.'); return; }
    const inicio = new Date(`${data}T${hora}:00`);
    if (isNaN(inicio.getTime())) { setErro('Data/hora inválida.'); return; }
    setBusy(true);

    // Proteção: horário bloqueado.
    const { data: bloq } = await supabase
      .from('bloqueios').select('id, dia_inteiro, inicio, fim')
      .eq('agenda_id', agendaId).lte('inicio', inicio.toISOString()).gte('fim', inicio.toISOString());
    if (bloq && bloq.length > 0) { setErro('Esse horário está bloqueado para o profissional.'); setBusy(false); return; }

    // Proteção: slot já ocupado (faltou/cancelado liberam).
    const { data: dup } = await supabase
      .from('agendamentos').select('id')
      .eq('agenda_id', agendaId).eq('data_hora_inicio', inicio.toISOString())
      .not('status', 'in', '("cancelado","cancelou_agendamento","faltou")').limit(1);
    if (dup && dup.length > 0) { setErro('Já existe agendamento nesse horário para o profissional.'); setBusy(false); return; }

    // Paciente avulso (novo) → cria o lead na base para ser acompanhado no funil.
    let leadFinal = leadId;
    let leadCriado = false;
    if (!leadFinal) {
      const { data: novoLead, error: lErr } = await supabase.from('leads').insert({
        nome_lead: nome.trim(),
        whatsapp_lead: whatsapp || null,
        procedimento_interesse: procedimento || null,
        status: 'agendado',
        origem: 'agendamento_manual',
        inicio_atendimento: new Date().toISOString(),
        data_agendamento: inicio.toISOString(),
      }).select('id').single();
      if (lErr || !novoLead) { setErro('Erro ao criar lead: ' + (lErr?.message || '')); setBusy(false); return; }
      leadFinal = novoLead.id;
      leadCriado = true;
    }

    // Insere localmente primeiro (assim o webhook do Cal.com vincula o uid em vez de duplicar).
    const { data: novoAg, error } = await supabase.from('agendamentos').insert({
      agenda_id: agendaId, lead_id: leadFinal,
      nome_lead: nome.trim(), whatsapp_lead: whatsapp || null,
      procedimento_nome: procedimento || null,
      data_hora_inicio: inicio.toISOString(), status: 'agendado',
    }).select('id').single();
    if (error) { setErro('Erro ao agendar: ' + error.message); setBusy(false); return; }

    // Reflete a reserva no Cal.com (para o agente/Cal.com ficarem em sincronia).
    const ag = agendas.find((a: any) => a.id === agendaId);
    let avisoCalcom: string | null = null;
    if (ag?.calcom_event_type_id) {
      try {
        const { data: r, error: cErr } = await supabase.functions.invoke('cal-sync', {
          body: {
            action: 'create',
            eventTypeId: ag.calcom_event_type_id,
            start: inicio.toISOString(),
            attendee: { name: nome.trim(), email: email || undefined, phoneNumber: whatsapp || undefined, timeZone: 'America/Sao_Paulo' },
          },
        });
        const booking = r?.calcom?.data || r?.calcom;
        const uid = booking?.uid;
        const link = booking?.meetingUrl || booking?.location || booking?.videoCallData?.url || null;
        if (cErr || r?.error) {
          // Tenta extrair a mensagem real do Cal.com (o invoke devolve só "non-2xx" por padrão).
          let detalhe = r?.error || cErr?.message || '';
          try { const body = await (cErr as any)?.context?.json?.(); if (body?.error) detalhe = body.error; } catch { /* ignore */ }
          if (/minimum booking notice|too soon|scheduling window|too far/i.test(detalhe)) {
            detalhe = 'esse horário viola as regras do event-type no Cal.com (antecedência mínima ou janela de disponibilidade). Ajuste em Cal.com → Tipos de Eventos → Limites → Antecedência mínima, ou escolha outro horário.';
          }
          avisoCalcom = 'Agendado no sistema, mas não criou no Cal.com: ' + detalhe;
        } else if (uid && novoAg?.id) {
          await supabase.from('agendamentos').update({
            calcom_uid: uid,
            link_reuniao: typeof link === 'string' && link.startsWith('http') ? link : null,
            modalidade: typeof link === 'string' && link.startsWith('http') ? 'online' : 'presencial',
          }).eq('id', novoAg.id);
        }
      } catch (e: any) {
        avisoCalcom = 'Agendado no sistema, mas falhou criar no Cal.com: ' + (e?.message || '');
      }
    } else {
      avisoCalcom = 'Agendado só no sistema (este profissional não tem "ID do Event-type" do Cal.com configurado).';
    }

    if (!leadCriado && leadFinal) {
      await supabase.from('leads').update({ data_agendamento: inicio.toISOString(), status: 'agendado' }).eq('id', leadFinal);
    }
    if (user) {
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'agendamento_manual', record_id: leadFinal,
        detalhes: { agenda_id: agendaId, paciente: nome, quando: inicio.toISOString(), lead_criado: leadCriado, calcom: !avisoCalcom },
      });
    }
    setBusy(false);
    if (avisoCalcom) alert(avisoCalcom);
    onSaved();
  };

  return (
    <div style={modalOverlay} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '460px' }}>
        <div style={modalHeader}>
          <h3 className="font-cormorant" style={modalTitle}>Novo agendamento</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>Profissional</label>
            <select value={agendaId} onChange={e => setAgendaId(e.target.value)} style={inp}>
              {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={lbl}>Paciente (buscar existente)</label>
            <input
              value={busca}
              onChange={e => buscar(e.target.value)}
              onFocus={() => sugestoes.length > 0 && setMostrarSug(true)}
              onBlur={() => setTimeout(() => setMostrarSug(false), 150)}
              placeholder="Nome ou WhatsApp..."
              style={inp}
            />
            {mostrarSug && sugestoes.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                {sugestoes.map(s => (
                  <button key={s.id} onMouseDown={() => selecionar(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', fontSize: '12.5px', color: 'var(--ink)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {s.nome_lead || 'Sem nome'} <span style={{ color: 'var(--muted)' }}>· {s.whatsapp_lead || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><label style={lbl}>Nome</label><input value={nome} onChange={e => { setNome(e.target.value); setLeadId(null); }} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>WhatsApp</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inp} /></div>
          </div>
          <div><label style={lbl}>Email <span style={{ textTransform: 'none', fontWeight: 400 }}>(p/ confirmação do Cal.com)</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opcional" style={inp} /></div>
          <div>
            <label style={lbl}>Procedimento</label>
            <input list="novo-ag-servicos" value={procedimento} onChange={e => setProcedimento(e.target.value)} placeholder="Ex: Consulta, retorno..." style={inp} />
            <datalist id="novo-ag-servicos">
              {servicosOpts.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><label style={lbl}>Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Hora</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} /></div>
          </div>
          {leadId && <p style={{ fontSize: '11px', color: 'var(--sage-dark)' }}>✓ Vinculado ao paciente existente</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={busy} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy && <Loader2 size={13} className="animate-spin" />} Agendar</button>
        </div>
      </div>
    </div>
  );
}

const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' };
const modalBox: React.CSSProperties = { background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', padding: '22px', maxHeight: '88vh', overflowY: 'auto' };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
const modalTitle: React.CSSProperties = { fontSize: '18px', fontWeight: 600, color: 'var(--ink)' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--sage-dark)', color: 'white', cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' };
const acaoBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 12px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'var(--white)', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' };
const miniBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' };

const navBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'var(--white)', color: 'var(--ink)', cursor: 'pointer' };
const tbPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const tbGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 500, background: 'var(--white)', color: 'var(--ink)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const lbl: React.CSSProperties = { fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none', boxSizing: 'border-box' };
